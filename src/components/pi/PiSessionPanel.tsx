import { useEffect, useRef, useState } from 'react';
import { Link2, PlugZap, ShieldAlert, X } from 'lucide-react';
import {
  cancelPiPairingCode,
  claimPiPairingCode,
  getPiSessionSnapshot,
  PiSessionApiError,
  readPiSessionStream,
  revokePiSession,
  sendPiSessionHeartbeat,
} from '../../api/piSessions';
import { usePiSessionStore } from '../../store/usePiSessionStore';
import type { PiSessionStreamEvent } from '../../types/piSession';

interface PiSessionPanelProps {
  onClose: () => void;
}

function formatSessionId(value: string | null): string {
  if (!value) return 'Waiting for Pi';
  return value.length > 12 ? `…${value.slice(-8)}` : value;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    function abort() {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

export function PiSessionPanel({ onClose }: PiSessionPanelProps) {
  const capability = usePiSessionStore((s) => s.capability);
  const sessionId = usePiSessionStore((s) => s.sessionId);
  const connection = usePiSessionStore((s) => s.connection);
  const snapshot = usePiSessionStore((s) => s.snapshot);
  const lastReceivedAt = usePiSessionStore((s) => s.lastReceivedAt);
  const error = usePiSessionStore((s) => s.error);
  const setPairing = usePiSessionStore((s) => s.setPairing);
  const setSnapshot = usePiSessionStore((s) => s.setSnapshot);
  const setConnection = usePiSessionStore((s) => s.setConnection);
  const clearPairing = usePiSessionStore((s) => s.clearPairing);
  const pairingId = usePiSessionStore((s) => s.pairingId);

  const mounted = useRef(false);
  const claimController = useRef<AbortController | null>(null);
  const streamController = useRef<AbortController | null>(null);
  const heartbeatController = useRef<AbortController | null>(null);
  const pairingCodeRef = useRef('');
  const [pairingCode, setPairingCodeValue] = useState('');
  const [consent, setConsent] = useState(false);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [retryNumber, setRetryNumber] = useState(0);
  const normalizedCode = pairingCode.trim().replace(/[-\s]/g, '').toUpperCase();
  const codeIsValid = /^[0-9A-F]{32}$/.test(normalizedCode);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      claimController.current?.abort();
      claimController.current = null;
      streamController.current?.abort();
      heartbeatController.current?.abort();
      const current = usePiSessionStore.getState();
      if (current.capability && current.pairingId) {
        current.clearPairing('revoked', current.pairingId);
        void revokePiSession(current.capability).catch(() => undefined);
      }
      const pendingCode = pairingCodeRef.current.trim().replace(/[-\s]/g, '').toUpperCase();
      if (/^[0-9A-F]{32}$/.test(pendingCode)) {
        void cancelPiPairingCode(pendingCode).catch(() => undefined);
      }
      pairingCodeRef.current = '';
    };
  }, []);

  useEffect(() => {
    if (!capability || !pairingId) return;
    const controller = new AbortController();
    streamController.current = controller;
    let stopAfterStream = false;
    let retryDelay = 1_000;

    const onEvent = (event: PiSessionStreamEvent) => {
      if (event.type === 'snapshot') {
        setSnapshot(event.snapshot);
        setConnection('connected', undefined, pairingId);
      } else {
        if (event.pairingId !== pairingId) return;
        stopAfterStream = true;
        clearPairing('revoked', pairingId);
      }
    };

    const run = async () => {
      while (!controller.signal.aborted && !stopAfterStream) {
        try {
          const initial = await getPiSessionSnapshot(capability, controller.signal);
          if (initial) setSnapshot(initial);
          setConnection('connected', undefined, pairingId);
          await readPiSessionStream(capability, controller.signal, onEvent);
          if (stopAfterStream || controller.signal.aborted) return;
          setConnection('disconnected', 'The Pi connection closed. The last snapshot may be stale.', pairingId);
        } catch (caught) {
          if (controller.signal.aborted) return;
          if (caught instanceof PiSessionApiError && [401, 403, 410].includes(caught.statusCode ?? 0)) {
            clearPairing('expired', pairingId);
            return;
          }
          setConnection('disconnected', 'Baobab cannot reach the Pi session. The last snapshot may be stale.', pairingId);
        }
        try {
          await wait(retryDelay, controller.signal);
        } catch {
          return;
        }
        retryDelay = Math.min(retryDelay * 2, 30_000);
      }
    };

    void run();
    return () => {
      if (streamController.current === controller) streamController.current = null;
      controller.abort();
    };
  }, [capability, pairingId, retryNumber, setConnection, setSnapshot, clearPairing]);

  useEffect(() => {
    if (!capability || !pairingId) return;
    const controller = new AbortController();
    heartbeatController.current = controller;
    let heartbeatPending = false;
    const heartbeat = async () => {
      if (heartbeatPending || controller.signal.aborted) return;
      heartbeatPending = true;
      try {
        await sendPiSessionHeartbeat(capability, controller.signal);
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (caught instanceof PiSessionApiError && [401, 403, 410].includes(caught.statusCode ?? 0)) {
          clearPairing('expired', pairingId);
        } else {
          setConnection('disconnected', 'The browser lease could not renew. The pairing will expire if it stays offline.', pairingId);
        }
      } finally {
        heartbeatPending = false;
      }
    };
    void heartbeat();
    const timer = setInterval(() => void heartbeat(), 30_000);
    return () => {
      clearInterval(timer);
      if (heartbeatController.current === controller) heartbeatController.current = null;
      controller.abort();
    };
  }, [capability, pairingId, clearPairing, setConnection]);

  const handlePair = async () => {
    if (!codeIsValid || !consent || pairingBusy) return;
    setPairingBusy(true);
    setPairingError(null);
    const controller = new AbortController();
    claimController.current = controller;
    try {
      const result = await claimPiPairingCode(normalizedCode, controller.signal);
      if (controller.signal.aborted || !mounted.current || claimController.current !== controller) {
        void revokePiSession(result.capability).catch(() => undefined);
        void cancelPiPairingCode(normalizedCode).catch(() => undefined);
        return;
      }
      setPairing(result);
      setPairingCodeValue('');
      pairingCodeRef.current = '';
      setConsent(false);
    } catch (caught) {
      void cancelPiPairingCode(normalizedCode).catch(() => undefined);
      if (!controller.signal.aborted && mounted.current) {
        setPairingError(caught instanceof Error ? caught.message : 'Pairing failed.');
      }
    } finally {
      if (claimController.current === controller) claimController.current = null;
      if (!controller.signal.aborted && mounted.current) setPairingBusy(false);
    }
  };

  const handleRevoke = () => {
    const current = usePiSessionStore.getState();
    if (!current.capability || !current.pairingId) return;
    const capability = current.capability;
    streamController.current?.abort();
    heartbeatController.current?.abort();
    clearPairing('revoked', current.pairingId);
    void revokePiSession(capability).catch(() => {
      if (mounted.current) setPairingError('Baobab could not confirm revocation. The Pi lease will expire if it cannot renew.');
    });
  };

  const handleClose = () => {
    claimController.current?.abort();
    claimController.current = null;
    if (codeIsValid) void cancelPiPairingCode(normalizedCode).catch(() => undefined);
    pairingCodeRef.current = '';
    streamController.current?.abort();
    heartbeatController.current?.abort();
    const current = usePiSessionStore.getState();
    if (current.capability && current.pairingId) {
      clearPairing('revoked', current.pairingId);
      void revokePiSession(current.capability).catch(() => undefined);
    }
    onClose();
  };

  const statusLabel = connection === 'connected'
    ? 'Connected · read only'
    : connection === 'connecting'
      ? 'Connecting'
      : connection === 'disconnected'
        ? 'Disconnected'
        : connection === 'expired' || connection === 'revoked'
          ? 'Pairing ended'
          : 'Not paired';

  return (
    <aside className="h-full w-[340px] shrink-0 border-l border-[var(--color-border-soft)] bg-[var(--color-bg)] flex flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <Link2 size={14} /> Pi session
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
          aria-label="Close Pi session panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connection === 'connected' ? 'bg-[var(--color-reply-target)]' : connection === 'disconnected' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-text-muted)]'}`} />
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{statusLabel}</span>
          {connection === 'connected' && <span className="ml-auto rounded-full bg-[var(--color-bg-secondary)] px-2 py-1 text-[10px] text-[var(--color-text-muted)]">Local · read only</span>}
        </div>

        {!capability ? (
          <>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Pair this Pi session</div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                In Pi, run <code>/baobab pair</code>. Enter the one-time code shown in the Pi TUI. The code authorizes only that Pi session.
              </p>
              <label htmlFor="pi-pairing-code" className="mt-3 block text-[10px] font-semibold text-[var(--color-text-secondary)]">One-time pairing code</label>
              <input
                id="pi-pairing-code"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={pairingCode}
                onChange={(event) => {
                  setPairingCodeValue(event.target.value);
                  pairingCodeRef.current = event.target.value;
                }}
                placeholder="32 hexadecimal characters"
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2 font-mono text-xs text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">The code expires after five minutes and works once. It is not saved in browser storage.</p>
            </div>

            <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[var(--color-text)]"><ShieldAlert size={13} /> Sharing scope</div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                After approval, Baobab receives visible user and assistant text from the active branch and later turns. System messages, tool calls/results, and non-text attachments are excluded. Paths and secrets in text may still be shared.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-warning)]">Visible text can contain secrets or private data. Review this scope before you approve.</p>
            </div>

            <label className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
              <span>I approve sending visible text from this Pi session to local Baobab.</span>
            </label>

            {pairingError && <div role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">{pairingError}</div>}
            {connection === 'expired' && <div className="mt-3 rounded-md bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">The previous pairing ended. Enter a new code from Pi.</div>}
            {connection === 'revoked' && <div className="mt-3 rounded-md bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">The pairing was revoked and the cached snapshot was cleared.</div>}

            <button
              type="button"
              onClick={handlePair}
              disabled={!codeIsValid || !consent || pairingBusy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 hover:bg-[var(--color-accent-hover)]"
            >
              <PlugZap size={14} /> {pairingBusy ? 'Pairing…' : 'Approve and connect'}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Paired session</div>
              <div className="mt-2 font-mono text-xs text-[var(--color-text)]">{formatSessionId(sessionId)}</div>
              <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">Capability remains in memory only.</div>
            </div>

            {connection === 'disconnected' && (
              <div className="mt-3 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-3 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                <div>The view is stale. Baobab is retrying the local session stream. Revoke the pairing to clear this snapshot.</div>
                <button type="button" onClick={() => setRetryNumber((value) => value + 1)} className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">Reconnect now</button>
              </div>
            )}

            {error && <div role="status" className="mt-3 rounded-md bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">{error}</div>}

            {!snapshot ? (
              <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-xs text-[var(--color-text-secondary)]">
                Waiting for the first approved snapshot. No session text was transferred before approval.
              </div>
            ) : snapshot.state === 'sync_limited' ? (
              <div className="mt-4 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-3 text-xs text-[var(--color-warning)]">
                This branch exceeds the sync limit. Baobab received no partial snapshot.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                  <span>{snapshot.entryCount} visible entries</span>
                  <span>{snapshot.state === 'running' ? 'Pi is running' : 'Pi is idle'}</span>
                </div>
                <div className="max-h-[420px] space-y-2 overflow-y-auto">
                  {snapshot.entries.map((entry) => (
                    <article key={entry.id} className={`rounded-lg border border-[var(--color-border)] p-3 ${entry.role === 'user' ? 'bg-[var(--color-user-card)]' : 'bg-[var(--color-card)]'}`}>
                      <div className="mb-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">Pi · {entry.role}</div>
                      <div className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--color-text)]">{entry.text}</div>
                    </article>
                  ))}
                </div>
                <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">Visible text may contain secrets. Pi remains the source of truth. Baobab does not run Pi tools from this panel.</p>
              </div>
            )}

            {lastReceivedAt && <div className="mt-3 text-[10px] text-[var(--color-text-muted)]">Last sync: {new Date(lastReceivedAt).toLocaleTimeString()}</div>}
            <button
              type="button"
              onClick={handleRevoke}
              className="mt-4 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            >
              Revoke pairing and clear snapshot
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
