import { create } from 'zustand';
import type { PiCandidate, PiCandidateEvent, PiPairingClaim, PiSessionSnapshot } from '../types/piSession';

export type PiSessionConnection = 'unpaired' | 'connecting' | 'connected' | 'disconnected' | 'expired' | 'revoked';

interface PiSessionState {
  capability: string | null;
  pairingId: string | null;
  bridgeId: string | null;
  sessionId: string | null;
  pairEpoch: string | null;
  candidateGeneration: number;
  connection: PiSessionConnection;
  snapshot: PiSessionSnapshot | null;
  candidate: PiCandidate | null;
  lastReceivedAt: number | null;
  error: string | null;
  setPairing: (claim: PiPairingClaim) => void;
  setSnapshot: (snapshot: PiSessionSnapshot) => void;
  setCandidateEvent: (event: PiCandidateEvent) => void;
  setConnection: (connection: PiSessionConnection, error?: string | null, pairingId?: string) => void;
  clearPairing: (connection?: 'unpaired' | 'expired' | 'revoked', pairingId?: string) => void;
}

export const usePiSessionStore = create<PiSessionState>((set) => ({
  capability: null,
  pairingId: null,
  bridgeId: null,
  sessionId: null,
  pairEpoch: null,
  candidateGeneration: 0,
  connection: 'unpaired',
  snapshot: null,
  candidate: null,
  lastReceivedAt: null,
  error: null,
  setPairing: (claim) => set({
    capability: claim.capability,
    pairingId: claim.pairingId,
    bridgeId: claim.bridgeId,
    sessionId: claim.sessionId,
    pairEpoch: claim.pairEpoch,
    candidateGeneration: 0,
    connection: 'connecting',
    snapshot: null,
    candidate: null,
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
      candidate: state.candidate && state.candidate.snapshotSequence !== snapshot.sequence ? null : state.candidate,
      lastReceivedAt: Date.now(),
      error: snapshot.state === 'sync_limited' ? 'This active branch exceeds the sync limit.' : null,
    };
  }),
  setCandidateEvent: (event) => set((state) => {
    if (event.pairingId !== state.pairingId || event.bridgeId !== state.bridgeId ||
        event.sessionId !== state.sessionId || event.pairEpoch !== state.pairEpoch || !state.snapshot ||
        event.snapshotSequence !== state.snapshot.sequence ||
        event.baseEntryId !== state.snapshot.entries[state.snapshot.entries.length - 1]?.id ||
        event.generation < state.candidateGeneration) return state;
    const previous = state.candidate;
    if (event.replay) {
      if (previous && previous.generation === event.generation && previous.candidateId !== event.candidateId) return state;
      if (previous && previous.generation === event.generation && event.sequence < previous.sequence) return state;
      if (previous && previous.generation === event.generation &&
          ['completed', 'cancelled', 'error'].includes(previous.state) && event.state !== previous.state) return state;
      if (typeof event.text !== 'string') return state;
      return {
        candidateGeneration: Math.max(state.candidateGeneration, event.generation),
        candidate: {
          pairingId: event.pairingId,
          bridgeId: event.bridgeId,
          sessionId: event.sessionId,
          pairEpoch: event.pairEpoch,
          candidateId: event.candidateId,
          generation: event.generation,
          baseEntryId: event.baseEntryId,
          snapshotSequence: event.snapshotSequence,
          sequence: event.sequence,
          state: event.state,
          modelId: event.modelId,
          text: event.text,
          ...(event.errorCode ? { errorCode: event.errorCode } : {}),
        },
      };
    }
    if (event.generation > state.candidateGeneration) {
      if (event.state !== 'pending' || event.sequence !== 0) return state;
    } else if (previous) {
      if (previous.generation !== event.generation || previous.candidateId !== event.candidateId ||
          event.sequence <= previous.sequence || ['completed', 'cancelled', 'error'].includes(previous.state)) return state;
      if (event.sequence !== previous.sequence + 1) {
        return { candidate: { ...previous, state: 'error', errorCode: 'stale_session' } };
      }
    } else return state;
    const text = event.state === 'pending' ? '' : previous?.candidateId === event.candidateId
      ? previous.text + (event.delta ?? '')
      : event.delta ?? '';
    if (new TextEncoder().encode(text).byteLength > 64 * 1024) return state;
    return {
      candidateGeneration: Math.max(state.candidateGeneration, event.generation),
      candidate: {
        pairingId: event.pairingId,
        bridgeId: event.bridgeId,
        sessionId: event.sessionId,
        pairEpoch: event.pairEpoch,
        candidateId: event.candidateId,
        generation: event.generation,
        baseEntryId: event.baseEntryId,
        snapshotSequence: event.snapshotSequence,
        sequence: event.sequence,
        state: event.state,
        modelId: event.modelId,
        text,
        ...(event.errorCode ? { errorCode: event.errorCode } : {}),
      },
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
      candidateGeneration: 0,
      connection,
      snapshot: null,
      candidate: null,
      lastReceivedAt: null,
      error: null,
    };
  }),
}));
