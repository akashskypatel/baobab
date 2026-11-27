import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Context } from "@earendil-works/pi-ai";

const API_BASE = "http://127.0.0.1:3001/api/pi";
const PAIRING_LIFETIME_MS = 5 * 60_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 2_000;
const MAX_SNAPSHOT_ENTRIES = 200;
const MAX_SNAPSHOT_BYTES = 512 * 1024;
const MAX_QUEUE_EVENTS = 64;
const MAX_QUEUE_BYTES = 1024 * 1024;
const CANDIDATE_PROVIDER_ID = "baobab-local-llama-candidate";
const CANDIDATE_DISCOVERY_TIMEOUT_MS = 3_000;
const CANDIDATE_TIMEOUT_MS = 120_000;
const CANDIDATE_STATUS_INTERVAL_MS = 500;
const CANDIDATE_MAX_OUTPUT_TOKENS = 128;
const CANDIDATE_MAX_OUTPUT_BYTES = 64 * 1024;
const CANDIDATE_MAX_DELTA_BYTES = 8 * 1024;
const CANDIDATE_MAX_EVENTS = 1024;
const CANDIDATE_INPUT_BYTES = 512 * 1024;
const CANDIDATE_HTTP_BODY_BYTES = CANDIDATE_INPUT_BYTES * 6 + 8 * 1024;
const CANDIDATE_INSTRUCTION = "Generate one alternative user-facing continuation to the visible Pi branch. Return only the candidate text.";

type SessionState = "idle" | "running" | "sync_limited";
type PairStatus = "pending" | "approved" | "expired" | "revoked";
type PairPhase = "confirming" | "registering" | "pending" | "approved";
type CandidateState = "pending" | "streaming" | "completed" | "cancelled" | "error";
type CandidateErrorCode = "endpoint_unavailable" | "model_unavailable" | "context_limit" | "capability_unavailable" | "provider_error" | "output_limit" | "request_timeout" | "stale_session" | "user_cancelled";

interface SessionTextEntry {
  id: string;
  parentId: string | null;
  role: "user" | "assistant";
  text: string;
}

interface SessionSnapshot {
  protocolVersion: 1;
  pairingId: string;
  bridgeId: string;
  sessionId: string;
  pairEpoch: string;
  sequence: number;
  state: SessionState;
  entryCount: number;
  entries: SessionTextEntry[];
}

interface CandidateRun {
  candidateId: string;
  generation: number;
  baseEntryId: string;
  snapshotSequence: number;
  deadlineAt: number;
  modelId: string;
  controller: AbortController;
  sequence: number;
  eventCount: number;
  outputBytes: number;
  started: boolean;
  startAttempted: boolean;
  terminal: boolean;
  keepProvider: boolean;
  completion: Promise<void> | null;
}

interface CandidateRequest {
  origin: string;
  modelId: string;
  maxOutputTokens: number;
}

interface PairSession {
  pairingId: string;
  bridgeId: string;
  sessionId: string;
  runtimeEpoch: number;
  bridgeToken: string;
  pairEpoch: string | null;
  expiresAt: number;
  controller: AbortController;
  phase: PairPhase;
  registrationPromise: Promise<void> | null;
  stopping: Promise<void> | null;
  approved: boolean;
  connected: boolean;
  sequence: number;
  latestSnapshot: SessionSnapshot | null;
  sentSnapshotSequence: number;
  queue: SessionSnapshot[];
  queueBytes: number;
  sending: boolean;
  needsSnapshot: boolean;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  candidateGeneration: number;
  candidate: CandidateRun | null;
}

class PairingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

class CandidateFailure extends Error {
  constructor(readonly code: CandidateErrorCode) {
    super(code);
    this.name = "CandidateFailure";
  }
}

let activePair: PairSession | null = null;
let runtimeEpoch = 0;

function isCurrentPair(pair: PairSession, ctx: ExtensionContext): boolean {
  return activePair === pair && pair.runtimeEpoch === runtimeEpoch &&
    !pair.controller.signal.aborted && ctx.sessionManager.getSessionId() === pair.sessionId;
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function formatPairingCode(hex: string): string {
  return hex.match(/.{1,8}/g)?.join("-") ?? hex;
}

function responseError(status: number): string {
  if (status === 401 || status === 403) return "The pairing capability is no longer valid.";
  if (status === 409) return "This pairing is no longer current.";
  if (status === 410) return "This pairing expired. Start a new pairing.";
  if (status === 413) return "This session is too large to sync.";
  return "Baobab is not available on this device.";
}

async function request<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  bearer?: string,
  parentSignal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
  const headers = new Headers({ accept: "application/json" });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new PairingError(responseError(response.status), response.status);
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      signal.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

function messageText(message: Record<string, unknown>): string {
  if (Array.isArray(message.toolCalls) && message.toolCalls.length > 0) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part): part is { type: "text"; text: string } =>
      !!part && typeof part === "object" &&
      (part as { type?: unknown }).type === "text" &&
      typeof (part as { text?: unknown }).text === "string")
    .map((part) => part.text)
    .join("");
}

function currentVisibleEntryId(ctx: ExtensionContext): string | null {
  const branch = ctx.sessionManager.getBranch();
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index];
    if (entry.type !== "message") continue;
    const message = (entry as { message?: unknown }).message;
    if (!message || typeof message !== "object") continue;
    const value = message as Record<string, unknown>;
    if ((value.role === "user" || value.role === "assistant") && messageText(value)) return entry.id;
  }
  return null;
}

function createSnapshot(ctx: ExtensionContext, pair: PairSession, state: SessionState): SessionSnapshot {
  const branch = ctx.sessionManager.getBranch();
  const visibleEntries: SessionTextEntry[] = [];
  const sequence = pair.sequence + 1;
  const limitedSnapshot = (entryCount: number): SessionSnapshot => {
    pair.sequence = sequence;
    return {
      protocolVersion: 1,
      pairingId: pair.pairingId,
      bridgeId: pair.bridgeId,
      sessionId: pair.sessionId,
      pairEpoch: pair.pairEpoch ?? "",
      sequence,
      state: "sync_limited",
      entryCount,
      entries: [],
    };
  };
  for (const entry of branch) {
    if (entry.type !== "message") continue;
    const message = (entry as { message?: unknown }).message;
    if (!message || typeof message !== "object") continue;
    const data = message as Record<string, unknown>;
    const role = data.role;
    if (role !== "user" && role !== "assistant") continue;
    const text = messageText(data);
    if (!text) continue;
    const visibleEntry: SessionTextEntry = {
      id: entry.id,
      parentId: entry.parentId,
      role,
      text,
    };
    if (visibleEntries.length >= MAX_SNAPSHOT_ENTRIES) {
      return limitedSnapshot(visibleEntries.length + 1);
    }
    visibleEntries.push(visibleEntry);
    const candidate: SessionSnapshot = {
      protocolVersion: 1,
      pairingId: pair.pairingId,
      bridgeId: pair.bridgeId,
      sessionId: pair.sessionId,
      pairEpoch: pair.pairEpoch ?? "",
      sequence,
      state,
      entryCount: visibleEntries.length,
      entries: visibleEntries,
    };
    if (new TextEncoder().encode(JSON.stringify(candidate)).byteLength > MAX_SNAPSHOT_BYTES) {
      return limitedSnapshot(visibleEntries.length);
    }
  }
  const snapshot: SessionSnapshot = {
    protocolVersion: 1,
    pairingId: pair.pairingId,
    bridgeId: pair.bridgeId,
    sessionId: pair.sessionId,
    pairEpoch: pair.pairEpoch ?? "",
    sequence,
    state,
    entryCount: visibleEntries.length,
    entries: visibleEntries,
  };
  pair.sequence = sequence;
  return snapshot;
}

function enqueue(pair: PairSession, snapshot: SessionSnapshot): void {
  if (activePair !== pair || !pair.approved) return;
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
  if (pair.queue.length >= MAX_QUEUE_EVENTS || pair.queueBytes + bytes > MAX_QUEUE_BYTES) {
    pair.queue = [];
    pair.queueBytes = 0;
    pair.needsSnapshot = true;
    return;
  }
  pair.queue.push(snapshot);
  pair.queueBytes += bytes;
  void drain(pair);
}

async function drain(pair: PairSession): Promise<void> {
  if (pair.sending) return;
  pair.sending = true;
  try {
    while (activePair === pair && pair.approved && pair.queue.length > 0) {
      const outbound = pair.queue.shift()!;
      pair.queueBytes -= new TextEncoder().encode(JSON.stringify(outbound)).byteLength;
      try {
        await request("/sessions/snapshot", "POST", outbound, pair.bridgeToken, pair.controller.signal);
        pair.connected = true;
        pair.sentSnapshotSequence = outbound.sequence;
      } catch (error) {
        pair.connected = false;
        pair.queue = [];
        pair.queueBytes = 0;
        pair.needsSnapshot = true;
        if (error instanceof PairingError && (error.status === 401 || error.status === 403 || error.status === 410)) {
          await stopPair("revoked", false);
        }
        return;
      }
    }
  } finally {
    pair.sending = false;
  }
}

function queueSnapshot(pair: PairSession, ctx: ExtensionContext, state: SessionState): void {
  if (!pair.pairEpoch) return;
  if (ctx.sessionManager.getSessionId() !== pair.sessionId) {
    void stopPair("session_changed", true);
    return;
  }
  const value = createSnapshot(ctx, pair, state);
  pair.latestSnapshot = value;
  enqueue(pair, value);
}

async function revoke(pair: PairSession): Promise<void> {
  try {
    await request("/sessions/revoke", "POST", { pairId: pair.pairingId, pairEpoch: pair.pairEpoch }, pair.bridgeToken);
  } catch {
    return;
  }
}

async function cancelRegistration(pair: PairSession): Promise<void> {
  try {
    await request("/pairings/cancel-registration", "POST", { pairingId: pair.pairingId }, pair.bridgeToken);
  } catch {
    return;
  }
}

async function stopSpecificPair(pair: PairSession, reason: string, notifyServer: boolean): Promise<void> {
  if (pair.stopping) return pair.stopping;
  if (activePair === pair) {
    activePair = null;
    runtimeEpoch += 1;
  }
  pair.approved = false;
  pair.connected = false;
  pair.queue = [];
  pair.queueBytes = 0;
  pair.needsSnapshot = false;
  if (pair.heartbeatTimer) clearInterval(pair.heartbeatTimer);
  pair.heartbeatTimer = null;
  pair.controller.abort(reason);
  pair.stopping = (async () => {
    await cancelCandidate(pair, "stale_session");
    if (pair.registrationPromise) await pair.registrationPromise.catch(() => undefined);
    if (notifyServer && pair.registrationPromise) {
      await cancelRegistration(pair);
      await revoke(pair);
    }
  })();
  await pair.stopping;
}

async function stopPair(reason: string, notifyServer: boolean): Promise<void> {
  const pair = activePair;
  if (pair) await stopSpecificPair(pair, reason, notifyServer);
}

async function startHeartbeat(pair: PairSession, ctx: ExtensionContext): Promise<void> {
  const pulse = async () => {
    if (activePair !== pair || !pair.approved) return;
    try {
      await request("/sessions/heartbeat", "POST", {
        pairId: pair.pairingId,
        bridgeId: pair.bridgeId,
        sessionId: pair.sessionId,
        pairEpoch: pair.pairEpoch,
      }, pair.bridgeToken, pair.controller.signal);
      if (activePair !== pair || !pair.approved) return;
      pair.connected = true;
      if (pair.needsSnapshot) {
        pair.needsSnapshot = false;
        queueSnapshot(pair, ctx, "idle");
      }
    } catch (error) {
      pair.connected = false;
      if (error instanceof PairingError && (error.status === 401 || error.status === 403 || error.status === 410)) {
        await stopPair("lease_expired", false);
      }
    }
  };
  await pulse();
  if (activePair === pair && pair.approved && !pair.heartbeatTimer) {
    pair.heartbeatTimer = setInterval(() => void pulse(), HEARTBEAT_INTERVAL_MS);
  }
}

async function monitorPair(pair: PairSession, ctx: ExtensionContext): Promise<void> {
  while (activePair === pair && !pair.controller.signal.aborted && Date.now() < pair.expiresAt) {
    try {
      const status = await request<{ status: PairStatus; pairEpoch?: string }>(
        "/pairings/status", "GET", undefined, pair.bridgeToken, pair.controller.signal);
      if (!isCurrentPair(pair, ctx)) {
        await stopSpecificPair(pair, "stale_pair_attempt", true);
        return;
      }
      if (status.status === "approved" && status.pairEpoch) {
        pair.approved = true;
        pair.phase = "approved";
        pair.pairEpoch = status.pairEpoch;
        await startHeartbeat(pair, ctx);
        if (!isCurrentPair(pair, ctx)) return;
        queueSnapshot(pair, ctx, "idle");
        ctx.ui.notify("Baobab pairing is active for this Pi session.", "info");
        return;
      }
      if (status.status === "expired" || status.status === "revoked") {
        await stopPair(status.status, false);
        ctx.ui.notify("The Pi pairing expired or was revoked.", "warning");
        return;
      }
    } catch (error) {
      if (error instanceof PairingError && (error.status === 401 || error.status === 403 || error.status === 410)) {
        await stopPair("pairing_rejected", false);
        ctx.ui.notify(error.message, "warning");
        return;
      }
    }
    try {
      await delay(1_000, pair.controller.signal);
    } catch {
      return;
    }
  }
  if (activePair === pair) {
    await stopPair("pairing_timeout", true);
    ctx.ui.notify("The Pi pairing code expired. Start a new pairing.", "warning");
  }
}

async function pairSession(ctx: ExtensionContext): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("Pairing requires an interactive Pi client.", "warning");
    return;
  }
  if (activePair) {
    ctx.ui.notify("Disable the current Baobab pairing before starting another.", "warning");
    return;
  }
  const pairingCode = randomBytes(16).toString("hex").toUpperCase();
  const pairingId = randomUUID();
  const bridgeId = randomUUID();
  const bridgeToken = randomBytes(32).toString("hex");
  const sessionId = ctx.sessionManager.getSessionId();
  const pair: PairSession = {
    pairingId,
    bridgeId,
    sessionId,
    runtimeEpoch,
    bridgeToken,
    pairEpoch: null,
    expiresAt: 0,
    controller: new AbortController(),
    phase: "confirming",
    registrationPromise: null,
    stopping: null,
    approved: false,
    connected: false,
    sequence: 0,
    latestSnapshot: null,
    sentSnapshotSequence: 0,
    queue: [],
    queueBytes: 0,
    sending: false,
    needsSnapshot: false,
    heartbeatTimer: null,
    candidateGeneration: 0,
    candidate: null,
  };
  activePair = pair;
  try {
    const confirmed = await ctx.ui.confirm(
      "Pair this Pi session with Baobab",
      `One-time code: ${formatPairingCode(pairingCode)}\nEnter this code in local Baobab. No session text moves until you approve there. The code expires in five minutes.`,
    );
    if (!confirmed) {
      await stopSpecificPair(pair, "pairing_cancelled", false);
      return;
    }
    if (!isCurrentPair(pair, ctx)) {
      await stopSpecificPair(pair, "session_changed_before_registration", false);
      return;
    }
    pair.expiresAt = Date.now() + PAIRING_LIFETIME_MS;
    pair.phase = "registering";
    const registration: Promise<void> = request<{ pairingId: string; expiresAt: number }>("/pairings", "POST", {
      protocolVersion: 1,
      pairingId,
      bridgeId,
      sessionId,
      pairingCodeHash: hashSecret(pairingCode),
      bridgeTokenHash: hashSecret(bridgeToken),
    }, undefined, pair.controller.signal).then(() => undefined);
    pair.registrationPromise = registration;
    await registration;
    if (!isCurrentPair(pair, ctx)) {
      await stopSpecificPair(pair, "stale_registration", true);
      return;
    }
    pair.phase = "pending";
    ctx.ui.notify("Pair request is ready. Enter the code in Baobab to approve session sharing.", "info");
    void monitorPair(pair, ctx);
  } catch {
    const reportFailure = activePair === pair && !pair.controller.signal.aborted;
    await stopSpecificPair(pair, "registration_failed", true);
    if (reportFailure) ctx.ui.notify("Baobab is not available on this device.", "warning");
  }
}

function reportStatus(ctx: ExtensionContext): void {
  if (!activePair) {
    ctx.ui.notify("Baobab pairing is disabled.", "info");
  } else if (activePair.approved) {
    ctx.ui.notify(activePair.connected ? "Baobab is connected to this Pi session." : "Baobab is disconnected. The next sync will replace the snapshot.", activePair.connected ? "info" : "warning");
  } else {
    ctx.ui.notify("Baobab pairing is waiting for the local code exchange.", "info");
  }
}

function parseCandidateRequest(args: string): CandidateRequest {
  const parts = args.trim().split(/\s+/);
  if (parts.length !== 3) throw new CandidateFailure("capability_unavailable");
  let endpoint: URL;
  try {
    endpoint = new URL(parts[0]);
  } catch {
    throw new CandidateFailure("endpoint_unavailable");
  }
  const hostname = endpoint.hostname.toLowerCase();
  if ((endpoint.protocol !== "http:" && endpoint.protocol !== "https:") ||
      !["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname) ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      (endpoint.pathname !== "" && endpoint.pathname !== "/")) {
    throw new CandidateFailure("endpoint_unavailable");
  }
  if (!/^\d+$/.test(parts[2])) throw new CandidateFailure("capability_unavailable");
  const maxOutputTokens = Number(parts[2]);
  if (!/^[^\s]{1,128}$/.test(parts[1]) || !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 ||
      maxOutputTokens > CANDIDATE_MAX_OUTPUT_TOKENS) {
    throw new CandidateFailure("capability_unavailable");
  }
  return { origin: endpoint.origin, modelId: parts[1], maxOutputTokens };
}

function candidateSignal(pair: PairSession, run: CandidateRun): AbortSignal {
  return AbortSignal.any([
    pair.controller.signal,
    run.controller.signal,
    AbortSignal.timeout(Math.max(1, run.deadlineAt - Date.now())),
  ]);
}

function localOriginFetch(origin: string): typeof fetch {
  const localOrigin = new URL(origin);
  if ((localOrigin.protocol !== "http:" && localOrigin.protocol !== "https:") ||
      !["localhost", "127.0.0.1", "[::1]", "::1"].includes(localOrigin.hostname.toLowerCase()) ||
      localOrigin.username || localOrigin.password || localOrigin.search || localOrigin.hash ||
      (localOrigin.pathname !== "" && localOrigin.pathname !== "/")) {
    throw new CandidateFailure("endpoint_unavailable");
  }
  const expectedOrigin = localOrigin.origin;
  return async (input, init) => {
    const inputUrl = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    let requestUrl: URL;
    try {
      requestUrl = new URL(inputUrl, expectedOrigin);
    } catch {
      throw new CandidateFailure("endpoint_unavailable");
    }
    if (requestUrl.origin !== expectedOrigin || requestUrl.username || requestUrl.password) {
      throw new CandidateFailure("endpoint_unavailable");
    }
    const response = await globalThis.fetch(input, { ...init, redirect: "error" });
    if (response.redirected || (response.url && new URL(response.url).origin !== expectedOrigin)) {
      await response.body?.cancel().catch(() => undefined);
      throw new CandidateFailure("endpoint_unavailable");
    }
    return response;
  };
}

function assertCandidateCurrent(pair: PairSession, run: CandidateRun, ctx: ExtensionContext): void {
  if (activePair !== pair || pair.candidate !== run || !pair.approved || pair.controller.signal.aborted ||
      run.controller.signal.aborted || ctx.sessionManager.getSessionId() !== pair.sessionId ||
      Date.now() >= run.deadlineAt) {
    throw new CandidateFailure("stale_session");
  }
}

async function candidateJson<T>(origin: string, url: string, method: "GET" | "POST", body: unknown, signal: AbortSignal): Promise<T> {
  const bodyText = body === undefined ? undefined : JSON.stringify(body);
  if (bodyText !== undefined && new TextEncoder().encode(bodyText).byteLength > CANDIDATE_HTTP_BODY_BYTES) {
    throw new CandidateFailure("context_limit");
  }
  let response: Response;
  try {
    response = await localOriginFetch(origin)(url, {
      method,
      headers: body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
      body: bodyText,
      signal: AbortSignal.any([signal, AbortSignal.timeout(CANDIDATE_DISCOVERY_TIMEOUT_MS)]),
      redirect: "error",
    });
  } catch {
    if (signal.aborted) throw signal.reason;
    throw new CandidateFailure("endpoint_unavailable");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new CandidateFailure("capability_unavailable");
  }
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > CANDIDATE_HTTP_BODY_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new CandidateFailure("context_limit");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new CandidateFailure("capability_unavailable");
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > CANDIDATE_HTTP_BODY_BYTES) throw new CandidateFailure("context_limit");
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    if (error instanceof CandidateFailure) throw error;
    if (signal.aborted) throw signal.reason;
    throw new CandidateFailure("capability_unavailable");
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new CandidateFailure("capability_unavailable");
  }
}

function buildCandidatePrompt(snapshot: SessionSnapshot): string {
  const visible = snapshot.entries.map((entry) => {
    const role = entry.role === "user" ? "Pi user" : "Pi assistant";
    return role + ":\n" + entry.text;
  }).join("\n\n");
  const prompt = CANDIDATE_INSTRUCTION + "\n\nVisible Pi branch text:\n" + visible;
  if (new TextEncoder().encode(prompt).byteLength > CANDIDATE_INPUT_BYTES) {
    throw new CandidateFailure("context_limit");
  }
  return prompt;
}

function splitCandidateDelta(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const character of value) {
    const characterBytes = new TextEncoder().encode(character).byteLength;
    if (currentBytes + characterBytes > CANDIDATE_MAX_DELTA_BYTES && current) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += characterBytes;
  }
  if (current) parts.push(current);
  return parts;
}

async function postCandidateEvent(
  pair: PairSession,
  run: CandidateRun,
  state: CandidateState,
  delta?: string,
  errorCode?: CandidateErrorCode,
  terminal = false,
): Promise<void> {
  if (!run.started && state !== "pending" && !run.startAttempted) throw new CandidateFailure("stale_session");
  if (run.eventCount >= CANDIDATE_MAX_EVENTS ||
      (state === "streaming" && run.eventCount >= CANDIDATE_MAX_EVENTS - 1)) {
    throw new CandidateFailure("output_limit");
  }
  const deltaBytes = delta === undefined ? 0 : new TextEncoder().encode(delta).byteLength;
  if (deltaBytes > CANDIDATE_MAX_DELTA_BYTES || run.outputBytes + deltaBytes > CANDIDATE_MAX_OUTPUT_BYTES) {
    throw new CandidateFailure("output_limit");
  }
  const sequence = run.started ? run.sequence + 1 : state === "pending" ? 0 : 1;
  if (state === "pending") run.startAttempted = true;
  const body = {
    protocolVersion: 1,
    pairingId: pair.pairingId,
    bridgeId: pair.bridgeId,
    sessionId: pair.sessionId,
    pairEpoch: pair.pairEpoch,
    candidateId: run.candidateId,
    generation: run.generation,
    baseEntryId: run.baseEntryId,
    snapshotSequence: run.snapshotSequence,
    sequence,
    state,
    modelId: run.modelId,
    ...(delta === undefined ? {} : { delta }),
    ...(errorCode === undefined ? {} : { errorCode }),
  };
  await request("/sessions/candidates/events", "POST", body, pair.bridgeToken,
    terminal ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : candidateSignal(pair, run));
  run.sequence = sequence;
  run.eventCount += 1;
  run.outputBytes += deltaBytes;
  run.started = true;
}

async function finishCandidate(
  pair: PairSession,
  run: CandidateRun,
  state: "completed" | "cancelled" | "error",
  errorCode?: CandidateErrorCode,
): Promise<void> {
  if (run.terminal) return;
  run.terminal = true;
  run.controller.abort(state);
  if (run.started || run.startAttempted) {
    await postCandidateEvent(pair, run, state, undefined, errorCode, true).catch(() => undefined);
  }
}

async function cancelCandidate(pair: PairSession, errorCode: CandidateErrorCode = "stale_session"): Promise<void> {
  const run = pair.candidate;
  if (!run) return;
  await finishCandidate(pair, run, "cancelled", errorCode);
  if (run.completion) await run.completion;
}

async function monitorCandidate(pair: PairSession, run: CandidateRun): Promise<void> {
  let consecutiveFailures = 0;
  while (!run.terminal && !run.controller.signal.aborted && !pair.controller.signal.aborted) {
    if (Date.now() >= run.deadlineAt) {
      await finishCandidate(pair, run, "error", "request_timeout");
      return;
    }
    try {
      const status = await request<{
        candidateId: string;
        generation: number;
        state: CandidateState;
        sequence: number;
        errorCode?: CandidateErrorCode;
      }>(
        "/sessions/candidates/status",
        "POST",
        { pairingId: pair.pairingId, candidateId: run.candidateId, generation: run.generation, pairEpoch: pair.pairEpoch },
        pair.bridgeToken,
        candidateSignal(pair, run),
      );
      consecutiveFailures = 0;
      if (status.candidateId !== run.candidateId || status.generation !== run.generation) {
        await finishCandidate(pair, run, "error", "stale_session");
        return;
      }
      if (status.state === "completed" || status.state === "cancelled" || status.state === "error") {
        run.terminal = true;
        run.controller.abort(status.state);
        return;
      }
    } catch (error) {
      if (run.controller.signal.aborted || pair.controller.signal.aborted) return;
      consecutiveFailures += 1;
      if (Date.now() >= run.deadlineAt) {
        await finishCandidate(pair, run, "error", "request_timeout");
        return;
      }
      if (error instanceof PairingError && [401, 403, 410, 404].includes(error.status)) {
        await finishCandidate(pair, run, "cancelled", "stale_session");
        return;
      }
      if (consecutiveFailures >= 2) {
        await finishCandidate(pair, run, "error", "endpoint_unavailable");
        return;
      }
    }
    try {
      await delay(CANDIDATE_STATUS_INTERVAL_MS, candidateSignal(pair, run));
    } catch {
      return;
    }
  }
}

async function listCandidateModels(config: CandidateRequest, signal: AbortSignal): Promise<number> {
  const result = await candidateJson<{ data?: unknown }>(config.origin, config.origin + "/v1/models", "GET", undefined, signal);
  if (!Array.isArray(result.data) || result.data.length !== 1 || !result.data.some((entry) =>
    !!entry && typeof entry === "object" && (entry as { id?: unknown }).id === config.modelId)) {
    throw new CandidateFailure("model_unavailable");
  }
  const properties = await candidateJson<{ default_generation_settings?: { n_ctx?: unknown } }>(
    config.origin, config.origin + "/props", "GET", undefined, signal);
  const contextTokens = properties.default_generation_settings?.n_ctx;
  if (!Number.isSafeInteger(contextTokens) || (contextTokens as number) < 2) {
    throw new CandidateFailure("capability_unavailable");
  }
  return contextTokens as number;
}

async function candidateInputTokenCount(config: CandidateRequest, prompt: string, signal: AbortSignal): Promise<number> {
  const messages = [{ role: "user", content: prompt }];
  const templated = await candidateJson<{ prompt?: unknown }>(
    config.origin, config.origin + "/apply-template", "POST", { messages }, signal);
  if (typeof templated.prompt !== "string") throw new CandidateFailure("capability_unavailable");
  if (new TextEncoder().encode(templated.prompt).byteLength > CANDIDATE_INPUT_BYTES) {
    throw new CandidateFailure("context_limit");
  }
  const tokenized = await candidateJson<{ tokens?: unknown }>(
    config.origin, config.origin + "/tokenize", "POST", { content: templated.prompt, add_special: false, parse_special: true, with_pieces: false }, signal);
  if (!Array.isArray(tokenized.tokens) || !tokenized.tokens.every(Number.isSafeInteger)) {
    throw new CandidateFailure("capability_unavailable");
  }
  return tokenized.tokens.length;
}

function candidateModelConfig(config: CandidateRequest, contextTokens: number) {
  return {
    name: "Baobab local llama.cpp candidate",
    baseUrl: config.origin + "/v1",
    apiKey: "local",
    api: "openai-completions" as const,
    models: [{
      id: config.modelId,
      name: config.modelId,
      reasoning: false,
      input: ["text" as const],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: contextTokens,
      maxTokens: config.maxOutputTokens,
    }],
  };
}

async function startCandidate(pi: ExtensionAPI, rawArgs: string, ctx: ExtensionContext): Promise<void> {
  const pair = activePair;
  if (!pair || !pair.approved || !pair.connected || !pair.pairEpoch) {
    ctx.ui.notify("Pair this Pi session before starting a candidate.", "warning");
    return;
  }
  if (pair.candidate) {
    ctx.ui.notify("A candidate is already active for this Pi session.", "warning");
    return;
  }
  let config: CandidateRequest;
  try {
    config = parseCandidateRequest(rawArgs);
  } catch {
    ctx.ui.notify("Use /baobab candidate <local-server-url> <model-id> <output-tokens>.", "warning");
    return;
  }
  if (ctx.modelRegistry.getProvider(CANDIDATE_PROVIDER_ID) || ctx.model?.provider === CANDIDATE_PROVIDER_ID) {
    ctx.ui.notify("The Baobab candidate provider is already in use. No provider was replaced.", "warning");
    return;
  }
  const snapshot = pair.latestSnapshot;
  if (!snapshot || snapshot.state !== "idle" || pair.sentSnapshotSequence !== snapshot.sequence ||
      pair.queue.length > 0 || pair.sending || ctx.sessionManager.getSessionId() !== pair.sessionId) {
    ctx.ui.notify("Wait for an idle, current Pi snapshot before starting a candidate.", "warning");
    return;
  }
  const baseEntryId = snapshot.entries[snapshot.entries.length - 1]?.id;
  if (!baseEntryId) {
    ctx.ui.notify("A candidate requires at least one visible Pi entry.", "warning");
    return;
  }
  if (currentVisibleEntryId(ctx) !== baseEntryId) {
    ctx.ui.notify("The Pi branch changed. Wait for Baobab to receive the current snapshot, then try again.", "warning");
    return;
  }
  const run: CandidateRun = {
    candidateId: randomUUID(),
    generation: pair.candidateGeneration + 1,
    baseEntryId,
    snapshotSequence: snapshot.sequence,
    deadlineAt: Date.now() + CANDIDATE_TIMEOUT_MS,
    modelId: config.modelId,
    controller: new AbortController(),
    sequence: -1,
    eventCount: 0,
    outputBytes: 0,
    started: false,
    startAttempted: false,
    terminal: false,
    keepProvider: false,
    completion: null,
  };
  pair.candidateGeneration = run.generation;
  pair.candidate = run;
  let registeredProviderConfig: unknown = null;
  const signal = candidateSignal(pair, run);
  let poll: Promise<void> = Promise.resolve();
  try {
    await postCandidateEvent(pair, run, "pending");
    assertCandidateCurrent(pair, run, ctx);
    poll = monitorCandidate(pair, run);
    const contextTokens = await listCandidateModels(config, signal);
    assertCandidateCurrent(pair, run, ctx);
    const prompt = buildCandidatePrompt(snapshot);
    const inputTokens = await candidateInputTokenCount(config, prompt, signal);
    assertCandidateCurrent(pair, run, ctx);
    if (inputTokens + config.maxOutputTokens > contextTokens) {
      throw new CandidateFailure("context_limit");
    }
    if (ctx.modelRegistry.getProvider(CANDIDATE_PROVIDER_ID) || ctx.model?.provider === CANDIDATE_PROVIDER_ID) {
      throw new CandidateFailure("model_unavailable");
    }
    try {
      pi.registerProvider(CANDIDATE_PROVIDER_ID, candidateModelConfig(config, contextTokens));
    } catch {
      throw new CandidateFailure("model_unavailable");
    }
    registeredProviderConfig = ctx.modelRegistry.getRegisteredProviderConfig(CANDIDATE_PROVIDER_ID) ?? null;
    if (!registeredProviderConfig) throw new CandidateFailure("model_unavailable");
    assertCandidateCurrent(pair, run, ctx);
    const model = ctx.modelRegistry.find(CANDIDATE_PROVIDER_ID, config.modelId);
    if (!model) throw new CandidateFailure("model_unavailable");
    const context: Context = { messages: [{ role: "user", content: prompt, timestamp: Date.now() }] };
    const stream = ctx.modelRegistry.streamSimple(model, context, {
      signal,
      timeoutMs: Math.max(1, run.deadlineAt - Date.now()),
      maxRetries: 0,
      maxTokens: config.maxOutputTokens,
      toolChoice: "none",
      fetch: localOriginFetch(config.origin),
    });
    let receivedText = false;
    for await (const event of stream) {
      if (run.controller.signal.aborted || pair.controller.signal.aborted) throw signal.reason;
      if (event.type === "error") throw new CandidateFailure("provider_error");
      if (event.type === "toolcall_start" || event.type === "toolcall_delta" || event.type === "toolcall_end") {
        throw new CandidateFailure("provider_error");
      }
      if (event.type !== "text_delta" || !event.delta) continue;
      receivedText = true;
      for (const piece of splitCandidateDelta(event.delta)) {
        await postCandidateEvent(pair, run, "streaming", piece);
      }
    }
    if (!receivedText) throw new CandidateFailure("provider_error");
    await finishCandidate(pair, run, "completed");
    ctx.ui.notify("The candidate is ready in Baobab. It was not written to the Pi session.", "info");
  } catch (error) {
    if (!run.terminal) {
      const code: CandidateErrorCode = error instanceof CandidateFailure ? error.code :
        error instanceof PairingError && [401, 403, 409, 410].includes(error.status) ? "stale_session" :
          error instanceof PairingError && error.status === 413 ? "output_limit" :
            error instanceof PairingError ? "endpoint_unavailable" :
            signal.aborted ? "request_timeout" : "provider_error";
      await finishCandidate(pair, run, "error", code);
      if (!pair.controller.signal.aborted) ctx.ui.notify("Candidate generation ended. Check Baobab for the status.", "warning");
    }
  } finally {
    run.controller.abort("candidate_finished");
    if (registeredProviderConfig && !run.keepProvider && ctx.model?.provider !== CANDIDATE_PROVIDER_ID &&
        ctx.modelRegistry.getRegisteredProviderConfig(CANDIDATE_PROVIDER_ID) === registeredProviderConfig) {
      try {
        pi.unregisterProvider(CANDIDATE_PROVIDER_ID);
      } catch {
        ctx.ui.notify("Pi kept the temporary candidate provider registered. It was not selected by this command.", "warning");
      }
    }
    await poll.catch(() => undefined);
    if (pair.candidate === run) pair.candidate = null;
  }
}

export default function registerBaobabExtension(pi: ExtensionAPI): void {
  pi.registerCommand("baobab", {
    description: "Pair, inspect, generate a local candidate, or disable Baobab session sync",
    handler: async (args, ctx) => {
      const trimmed = args.trim();
      const separator = trimmed.search(/\s/);
      const command = (separator < 0 ? trimmed : trimmed.slice(0, separator)).toLowerCase();
      const commandArgs = separator < 0 ? "" : trimmed.slice(separator + 1).trim();
      if (command === "pair") await pairSession(ctx);
      else if (command === "status") reportStatus(ctx);
      else if (command === "candidate") {
        const pairBefore = activePair;
        const candidateBefore = pairBefore?.candidate ?? null;
        const operation = startCandidate(pi, commandArgs, ctx);
        const candidateAfter = pairBefore?.candidate ?? null;
        if (!candidateBefore && candidateAfter && activePair === pairBefore && candidateAfter.completion === null) {
          candidateAfter.completion = operation;
        }
        void operation.catch(() => undefined);
      }
      else if (command === "cancel") {
        if (activePair) await cancelCandidate(activePair, "user_cancelled");
        ctx.ui.notify("Candidate output was cancelled.", "info");
      }
      else if (command === "disable") {
        await stopPair("user_disabled", true);
        ctx.ui.notify("Baobab session sync is disabled.", "info");
      } else {
        ctx.ui.notify("Use /baobab pair, /baobab status, /baobab candidate, /baobab cancel, or /baobab disable.", "info");
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (activePair && ctx.sessionManager.getSessionId() !== activePair.sessionId) {
      await stopPair("session_changed", true);
    }
  });

  pi.on("session_before_switch", async (_event, ctx) => {
    if (activePair && ctx.sessionManager.getSessionId() === activePair.sessionId) {
      await stopPair("session_switch", true);
    }
  });

  pi.on("session_before_fork", async (_event, ctx) => {
    if (activePair && ctx.sessionManager.getSessionId() === activePair.sessionId) {
      await stopPair("session_fork", true);
    }
  });

  pi.on("session_tree", async (_event, ctx) => {
    if (activePair) {
      await cancelCandidate(activePair, "stale_session");
      queueSnapshot(activePair, ctx, "idle");
    }
  });

  pi.on("turn_start", async (_event, ctx) => {
    if (activePair?.approved) {
      await cancelCandidate(activePair, "stale_session");
      queueSnapshot(activePair, ctx, "running");
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    if (activePair) queueSnapshot(activePair, ctx, "idle");
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (activePair) queueSnapshot(activePair, ctx, "idle");
  });

  pi.on("session_compact", async (_event, ctx) => {
    if (activePair) {
      await cancelCandidate(activePair, "stale_session");
      queueSnapshot(activePair, ctx, "idle");
    }
  });

  pi.on("model_select", (event) => {
    if (activePair?.candidate) {
      activePair.candidate.keepProvider = event.model.provider === CANDIDATE_PROVIDER_ID;
    }
  });

  pi.on("session_shutdown", async () => {
    await stopPair("session_shutdown", true);
  });
}
