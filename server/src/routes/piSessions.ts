import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { OutgoingHttpHeaders, ServerResponse } from 'node:http';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type PairState = 'pending' | 'approved';
type SessionState = 'idle' | 'running' | 'sync_limited';
type SessionRole = 'user' | 'assistant';
type CandidateState = 'pending' | 'streaming' | 'completed' | 'cancelled' | 'error';
type CandidateErrorCode = 'endpoint_unavailable' | 'model_unavailable' | 'context_limit' | 'capability_unavailable' | 'provider_error' | 'output_limit' | 'request_timeout' | 'stale_session' | 'user_cancelled';

interface PairRegistration {
  protocolVersion: 1;
  pairingId: string;
  bridgeId: string;
  sessionId: string;
  pairingCodeHash: string;
  bridgeTokenHash: string;
}

interface SessionEntry {
  id: string;
  parentId: string | null;
  role: SessionRole;
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
  entries: SessionEntry[];
}

interface PairRecord {
  pairingId: string;
  bridgeId: string;
  sessionId: string;
  state: PairState;
  pairingCodeHash: string;
  cancellationCodeHash?: string;
  bridgeTokenHash: string;
  browserCapabilityHash?: string;
  browserCapabilityExpiresAt?: number;
  pairEpoch: string;
  pairingExpiresAt: number;
  bridgeLeaseExpiresAt: number;
  browserLeaseExpiresAt: number;
  lastSequence: number;
  candidateGeneration: number;
  snapshot?: SessionSnapshot;
  candidate?: CandidateRecord;
  subscribers: Set<ServerResponse>;
}

interface CandidateRecord {
  candidateId: string;
  generation: number;
  baseEntryId: string;
  snapshotSequence: number;
  modelId: string;
  state: CandidateState;
  sequence: number;
  text: string;
  byteLength: number;
  eventCount: number;
  startedAt: number;
  errorCode?: CandidateErrorCode;
}

interface CandidateTombstone {
  pairingId: string;
  expiresAt: number;
}

interface RequestBucket {
  start: number;
  count: number;
}

interface CancelledPairingCode {
  pairingId?: string;
  expiresAt: number;
}

const PAIRING_TTL_MS = 5 * 60_000;
const BROWSER_CAPABILITY_TTL_MS = 15 * 60_000;
const PAIR_LEASE_TTL_MS = 90_000;
const SWEEP_INTERVAL_MS = 10_000;
const MAX_PENDING_PAIRS = 8;
const MAX_CANCELLED_PAIRING_CODES = 32;
const MAX_SNAPSHOT_BYTES = 512 * 1024;
const MAX_SNAPSHOT_ENTRIES = 200;
const MAX_SSE_BUFFER_BYTES = 1024 * 1024;
const MAX_CANDIDATE_BYTES = 64 * 1024;
const MAX_CANDIDATE_DELTA_BYTES = 8 * 1024;
const MAX_CANDIDATE_EVENTS = 1024;
const MAX_CANDIDATE_DURATION_MS = 120_000;
const MAX_CANDIDATE_STARTS_PER_MINUTE = 6;
const MAX_CANDIDATE_STATUS_REQUESTS_PER_MINUTE = 180;
const MAX_CANDIDATE_CANCELS_PER_MINUTE = 12;
const CANDIDATE_ERROR_CODES = new Set<CandidateErrorCode>([
  'endpoint_unavailable', 'model_unavailable', 'context_limit', 'capability_unavailable',
  'provider_error', 'output_limit', 'request_timeout', 'stale_session', 'user_cancelled',
]);
const MAX_CANCELLED_CANDIDATES = 256;
const MAX_REGISTER_REQUESTS_PER_MINUTE = 5;
const MAX_CLAIM_ATTEMPTS_PER_MINUTE = 5;
const allowedHosts = new Set(['localhost:3001', '127.0.0.1:3001']);

const pairs = new Map<string, PairRecord>();
const pairingByCodeHash = new Map<string, string>();
const pairingByCancelHash = new Map<string, string>();
const pairingByBridgeHash = new Map<string, string>();
const pairingByBrowserHash = new Map<string, string>();
const requestBuckets = new Map<string, RequestBucket>();
const cancelledPairingCodes = new Map<string, CancelledPairingCode>();
const cancelledBridgeTokens = new Map<string, CancelledPairingCode>();
const cancelledCandidates = new Map<string, CandidateTombstone>();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeCode(value: string): string {
  return value.replaceAll('-', '').trim().toUpperCase();
}

function isHex(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.length === length && /^[0-9a-f]+$/i.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function allowRequest(key: string, limit: number): boolean {
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || now - bucket.start >= 60_000) {
    requestBuckets.set(key, { start: now, count: 1 });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const value = header.slice(7).trim();
  return value.length >= 32 && value.length <= 128 ? value : null;
}

function lookupByBridgeToken(token: string): PairRecord | undefined {
  const pairingId = pairingByBridgeHash.get(sha256(token));
  return pairingId ? pairs.get(pairingId) : undefined;
}

function lookupByBrowserToken(token: string): PairRecord | undefined {
  const pairingId = pairingByBrowserHash.get(sha256(token));
  return pairingId ? pairs.get(pairingId) : undefined;
}

function rejectNonLocalHost(request: FastifyRequest, reply: FastifyReply): boolean {
  const host = request.headers.host?.toLowerCase();
  if (host && allowedHosts.has(host)) return false;
  reply.code(403).send({ error: 'local_host_required' });
  return true;
}

function sendSse(response: ServerResponse, event: string, payload: unknown, sequence?: number): boolean {
  if (response.destroyed || response.writableEnded) return false;
  const data = JSON.stringify(payload);
  const message = (sequence === undefined ? '' : `id: ${sequence}\n`) + `event: ${event}\ndata: ${data}\n\n`;
  if (response.writableLength + Buffer.byteLength(message) > MAX_SSE_BUFFER_BYTES) {
    response.end();
    return false;
  }
  response.write(message);
  return true;
}

function publish(pair: PairRecord, event: string, payload: unknown, sequence?: number): void {
  for (const subscriber of pair.subscribers) {
    if (!sendSse(subscriber, event, payload, sequence)) pair.subscribers.delete(subscriber);
  }
}

function candidatePayload(pair: PairRecord, candidate: CandidateRecord, options?: {
  delta?: string;
  replay?: boolean;
}): Record<string, unknown> {
  return {
    type: 'candidate',
    pairingId: pair.pairingId,
    bridgeId: pair.bridgeId,
    sessionId: pair.sessionId,
    pairEpoch: pair.pairEpoch,
    candidateId: candidate.candidateId,
    generation: candidate.generation,
    baseEntryId: candidate.baseEntryId,
    snapshotSequence: candidate.snapshotSequence,
    sequence: candidate.sequence,
    state: candidate.state,
    modelId: candidate.modelId,
    ...(options?.delta !== undefined ? { delta: options.delta } : {}),
    ...(options?.replay ? { text: candidate.text, replay: true } : {}),
    ...(candidate.errorCode ? { errorCode: candidate.errorCode } : {}),
  };
}

function isActiveCandidate(candidate: CandidateRecord): boolean {
  return candidate.state === 'pending' || candidate.state === 'streaming';
}

function candidateKey(pairingId: string, candidateId: string): string {
  return pairingId + ':' + candidateId;
}

function rememberCandidateTerminal(pairingId: string, candidateId: string): boolean {
  const key = candidateKey(pairingId, candidateId);
  if (cancelledCandidates.size >= MAX_CANCELLED_CANDIDATES && !cancelledCandidates.has(key)) return false;
  cancelledCandidates.set(key, { pairingId, expiresAt: Date.now() + PAIRING_TTL_MS });
  return true;
}

function endCandidate(pair: PairRecord, state: 'completed' | 'cancelled' | 'error', errorCode?: CandidateErrorCode): void {
  const candidate = pair.candidate;
  if (!candidate || !isActiveCandidate(candidate)) return;
  candidate.state = state;
  candidate.sequence += 1;
  candidate.eventCount += 1;
  candidate.errorCode = errorCode;
  publish(pair, 'candidate', candidatePayload(pair, candidate), candidate.sequence);
  rememberCandidateTerminal(pair.pairingId, candidate.candidateId);
}

function revokePair(pair: PairRecord, reason: string): void {
  endCandidate(pair, 'cancelled', 'stale_session');
  publish(pair, 'revoked', { pairingId: pair.pairingId, reason });
  for (const subscriber of pair.subscribers) subscriber.end();
  pairingByCodeHash.delete(pair.pairingCodeHash);
  const codeHash = pair.cancellationCodeHash || pair.pairingCodeHash;
  if (codeHash) {
    pairingByCodeHash.delete(codeHash);
    pairingByCancelHash.delete(codeHash);
    cancelledPairingCodes.set(codeHash, { pairingId: pair.pairingId, expiresAt: Date.now() + PAIRING_TTL_MS });
  }
  pairingByBridgeHash.delete(pair.bridgeTokenHash);
  cancelledBridgeTokens.set(pair.bridgeTokenHash, { pairingId: pair.pairingId, expiresAt: Date.now() + PAIRING_TTL_MS });
  if (pair.browserCapabilityHash) pairingByBrowserHash.delete(pair.browserCapabilityHash);
  pair.snapshot = undefined;
  pair.candidate = undefined;
  for (const [key, tombstone] of cancelledCandidates) {
    if (tombstone.pairingId === pair.pairingId) cancelledCandidates.delete(key);
  }
  pair.subscribers.clear();
  pairs.delete(pair.pairingId);
}

function expirePairs(): void {
  const now = Date.now();
  for (const pair of pairs.values()) {
    if (pair.candidate && isActiveCandidate(pair.candidate) &&
        Date.now() - pair.candidate.startedAt >= MAX_CANDIDATE_DURATION_MS) {
      endCandidate(pair, 'error', 'request_timeout');
    }
    if (pair.state === 'pending' && pair.pairingExpiresAt <= now) {
      revokePair(pair, 'pairing_expired');
    } else if (pair.state === 'approved' && (
      pair.bridgeLeaseExpiresAt <= now ||
      pair.browserLeaseExpiresAt <= now ||
      !pair.browserCapabilityExpiresAt ||
      pair.browserCapabilityExpiresAt <= now
    )) {
      revokePair(pair, 'capability_expired');
    }
  }
  for (const [key, bucket] of requestBuckets) {
    if (now - bucket.start >= 60_000) requestBuckets.delete(key);
  }
  for (const [hash, cancellation] of cancelledBridgeTokens) {
    if (cancellation.expiresAt <= now) cancelledBridgeTokens.delete(hash);
  }
  for (const [hash, cancellation] of cancelledPairingCodes) {
    if (cancellation.expiresAt <= now) cancelledPairingCodes.delete(hash);
  }
  for (const [key, tombstone] of cancelledCandidates) {
    if (tombstone.expiresAt <= now) cancelledCandidates.delete(key);
  }
}

function validateEntries(value: unknown): value is SessionEntry[] {
  if (!Array.isArray(value) || value.length > MAX_SNAPSHOT_ENTRIES) return false;
  return value.every((entry) => {
    if (!isObject(entry) || !hasOnlyKeys(entry, ['id', 'parentId', 'role', 'text'])) return false;
    return typeof entry.id === 'string' && entry.id.length <= 128 &&
      (entry.parentId === null || (typeof entry.parentId === 'string' && entry.parentId.length <= 128)) &&
      (entry.role === 'user' || entry.role === 'assistant') &&
      typeof entry.text === 'string';
  });
}

function findBridgePair(request: FastifyRequest, reply: FastifyReply): PairRecord | undefined {
  const token = bearer(request);
  if (!token) {
    reply.code(401).send({ error: 'bridge_capability_required' });
    return undefined;
  }
  const pair = lookupByBridgeToken(token);
  if (!pair) {
    reply.code(401).send({ error: 'bridge_capability_invalid' });
    return undefined;
  }
  if (pair.state === 'pending' && pair.pairingExpiresAt <= Date.now()) {
    revokePair(pair, 'lease_expired');
    reply.code(410).send({ error: 'pair_expired' });
    return undefined;
  }
  return pair;
}

function authorizeBridge(request: FastifyRequest, reply: FastifyReply): PairRecord | undefined {
  const pair = findBridgePair(request, reply);
  if (!pair) return undefined;
  if (pair.state !== 'approved' || pair.bridgeLeaseExpiresAt <= Date.now() ||
      pair.browserLeaseExpiresAt <= Date.now() ||
      !pair.browserCapabilityExpiresAt || pair.browserCapabilityExpiresAt <= Date.now()) {
    if (pair.state === 'approved') revokePair(pair, 'lease_expired');
    reply.code(pair.state === 'pending' ? 409 : 410).send({ error: 'pair_not_active' });
    return undefined;
  }
  return pair;
}

function authorizeBrowser(request: FastifyRequest, reply: FastifyReply): PairRecord | undefined {
  const token = bearer(request);
  if (!token) {
    reply.code(401).send({ error: 'session_capability_required' });
    return undefined;
  }
  const pair = lookupByBrowserToken(token);
  if (!pair) {
    reply.code(401).send({ error: 'session_capability_invalid' });
    return undefined;
  }
  if (pair.state !== 'approved' ||
      !pair.browserCapabilityExpiresAt ||
      pair.browserCapabilityExpiresAt <= Date.now() ||
      pair.bridgeLeaseExpiresAt <= Date.now() ||
      pair.browserLeaseExpiresAt <= Date.now()) {
    revokePair(pair, 'capability_expired');
    reply.code(410).send({ error: 'pair_expired' });
    return undefined;
  }
  return pair;
}

function requestKey(request: FastifyRequest, type: string): string {
  return `${request.ip}:${type}`;
}

export async function piSessionRoutes(fastify: FastifyInstance): Promise<void> {
  const sweep = setInterval(expirePairs, SWEEP_INTERVAL_MS);
  sweep.unref();
  fastify.addHook('onClose', async () => {
    clearInterval(sweep);
    for (const pair of pairs.values()) revokePair(pair, 'server_shutdown');
    pairs.clear();
    pairingByCodeHash.clear();
    pairingByCancelHash.clear();
    pairingByBridgeHash.clear();
    pairingByBrowserHash.clear();
    cancelledPairingCodes.clear();
    cancelledBridgeTokens.clear();
    cancelledCandidates.clear();
  });
  fastify.addHook('preHandler', async (request, reply) => {
    if (rejectNonLocalHost(request, reply)) return reply;
  });

  fastify.post<{ Body: PairRegistration }>('/pairings', { bodyLimit: 8 * 1024 }, async (request, reply) => {
    expirePairs();
    if (!allowRequest(requestKey(request, 'register'), MAX_REGISTER_REQUESTS_PER_MINUTE)) {
      return reply.code(429).send({ error: 'pairing_rate_limited' });
    }
    const body = request.body as unknown;
    if (!isObject(body) || !hasOnlyKeys(body, ['protocolVersion', 'pairingId', 'bridgeId', 'sessionId', 'pairingCodeHash', 'bridgeTokenHash']) ||
        body.protocolVersion !== 1 ||
        typeof body.pairingId !== 'string' || body.pairingId.length > 64 ||
        typeof body.bridgeId !== 'string' || body.bridgeId.length > 64 ||
        typeof body.sessionId !== 'string' || body.sessionId.length > 128 ||
        !isHex(body.pairingCodeHash, 64) || !isHex(body.bridgeTokenHash, 64)) {
      return reply.code(400).send({ error: 'invalid_pairing_request' });
    }
    const registrationCodeHash = body.pairingCodeHash.toLowerCase();
    const cancelledCode = cancelledPairingCodes.get(registrationCodeHash);
    if (cancelledCode) {
      return reply.code(410).send({ error: 'pairing_cancelled' });
    }
    const bridgeTokenHash = body.bridgeTokenHash.toLowerCase();
    const cancellation = cancelledBridgeTokens.get(bridgeTokenHash);
    if (cancellation) {
      return reply.code(410).send({ error: 'pairing_cancelled' });
    }
    if (cancelledPairingCodes.size + pairs.size >= MAX_CANCELLED_PAIRING_CODES ||
        cancelledBridgeTokens.size + pairs.size >= MAX_CANCELLED_PAIRING_CODES) {
      return reply.code(429).send({ error: 'pairing_capacity_reached' });
    }
    if (pairs.size >= MAX_PENDING_PAIRS) return reply.code(429).send({ error: 'pairing_capacity_reached' });
    if (pairs.has(body.pairingId) || pairingByCodeHash.has(registrationCodeHash) ||
        pairingByBridgeHash.has(body.bridgeTokenHash.toLowerCase())) {
      return reply.code(409).send({ error: 'pairing_already_registered' });
    }
    const now = Date.now();
    const pair: PairRecord = {
      pairingId: body.pairingId,
      bridgeId: body.bridgeId,
      sessionId: body.sessionId,
      state: 'pending',
      pairingCodeHash: registrationCodeHash,
      bridgeTokenHash: body.bridgeTokenHash.toLowerCase(),
      pairEpoch: randomUUID(),
      pairingExpiresAt: now + PAIRING_TTL_MS,
      bridgeLeaseExpiresAt: now + PAIRING_TTL_MS,
      browserLeaseExpiresAt: now + PAIRING_TTL_MS,
      lastSequence: 0,
      candidateGeneration: 0,
      subscribers: new Set(),
    };
    pairs.set(pair.pairingId, pair);
    pairingByCodeHash.set(pair.pairingCodeHash, pair.pairingId);
    pairingByBridgeHash.set(pair.bridgeTokenHash, pair.pairingId);
    return reply.code(201).send({ pairingId: pair.pairingId, expiresAt: pair.pairingExpiresAt });
  });

  fastify.post<{ Body: { code: string; consentToVisibleText: boolean; consentVersion: 1 } }>(
    '/pairings/claim', { bodyLimit: 2 * 1024 }, async (request, reply) => {
    expirePairs();
    if (!allowRequest(requestKey(request, 'claim'), MAX_CLAIM_ATTEMPTS_PER_MINUTE)) {
      return reply.code(429).send({ error: 'pairing_claim_rate_limited' });
    }
    const body = request.body as unknown;
    if (!isObject(body) || !hasOnlyKeys(body, ['code', 'consentToVisibleText', 'consentVersion']) ||
        typeof body.code !== 'string' || body.code.length > 64 ||
        body.consentToVisibleText !== true || body.consentVersion !== 1) {
      return reply.code(400).send({ error: 'invalid_pairing_code' });
    }
    const code = normalizeCode(body.code);
    if (!/^[0-9A-F]{32}$/.test(code)) return reply.code(401).send({ error: 'pairing_not_found' });
    const codeHash = sha256(code);
    const pairingId = pairingByCodeHash.get(codeHash);
    const pair = pairingId ? pairs.get(pairingId) : undefined;
    if (!pair || pair.state !== 'pending' || pair.pairingExpiresAt <= Date.now()) {
      return reply.code(401).send({ error: 'pairing_not_found' });
    }
    pairingByCodeHash.delete(pair.pairingCodeHash);
    pair.cancellationCodeHash = pair.pairingCodeHash;
    pairingByCancelHash.set(pair.cancellationCodeHash, pair.pairingId);
    pair.state = 'approved';
    pair.pairingCodeHash = '';
    const capability = randomBytes(32).toString('hex');
    pair.browserCapabilityHash = sha256(capability);
    pair.browserCapabilityExpiresAt = Date.now() + BROWSER_CAPABILITY_TTL_MS;
    pair.bridgeLeaseExpiresAt = Date.now() + PAIR_LEASE_TTL_MS;
    pair.browserLeaseExpiresAt = Date.now() + PAIR_LEASE_TTL_MS;
    pairingByBrowserHash.set(pair.browserCapabilityHash, pair.pairingId);
    return reply.send({
      capability,
      expiresAt: pair.browserCapabilityExpiresAt,
      pairingId: pair.pairingId,
      bridgeId: pair.bridgeId,
      sessionId: pair.sessionId,
      pairEpoch: pair.pairEpoch,
      scope: 'visible-branch-and-turn-text',
    });
  });

  fastify.post<{ Body: { code: string } }>('/pairings/cancel', { bodyLimit: 2 * 1024 }, async (request, reply) => {
    expirePairs();
    if (!allowRequest(requestKey(request, 'cancel'), MAX_CLAIM_ATTEMPTS_PER_MINUTE)) {
      return reply.code(429).send({ error: 'pairing_cancel_rate_limited' });
    }
    const body = request.body as unknown;
    if (!isObject(body) || !hasOnlyKeys(body, ['code']) || typeof body.code !== 'string' || body.code.length > 64) {
      return reply.code(204).send();
    }
    const code = normalizeCode(body.code);
    if (!/^[0-9A-F]{32}$/.test(code)) return reply.code(204).send();
    const codeHash = sha256(code);
    const pairingId = pairingByCodeHash.get(codeHash) ?? pairingByCancelHash.get(codeHash);
    const pair = pairingId ? pairs.get(pairingId) : undefined;
    if (pair) revokePair(pair, 'owner_cancelled');
    else {
      if (cancelledPairingCodes.size >= MAX_CANCELLED_PAIRING_CODES) {
        return reply.code(429).send({ error: 'pairing_cancel_capacity_reached' });
      }
      cancelledPairingCodes.set(codeHash, { expiresAt: Date.now() + PAIRING_TTL_MS });
    }
    return reply.code(204).send();
  });

  fastify.post<{ Body: { pairingId: string } }>(
    '/pairings/cancel-registration', { bodyLimit: 2 * 1024 }, async (request, reply) => {
      expirePairs();
      if (!allowRequest(requestKey(request, 'cancel-registration'), MAX_REGISTER_REQUESTS_PER_MINUTE)) {
        return reply.code(429).send({ error: 'pairing_cancel_rate_limited' });
      }
      const body = request.body as unknown;
      const token = bearer(request);
      if (!token || !isHex(token, 64) || !isObject(body) || !hasOnlyKeys(body, ['pairingId']) ||
          typeof body.pairingId !== 'string' || body.pairingId.length > 64) {
        return reply.code(400).send({ error: 'invalid_pairing_cancellation' });
      }
      const bridgeHash = sha256(token);
      const pair = lookupByBridgeToken(token);
      if (pair && pair.pairingId === body.pairingId) {
        revokePair(pair, 'owner_cancelled');
        return reply.code(204).send();
      }
      if (pair) return reply.code(204).send();
      if (cancelledBridgeTokens.size >= MAX_CANCELLED_PAIRING_CODES) {
        return reply.code(429).send({ error: 'pairing_cancel_capacity_reached' });
      }
      cancelledBridgeTokens.set(bridgeHash, { pairingId: body.pairingId, expiresAt: Date.now() + PAIRING_TTL_MS });
      return reply.code(204).send();
    });

  fastify.get('/pairings/status', async (request, reply) => {
    const pair = findBridgePair(request, reply);
    if (!pair) return;
    if (pair.state === 'pending') return reply.send({ status: 'pending', expiresAt: pair.pairingExpiresAt });
    if (pair.bridgeLeaseExpiresAt <= Date.now() || pair.browserLeaseExpiresAt <= Date.now()) {
      revokePair(pair, 'lease_expired');
      return reply.code(410).send({ error: 'pair_expired' });
    }
    return reply.send({ status: 'approved', pairEpoch: pair.pairEpoch, expiresAt: pair.browserCapabilityExpiresAt });
  });

  fastify.post<{ Body: { pairId: string; bridgeId: string; sessionId: string; pairEpoch: string } }>(
    '/sessions/heartbeat', { bodyLimit: 2 * 1024 }, async (request, reply) => {
      const pair = authorizeBridge(request, reply);
      if (!pair) return;
      const body = request.body as unknown;
      if (!isObject(body) || !hasOnlyKeys(body, ['pairId', 'bridgeId', 'sessionId', 'pairEpoch']) ||
          body.pairId !== pair.pairingId || body.bridgeId !== pair.bridgeId ||
          body.sessionId !== pair.sessionId || body.pairEpoch !== pair.pairEpoch) {
        return reply.code(409).send({ error: 'pair_epoch_mismatch' });
      }
      pair.bridgeLeaseExpiresAt = Date.now() + PAIR_LEASE_TTL_MS;
      return reply.code(204).send();
    });

  fastify.post('/sessions/client-heartbeat', async (request, reply) => {
    const pair = authorizeBrowser(request, reply);
    if (!pair) return;
    pair.browserLeaseExpiresAt = Date.now() + PAIR_LEASE_TTL_MS;
    return reply.code(204).send();
  });

  fastify.post<{ Body: SessionSnapshot }>('/sessions/snapshot', { bodyLimit: MAX_SNAPSHOT_BYTES }, async (request, reply) => {
    const pair = authorizeBridge(request, reply);
    if (!pair) return;
    const body = request.body as unknown;
    if (!isObject(body) || !hasOnlyKeys(body, [
      'protocolVersion', 'pairingId', 'bridgeId', 'sessionId', 'pairEpoch', 'sequence', 'state', 'entryCount', 'entries',
    ]) || body.protocolVersion !== 1 || body.pairingId !== pair.pairingId ||
        body.bridgeId !== pair.bridgeId || body.sessionId !== pair.sessionId || body.pairEpoch !== pair.pairEpoch ||
        !Number.isSafeInteger(body.sequence) || (body.sequence as number) <= pair.lastSequence ||
        !['idle', 'running', 'sync_limited'].includes(String(body.state)) ||
        !Number.isSafeInteger(body.entryCount) || (body.entryCount as number) < 0 || !validateEntries(body.entries) ||
        (body.state === 'sync_limited' ? body.entries.length !== 0 : body.entryCount !== body.entries.length)) {
      return reply.code(400).send({ error: 'invalid_session_snapshot' });
    }
    const byteLength = Buffer.byteLength(JSON.stringify(body));
    if (byteLength > MAX_SNAPSHOT_BYTES) return reply.code(413).send({ error: 'snapshot_too_large' });
    if (pair.candidate && isActiveCandidate(pair.candidate) &&
        (body.sequence !== pair.candidate.snapshotSequence || body.state !== 'idle' ||
         body.entries.at(-1)?.id !== pair.candidate.baseEntryId)) {
      endCandidate(pair, 'cancelled', 'stale_session');
    }
    pair.lastSequence = body.sequence as number;
    pair.snapshot = body as unknown as SessionSnapshot;
    pair.bridgeLeaseExpiresAt = Date.now() + PAIR_LEASE_TTL_MS;
    publish(pair, 'snapshot', pair.snapshot, pair.lastSequence);
    return reply.code(204).send();
  });

  fastify.post('/sessions/candidates/events', { bodyLimit: MAX_CANDIDATE_DELTA_BYTES * 6 + 4 * 1024 }, async (request, reply) => {
    const pair = authorizeBridge(request, reply);
    if (!pair) return;
    const body = request.body as unknown;
    const baseKeys = ['protocolVersion', 'pairingId', 'bridgeId', 'sessionId', 'pairEpoch', 'candidateId', 'generation', 'baseEntryId', 'snapshotSequence', 'sequence', 'state', 'modelId'];
    if (!isObject(body) || body.protocolVersion !== 1 || body.pairingId !== pair.pairingId ||
        body.bridgeId !== pair.bridgeId || body.sessionId !== pair.sessionId || body.pairEpoch !== pair.pairEpoch ||
        typeof body.candidateId !== 'string' || body.candidateId.length > 64 ||
        !Number.isSafeInteger(body.generation) || (body.generation as number) < 1 ||
        typeof body.baseEntryId !== 'string' || body.baseEntryId.length > 128 ||
        !Number.isSafeInteger(body.snapshotSequence) || !Number.isSafeInteger(body.sequence) ||
        !['pending', 'streaming', 'completed', 'cancelled', 'error'].includes(String(body.state)) ||
        typeof body.modelId !== 'string' || body.modelId.length === 0 || body.modelId.length > 128 ||
        (body.errorCode !== undefined && (typeof body.errorCode !== 'string' || !CANDIDATE_ERROR_CODES.has(body.errorCode as CandidateErrorCode))) ||
        !hasOnlyKeys(body, [...baseKeys, 'delta', 'errorCode'])) {
      return reply.code(400).send({ error: 'invalid_candidate_event' });
    }
    const state = body.state as CandidateState;
    const generation = body.generation as number;
    if (state === 'pending') {
      const tombstoneKey = candidateKey(pair.pairingId, body.candidateId);
      if (cancelledCandidates.has(tombstoneKey)) return reply.code(410).send({ error: 'candidate_cancelled' });
      if (generation <= pair.candidateGeneration) return reply.code(409).send({ error: 'candidate_generation_mismatch' });
      if (cancelledCandidates.size >= MAX_CANCELLED_CANDIDATES - MAX_PENDING_PAIRS) {
        return reply.code(429).send({ error: 'candidate_tombstone_capacity_reached' });
      }
      if (body.sequence !== 0 || body.delta !== undefined || body.errorCode !== undefined ||
          pair.candidate && (isActiveCandidate(pair.candidate) || pair.candidate.candidateId === body.candidateId)) {
        return reply.code(409).send({ error: 'candidate_already_active' });
      }
      if (!allowRequest(requestKey(request, 'candidate_start'), MAX_CANDIDATE_STARTS_PER_MINUTE)) {
        return reply.code(429).send({ error: 'candidate_rate_limited' });
      }
      const snapshot = pair.snapshot;
      if (!snapshot || snapshot.state !== 'idle' || snapshot.sequence !== body.snapshotSequence ||
          snapshot.entries.at(-1)?.id !== body.baseEntryId) {
        return reply.code(409).send({ error: 'candidate_base_is_stale' });
      }
      const candidate: CandidateRecord = {
        candidateId: body.candidateId,
        generation,
        baseEntryId: body.baseEntryId,
        snapshotSequence: body.snapshotSequence as number,
        modelId: body.modelId,
        state: 'pending',
        sequence: 0,
        text: '',
        byteLength: 0,
        eventCount: 1,
        startedAt: Date.now(),
      };
      pair.candidateGeneration = candidate.generation;
      pair.candidate = candidate;
      publish(pair, 'candidate', candidatePayload(pair, candidate), candidate.sequence);
      return reply.code(204).send();
    }
    const candidate = pair.candidate;
    if (!candidate || candidate.candidateId !== body.candidateId || candidate.generation !== body.generation ||
        candidate.baseEntryId !== body.baseEntryId || candidate.snapshotSequence !== body.snapshotSequence ||
        candidate.modelId !== body.modelId || !isActiveCandidate(candidate)) {
      if ((state === 'cancelled' || state === 'error') && body.sequence === 1 &&
          generation > pair.candidateGeneration &&
          (state !== 'error' || ['endpoint_unavailable', 'model_unavailable', 'context_limit', 'capability_unavailable', 'provider_error', 'output_limit', 'request_timeout', 'stale_session', 'user_cancelled'].includes(String(body.errorCode)))) {
        if (!allowRequest(requestKey(request, 'candidate_cancel'), MAX_CANDIDATE_CANCELS_PER_MINUTE)) {
          return reply.code(429).send({ error: 'candidate_cancel_rate_limited' });
        }
        if (!rememberCandidateTerminal(pair.pairingId, body.candidateId)) {
          return reply.code(429).send({ error: 'candidate_tombstone_capacity_reached' });
        }
        pair.candidateGeneration = generation;
        return reply.code(204).send();
      }
      return reply.code(409).send({ error: 'candidate_is_not_active' });
    }
    if (Date.now() - candidate.startedAt >= MAX_CANDIDATE_DURATION_MS) {
      endCandidate(pair, 'error', 'request_timeout');
      return reply.code(410).send({ error: 'candidate_timed_out' });
    }
    if (body.sequence !== candidate.sequence + 1 || candidate.eventCount >= MAX_CANDIDATE_EVENTS) {
      return reply.code(409).send({ error: 'candidate_sequence_mismatch' });
    }
    if (state === 'streaming') {
      if (candidate.eventCount >= MAX_CANDIDATE_EVENTS - 1) {
        endCandidate(pair, 'error', 'output_limit');
        return reply.code(413).send({ error: 'candidate_event_limit' });
      }
      if (typeof body.delta !== 'string' || body.delta.length === 0 || body.errorCode !== undefined) {
        return reply.code(400).send({ error: 'invalid_candidate_delta' });
      }
      const deltaBytes = Buffer.byteLength(body.delta, 'utf8');
      if (deltaBytes > MAX_CANDIDATE_DELTA_BYTES || candidate.byteLength + deltaBytes > MAX_CANDIDATE_BYTES) {
        endCandidate(pair, 'error', 'output_limit');
        return reply.code(413).send({ error: 'candidate_output_limit' });
      }
      candidate.state = 'streaming';
      candidate.sequence = body.sequence as number;
      candidate.text += body.delta;
      candidate.byteLength += deltaBytes;
      candidate.eventCount += 1;
      publish(pair, 'candidate', candidatePayload(pair, candidate, { delta: body.delta }), candidate.sequence);
      return reply.code(204).send();
    }
    if (body.delta !== undefined) return reply.code(400).send({ error: 'invalid_candidate_terminal_event' });
    const terminalState = state as 'completed' | 'cancelled' | 'error';
    if (terminalState === 'error' && body.errorCode === undefined) {
      return reply.code(400).send({ error: 'invalid_candidate_error' });
    }
    if (terminalState === 'completed' && body.errorCode !== undefined) {
      return reply.code(400).send({ error: 'invalid_candidate_error' });
    }
    candidate.state = terminalState;
    candidate.sequence = body.sequence as number;
    candidate.eventCount += 1;
    candidate.errorCode = body.errorCode as CandidateErrorCode | undefined;
    publish(pair, 'candidate', candidatePayload(pair, candidate), candidate.sequence);
    rememberCandidateTerminal(pair.pairingId, candidate.candidateId);
    return reply.code(204).send();
  });

  fastify.post('/sessions/candidates/status', { bodyLimit: 2 * 1024 }, async (request, reply) => {
    const pair = authorizeBridge(request, reply);
    if (!pair) return;
    if (!allowRequest(requestKey(request, 'candidate_status'), MAX_CANDIDATE_STATUS_REQUESTS_PER_MINUTE)) {
      return reply.code(429).send({ error: 'candidate_status_rate_limited' });
    }
    const body = request.body as unknown;
    if (!isObject(body) || !hasOnlyKeys(body, ['pairingId', 'candidateId', 'generation', 'pairEpoch']) ||
        body.pairingId !== pair.pairingId || body.pairEpoch !== pair.pairEpoch ||
        typeof body.candidateId !== 'string' || body.candidateId.length > 64 ||
        !Number.isSafeInteger(body.generation) || (body.generation as number) < 1) {
      return reply.code(400).send({ error: 'invalid_candidate_status_request' });
    }
    const candidate = pair.candidate;
    if (!candidate || candidate.candidateId !== body.candidateId || candidate.generation !== body.generation) {
      return reply.code(404).send({ error: 'candidate_not_found' });
    }
    if (isActiveCandidate(candidate) && Date.now() - candidate.startedAt >= MAX_CANDIDATE_DURATION_MS) {
      endCandidate(pair, 'error', 'request_timeout');
    }
    return reply.send({ candidateId: candidate.candidateId, generation: candidate.generation, state: candidate.state, sequence: candidate.sequence, errorCode: candidate.errorCode });
  });

  fastify.post('/sessions/candidates/cancel', { bodyLimit: 2 * 1024 }, async (request, reply) => {
    const pair = authorizeBrowser(request, reply);
    if (!pair) return;
    const body = request.body as unknown;
    if (!isObject(body) || !hasOnlyKeys(body, ['pairingId', 'candidateId', 'generation', 'pairEpoch']) ||
        body.pairingId !== pair.pairingId || body.pairEpoch !== pair.pairEpoch ||
        typeof body.candidateId !== 'string' || body.candidateId.length > 64 ||
        !Number.isSafeInteger(body.generation) || (body.generation as number) < 1) {
      return reply.code(400).send({ error: 'invalid_candidate_cancellation' });
    }
    if (!allowRequest(requestKey(request, 'candidate_cancel'), MAX_CANDIDATE_CANCELS_PER_MINUTE)) {
      return reply.code(429).send({ error: 'candidate_cancel_rate_limited' });
    }
    const candidate = pair.candidate;
    if (!candidate || candidate.candidateId !== body.candidateId || candidate.generation !== body.generation) return reply.code(204).send();
    endCandidate(pair, 'cancelled');
    return reply.code(204).send();
  });

  fastify.get('/sessions/snapshot', async (request, reply) => {
    const pair = authorizeBrowser(request, reply);
    if (!pair) return;
    if (!pair.snapshot) return reply.code(204).send();
    reply.header('cache-control', 'no-store');
    return reply.send(pair.snapshot);
  });

  fastify.get('/sessions/stream', async (request, reply) => {
    const pair = authorizeBrowser(request, reply);
    if (!pair) return;
    for (const subscriber of pair.subscribers) subscriber.end();
    pair.subscribers.clear();
    const corsHeaders = Object.fromEntries(
      Object.entries(reply.getHeaders()).filter((entry): entry is [string, string | number | string[]] => entry[1] !== undefined),
    ) as OutgoingHttpHeaders;
    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, {
      ...corsHeaders,
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.write(': connected\n\n');
    pair.subscribers.add(response);
    const keepAlive = setInterval(() => {
      const keepAliveMessage = ': keepalive\n\n';
      if (response.writableLength + Buffer.byteLength(keepAliveMessage) > MAX_SSE_BUFFER_BYTES) {
        response.end();
        pair.subscribers.delete(response);
        clearInterval(keepAlive);
        return;
      }
      response.write(keepAliveMessage);
    }, 15_000);
    response.on('close', () => {
      clearInterval(keepAlive);
      pair.subscribers.delete(response);
    });
    if (pair.snapshot) sendSse(response, 'snapshot', pair.snapshot, pair.lastSequence);
    if (pair.candidate) sendSse(response, 'candidate', candidatePayload(pair, pair.candidate, { replay: true }), pair.candidate.sequence);
  });

  fastify.post('/sessions/revoke', async (request, reply) => {
    const token = bearer(request);
    if (!token) return reply.code(401).send({ error: 'session_capability_required' });
    const bridgePair = lookupByBridgeToken(token);
    const browserPair = lookupByBrowserToken(token);
    const pair = bridgePair ?? browserPair;
    if (!pair) return reply.code(401).send({ error: 'session_capability_invalid' });
    revokePair(pair, 'user_revoked');
    return reply.code(204).send();
  });
}
