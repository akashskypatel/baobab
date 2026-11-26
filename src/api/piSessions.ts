import { BACKEND_URL } from './backend';
import type { PiPairingClaim, PiSessionSnapshot, PiSessionStreamEvent } from '../types/piSession';

const PI_API_URL = `${BACKEND_URL}/api/pi`;
const MAX_SNAPSHOT_BYTES = 512 * 1024;
const MAX_SSE_EVENT_BYTES = MAX_SNAPSHOT_BYTES + 2 * 1024;

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
