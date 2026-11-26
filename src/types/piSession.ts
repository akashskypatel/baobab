export type PiSessionState = 'idle' | 'running' | 'sync_limited';

export interface PiSessionEntry {
  id: string;
  parentId: string | null;
  role: 'user' | 'assistant';
  text: string;
}

export interface PiSessionSnapshot {
  protocolVersion: 1;
  pairingId: string;
  bridgeId: string;
  sessionId: string;
  pairEpoch: string;
  sequence: number;
  state: PiSessionState;
  entryCount: number;
  entries: PiSessionEntry[];
}

export interface PiPairingClaim {
  capability: string;
  expiresAt: number;
  pairingId: string;
  bridgeId: string;
  sessionId: string;
  pairEpoch: string;
  scope: 'visible-branch-and-turn-text';
}

export type PiSessionStreamEvent =
  | { type: 'snapshot'; snapshot: PiSessionSnapshot }
  | { type: 'revoked'; pairingId: string; reason: string };
