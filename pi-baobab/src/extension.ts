import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const API_BASE = "http://127.0.0.1:3001/api/pi";
const PAIRING_LIFETIME_MS = 5 * 60_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 2_000;
const MAX_SNAPSHOT_ENTRIES = 200;
const MAX_SNAPSHOT_BYTES = 512 * 1024;
const MAX_QUEUE_EVENTS = 64;
const MAX_QUEUE_BYTES = 1024 * 1024;

type SessionState = "idle" | "running" | "sync_limited";
type PairStatus = "pending" | "approved" | "expired" | "revoked";
type PairPhase = "confirming" | "registering" | "pending" | "approved";

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
  queue: SessionSnapshot[];
  queueBytes: number;
  sending: boolean;
  needsSnapshot: boolean;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
}

class PairingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
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
  pair.queue = [];
  pair.queueBytes = 0;
  pair.needsSnapshot = false;
  if (pair.heartbeatTimer) clearInterval(pair.heartbeatTimer);
  pair.heartbeatTimer = null;
  pair.controller.abort(reason);
  pair.stopping = (async () => {
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
    queue: [],
    queueBytes: 0,
    sending: false,
    needsSnapshot: false,
    heartbeatTimer: null,
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

export default function registerBaobabExtension(pi: ExtensionAPI): void {
  pi.registerCommand("baobab", {
    description: "Pair, inspect, or disable local Baobab session sync",
    handler: async (args, ctx) => {
      const command = args.trim().toLowerCase();
      if (command === "pair") await pairSession(ctx);
      else if (command === "status") reportStatus(ctx);
      else if (command === "disable") {
        await stopPair("user_disabled", true);
        ctx.ui.notify("Baobab session sync is disabled.", "info");
      } else {
        ctx.ui.notify("Use /baobab pair, /baobab status, or /baobab disable.", "info");
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
    if (activePair) queueSnapshot(activePair, ctx, "idle");
  });

  pi.on("turn_start", async (_event, ctx) => {
    if (activePair?.approved) queueSnapshot(activePair, ctx, "running");
  });

  pi.on("turn_end", async (_event, ctx) => {
    if (activePair) queueSnapshot(activePair, ctx, "idle");
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (activePair) queueSnapshot(activePair, ctx, "idle");
  });

  pi.on("session_compact", async (_event, ctx) => {
    if (activePair) queueSnapshot(activePair, ctx, "idle");
  });

  pi.on("session_shutdown", async () => {
    await stopPair("session_shutdown", true);
  });
}
