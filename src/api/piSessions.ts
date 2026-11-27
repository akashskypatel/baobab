import { BACKEND_URL } from './backend';
import type { PiCandidateEvent, PiPairingClaim, PiSessionSnapshot, PiSessionStreamEvent } from '../types/piSession';

const PI_API_URL = `${BACKEND_URL}/api/pi`;
const MAX_SNAPSHOT_BYTES = 512 * 1024;
const MAX_SSE_EVENT_BYTES = MAX_SNAPSHOT_BYTES + 2 * 1024;
const MAX_CANDIDATE_BYTES = 64 * 1024;
const MAX_CANDIDATE_DELTA_BYTES = 8 * 1024;
const MAX_CANDIDATE_EVENTS = 1024;
const CANDIDATE_ERROR_CODES = new Set([
  'endpoint_unavailable',
  'model_unavailable',
  'context_limit',
  'capability_unavailable',
  'provider_error',
  'output_limit',
  'request_timeout',
  'stale_session',
  'user_cancelled',
]);

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export class PiSessionApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'PiSessionApiError';
  }
}

function parseSnapshot(value: unknown): PiSessionSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PiSessionApiError('Pi session snapshot is invalid.');
  }
  const snapshot = value as Partial<PiSessionSnapshot>;
  if (snapshot.protocolVersion !== 1 || typeof snapshot.pairingId !== 'string' ||
      typeof snapshot.bridgeId !== 'string' || typeof snapshot.sessionId !== 'string' ||
      typeof snapshot.pairEpoch !== 'string' || !Number.isSafeInteger(snapshot.sequence) ||
      (snapshot.sequence ?? -1) < 0 ||
      !['idle', 'running', 'sync_limited'].includes(String(snapshot.state)) ||
      !Number.isSafeInteger(snapshot.entryCount) || (snapshot.entryCount ?? -1) < 0 ||
      !Array.isArray(snapshot.entries) || snapshot.entries.length > 200) {
    throw new PiSessionApiError('Pi session snapshot is invalid.');
  }
  const validEntries = snapshot.entries.every((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return Object.keys(entry).every((key) => ['id', 'parentId', 'role', 'text'].includes(key)) &&
      typeof entry.id === 'string' && entry.id.length <= 128 &&
      (entry.parentId === null || (typeof entry.parentId === 'string' && entry.parentId.length <= 128)) &&
      (entry.role === 'user' || entry.role === 'assistant') &&
      typeof entry.text === 'string';
  });
  if (!validEntries || (snapshot.state === 'sync_limited'
      ? snapshot.entries.length !== 0
      : snapshot.entryCount !== snapshot.entries.length)) {
    throw new PiSessionApiError('Pi session snapshot is invalid.');
  }
  return snapshot as PiSessionSnapshot;
}

async function readSnapshotResponse(response: Response): Promise<PiSessionSnapshot> {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_SNAPSHOT_BYTES) {
    throw new PiSessionApiError('Pi session snapshot exceeded its size limit.');
  }
  try {
    return parseSnapshot(JSON.parse(text) as unknown);
  } catch (error) {
    if (error instanceof PiSessionApiError) throw error;
    throw new PiSessionApiError('Pi session snapshot is invalid.');
  }
}

async function readError(response: Response): Promise<PiSessionApiError> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  const message = body.error || `Pi session request failed (${response.status})`;
  return new PiSessionApiError(message, response.status);
}

async function streamError(response: Response): Promise<PiSessionApiError> {
  await response.body?.cancel().catch(() => undefined);
  return new PiSessionApiError(`Pi session stream request failed (${response.status}).`, response.status);
}

function parseCandidateEvent(value: unknown): PiCandidateEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PiSessionApiError('Pi candidate event is invalid.');
  }
  const event = value as Partial<PiCandidateEvent>;
  const allowedKeys = ['type', 'pairingId', 'bridgeId', 'sessionId', 'pairEpoch', 'candidateId', 'baseEntryId',
    'generation', 'snapshotSequence', 'sequence', 'state', 'modelId', 'delta', 'text', 'errorCode', 'replay'];
  if (event.type !== 'candidate' || typeof event.pairingId !== 'string' ||
      typeof event.bridgeId !== 'string' || typeof event.sessionId !== 'string' ||
      typeof event.pairEpoch !== 'string' || typeof event.candidateId !== 'string' ||
      typeof event.baseEntryId !== 'string' || typeof event.modelId !== 'string' ||
      !Number.isSafeInteger(event.generation) || (event.generation ?? 0) < 1 ||
      !Number.isSafeInteger(event.snapshotSequence) || (event.snapshotSequence ?? -1) < 0 ||
      !Number.isSafeInteger(event.sequence) || (event.sequence ?? -1) < 0 || (event.sequence ?? MAX_CANDIDATE_EVENTS) >= MAX_CANDIDATE_EVENTS ||
      !['pending', 'streaming', 'completed', 'cancelled', 'error'].includes(String(event.state)) ||
      (event.delta !== undefined && typeof event.delta !== 'string') ||
      (event.text !== undefined && typeof event.text !== 'string') ||
      (event.replay !== undefined && typeof event.replay !== 'boolean') ||
      Object.keys(value).some((key) => !allowedKeys.includes(key)) ||
      (event.errorCode !== undefined && !CANDIDATE_ERROR_CODES.has(event.errorCode)) ||
      (event.replay ? (typeof event.text !== 'string' || event.delta !== undefined) : event.text !== undefined) ||
      (event.state === 'pending' && (event.sequence !== 0 || event.delta !== undefined || event.errorCode !== undefined)) ||
      (event.state === 'streaming' && (!event.replay && (typeof event.delta !== 'string' || event.delta.length === 0) || event.errorCode !== undefined)) ||
      (event.state === 'error' && event.errorCode === undefined) ||
      (event.state === 'completed' && event.errorCode !== undefined)) {
    throw new PiSessionApiError('Pi candidate event is invalid.');
  }
  const eventBytes = new TextEncoder().encode(JSON.stringify(event)).byteLength;
  if (eventBytes > MAX_CANDIDATE_BYTES * 6 + 2 * 1024 ||
      (event.delta !== undefined && new TextEncoder().encode(event.delta).byteLength > MAX_CANDIDATE_DELTA_BYTES) ||
      (event.text !== undefined && new TextEncoder().encode(event.text).byteLength > MAX_CANDIDATE_BYTES)) {
    throw new PiSessionApiError('Pi candidate event exceeded its size limit.');
  }
  return event as PiCandidateEvent;
}

export async function claimPiPairingCode(code: string, signal?: AbortSignal): Promise<PiPairingClaim> {
  const response = await fetch(`${PI_API_URL}/pairings/claim`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
    signal: requestSignal(signal, 5_000),
    body: JSON.stringify({ code, consentToVisibleText: true, consentVersion: 1 }),
  });
  if (!response.ok) throw await readError(response);
  const value = await response.json() as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PiSessionApiError('Pairing response is invalid.');
  }
  const claim = value as Partial<PiPairingClaim>;
  if (typeof claim.capability !== 'string' || !/^[0-9a-f]{64}$/.test(claim.capability) ||
      !Number.isSafeInteger(claim.expiresAt) || typeof claim.pairingId !== 'string' ||
      typeof claim.bridgeId !== 'string' || typeof claim.sessionId !== 'string' ||
      typeof claim.pairEpoch !== 'string' ||
      claim.scope !== 'visible-branch-and-turn-text') {
    throw new PiSessionApiError('Pairing response is invalid.');
  }
  return claim as PiPairingClaim;
}

export async function cancelPiPairingCode(code: string): Promise<void> {
  const response = await fetch(`${PI_API_URL}/pairings/cancel`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(3_000),
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw await readError(response);
}

export async function getPiSessionSnapshot(capability: string, signal?: AbortSignal): Promise<PiSessionSnapshot | null> {
  const response = await fetch(`${PI_API_URL}/sessions/snapshot`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${capability}` },
    credentials: 'omit',
    cache: 'no-store',
    signal: requestSignal(signal, 5_000),
  });
  if (response.status === 204) return null;
  if (!response.ok) throw await readError(response);
  return await readSnapshotResponse(response);
}

export async function revokePiSession(capability: string): Promise<void> {
  const response = await fetch(`${PI_API_URL}/sessions/revoke`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${capability}` },
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok && response.status !== 410) throw await readError(response);
}

export async function cancelPiCandidate(
  capability: string,
  pairingId: string,
  candidateId: string,
  generation: number,
  pairEpoch: string,
): Promise<void> {
  const response = await fetch(`${PI_API_URL}/sessions/candidates/cancel`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${capability}`, 'Content-Type': 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(3_000),
    body: JSON.stringify({ pairingId, candidateId, generation, pairEpoch }),
  });
  if (!response.ok && response.status !== 410) throw await readError(response);
}

export async function sendPiSessionHeartbeat(capability: string, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${PI_API_URL}/sessions/client-heartbeat`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${capability}` },
    credentials: 'omit',
    cache: 'no-store',
    signal: requestSignal(signal, 5_000),
  });
  if (!response.ok) throw await readError(response);
}

export async function readPiSessionStream(
  capability: string,
  signal: AbortSignal,
  onEvent: (event: PiSessionStreamEvent) => void,
): Promise<void> {
  const connectController = new AbortController();
  const connectTimeout = setTimeout(() => connectController.abort(), 5_000);
  let response: Response;
  try {
    response = await fetch(`${PI_API_URL}/sessions/stream`, {
      headers: { Accept: 'text/event-stream', Authorization: `Bearer ${capability}` },
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.any([signal, connectController.signal]),
    });
  } finally {
    clearTimeout(connectTimeout);
  }
  if (!response.ok) throw await streamError(response);
  if (!response.body) throw new PiSessionApiError('Pi session stream is not available.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let dataLines: string[] = [];
  let eventBytes = 0;

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventName = '';
      eventBytes = 0;
      return;
    }
    const eventData = dataLines.join('\n');
    if (new TextEncoder().encode(eventData).byteLength > MAX_SNAPSHOT_BYTES) {
      throw new PiSessionApiError('Pi session event exceeded its size limit.');
    }
    const payload = JSON.parse(eventData) as unknown;
    if (eventName === 'snapshot') onEvent({ type: 'snapshot', snapshot: parseSnapshot(payload) });
    else if (eventName === 'candidate') onEvent(parseCandidateEvent(payload));
    else if (eventName === 'revoked' && payload && typeof payload === 'object') {
      const revoked = payload as { pairingId?: unknown; reason?: unknown };
      if (typeof revoked.pairingId === 'string') {
        onEvent({
          type: 'revoked',
          pairingId: revoked.pairingId,
          reason: typeof revoked.reason === 'string' ? revoked.reason : 'revoked',
        });
      }
    }
    eventName = '';
    dataLines = [];
    eventBytes = 0;
  };

  let terminalError: unknown;
  try {
    while (!signal.aborted) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      if (new TextEncoder().encode(buffer).byteLength > MAX_SSE_EVENT_BYTES) {
        throw new PiSessionApiError('Pi session event exceeded its size limit.');
      }
      let lineEnd = buffer.indexOf('\n');
      while (lineEnd >= 0) {
        const line = buffer.slice(0, lineEnd).replace(/\r$/, '');
        buffer = buffer.slice(lineEnd + 1);
        if (line.length === 0) dispatch();
        else {
          eventBytes += new TextEncoder().encode(line).byteLength + 1;
          if (eventBytes > MAX_SSE_EVENT_BYTES) {
            throw new PiSessionApiError('Pi session event exceeded its size limit.');
          }
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        lineEnd = buffer.indexOf('\n');
      }
    }
  } catch (error) {
    terminalError = error;
    throw error;
  } finally {
    if (signal.aborted || terminalError) await reader.cancel(terminalError).catch(() => undefined);
    reader.releaseLock();
  }
}
