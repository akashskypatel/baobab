import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { OutgoingHttpHeaders, ServerResponse } from 'node:http';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type PairState = 'pending' | 'approved';
type SessionState = 'idle' | 'running' | 'sync_limited';
type SessionRole = 'user' | 'assistant';

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
  snapshot?: SessionSnapshot;
  subscribers: Set<ServerResponse>;
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

function revokePair(pair: PairRecord, reason: string): void {
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
  pair.subscribers.clear();
  pairs.delete(pair.pairingId);
}

function expirePairs(): void {
  const now = Date.now();
  for (const pair of pairs.values()) {
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
    pair.lastSequence = body.sequence as number;
    pair.snapshot = body as unknown as SessionSnapshot;
    pair.bridgeLeaseExpiresAt = Date.now() + PAIR_LEASE_TTL_MS;
    publish(pair, 'snapshot', pair.snapshot, pair.lastSequence);
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
