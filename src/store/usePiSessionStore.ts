import { create } from 'zustand';
import type { PiPairingClaim, PiSessionSnapshot } from '../types/piSession';

export type PiSessionConnection = 'unpaired' | 'connecting' | 'connected' | 'disconnected' | 'expired' | 'revoked';

interface PiSessionState {
  capability: string | null;
  pairingId: string | null;
  bridgeId: string | null;
  sessionId: string | null;
  pairEpoch: string | null;
  connection: PiSessionConnection;
  snapshot: PiSessionSnapshot | null;
  lastReceivedAt: number | null;
  error: string | null;
  setPairing: (claim: PiPairingClaim) => void;
  setSnapshot: (snapshot: PiSessionSnapshot) => void;
  setConnection: (connection: PiSessionConnection, error?: string | null, pairingId?: string) => void;
  clearPairing: (connection?: 'unpaired' | 'expired' | 'revoked', pairingId?: string) => void;
}

export const usePiSessionStore = create<PiSessionState>((set) => ({
  capability: null,
  pairingId: null,
  bridgeId: null,
  sessionId: null,
  pairEpoch: null,
  connection: 'unpaired',
  snapshot: null,
  lastReceivedAt: null,
  error: null,
  setPairing: (claim) => set({
    capability: claim.capability,
    pairingId: claim.pairingId,
    bridgeId: claim.bridgeId,
    sessionId: claim.sessionId,
    pairEpoch: claim.pairEpoch,
    connection: 'connecting',
    snapshot: null,
    lastReceivedAt: null,
    error: null,
  }),
  setSnapshot: (snapshot) => set((state) => {
    if (snapshot.pairingId !== state.pairingId || snapshot.bridgeId !== state.bridgeId ||
        snapshot.sessionId !== state.sessionId || snapshot.pairEpoch !== state.pairEpoch) return state;
    if (state.snapshot && state.snapshot.pairingId === snapshot.pairingId &&
        state.snapshot.sequence >= snapshot.sequence) return state;
    return {
      snapshot,
      lastReceivedAt: Date.now(),
      error: snapshot.state === 'sync_limited' ? 'This active branch exceeds the sync limit.' : null,
    };
  }),
  setConnection: (connection, error, pairingId) => set((state) => {
    if (pairingId && state.pairingId !== pairingId) return state;
    return { connection, error: error === undefined ? state.error : error };
  }),
  clearPairing: (connection = 'unpaired', pairingId) => set((state) => {
    if (pairingId && state.pairingId !== pairingId) return state;
    return {
      capability: null,
      pairingId: null,
      bridgeId: null,
      sessionId: null,
      pairEpoch: null,
      connection,
      snapshot: null,
      lastReceivedAt: null,
      error: null,
    };
  }),
}));
