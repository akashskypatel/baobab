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

export type PiCandidateState = 'pending' | 'streaming' | 'completed' | 'cancelled' | 'error';

export type PiCandidateErrorCode =
  | 'endpoint_unavailable'
  | 'model_unavailable'
  | 'context_limit'
  | 'capability_unavailable'
  | 'provider_error'
  | 'output_limit'
  | 'request_timeout'
  | 'stale_session'
  | 'user_cancelled';

export interface PiCandidateEvent {
  type: 'candidate';
  pairingId: string;
  bridgeId: string;
  sessionId: string;
  pairEpoch: string;
  candidateId: string;
  generation: number;
  baseEntryId: string;
  snapshotSequence: number;
  sequence: number;
  state: PiCandidateState;
  modelId: string;
  delta?: string;
  text?: string;
  errorCode?: PiCandidateErrorCode;
  replay?: boolean;
}

export interface PiCandidate {
  pairingId: string;
  bridgeId: string;
  sessionId: string;
  pairEpoch: string;
  candidateId: string;
  generation: number;
  baseEntryId: string;
  snapshotSequence: number;
  sequence: number;
  state: PiCandidateState;
  modelId: string;
  text: string;
  errorCode?: PiCandidateErrorCode;
}

export type PiSessionStreamEvent =
  | { type: 'snapshot'; snapshot: PiSessionSnapshot }
  | { type: 'revoked'; pairingId: string; reason: string }
  | PiCandidateEvent;
