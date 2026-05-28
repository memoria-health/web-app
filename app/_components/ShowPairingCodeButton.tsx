'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';

/// "Show pairing code" affordance for an UNPAIRED camera. Lives on the
/// camera detail page in the "Awaiting pairing" card. Clicking opens a
/// modal that calls `POST /v1/cameras/{id}/pairing-code` to mint a
/// fresh 6-digit code + countdown, so a caregiver who dismissed the
/// original sheet (or whose code expired) can resume pairing without
/// deleting + recreating the camera.
///
/// The page itself is responsible for hiding this button once
/// `camera.paired` flips to true (which happens via realtime UPDATE
/// after the wall phone calls `/v1/cameras/pair`).
export function ShowPairingCodeButton({
  cameraId,
  room,
}: {
  cameraId: string;
  room: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Refresh the server-rendered detail page on every modal close.
  // The page reads `camera.paired` from `api.listCameras` server-side
  // and renders the "Awaiting pairing" card based on it — without an
  // explicit re-fetch the user would still see that card after the
  // wall phone paired (since this detail page has no realtime
  // subscription of its own). The other two surfaces — VideoGrid
  // and CameraList — DO subscribe to realtime, so they update
  // independently; this is the gap-filler for THIS page.
  function close() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-ink transition-colors hover:bg-ink2"
      >
        Show pairing code
      </button>
      {open && (
        <PairingCodeModal
          cameraId={cameraId}
          room={room}
          onClose={close}
        />
      )}
    </>
  );
}

type SheetState =
  | { kind: 'loading' }
  | { kind: 'ready'; code: string; expiresAt: Date }
  | { kind: 'error'; message: string };

function PairingCodeModal({
  cameraId,
  room,
  onClose,
}: {
  cameraId: string;
  room: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<SheetState>({ kind: 'loading' });
  const [tick, setTick] = useState(0);

  // Mint the code as soon as the modal opens. Each modal-open is a
  // fresh regenerate request, mirroring how the iOS PairingCodeSheet
  // calls `createPairingCode` on .task — any prior code is invalidated,
  // which is correct since no one entered it.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await getBrowserNemara().regeneratePairingCode(cameraId);
        if (cancelled) return;
        setState({
          kind: 'ready',
          code: resp.pairing_code,
          expiresAt: new Date(resp.expires_at),
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cameraId]);

  // 1s ticker just to force the countdown text to refresh.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state.kind]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-line bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-1">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
            Pair a wall phone
          </p>
          <h2 className="font-serif text-2xl text-ink">{room}</h2>
        </header>

        <div className="my-6 flex flex-col items-center gap-2 py-4">
          {state.kind === 'loading' && (
            <span className="text-base text-ink3">Generating code…</span>
          )}
          {state.kind === 'ready' && (
            <>
              <code className="font-mono text-5xl font-bold tracking-[0.4em] text-ink">
                {state.code}
              </code>
              <span className="text-sm text-ink3">
                {countdown(state.expiresAt, tick)}
              </span>
            </>
          )}
          {state.kind === 'error' && (
            <span className="text-sm text-terra-deep">{state.message}</span>
          )}
        </div>

        <p className="mb-5 text-sm text-ink2">
          Open the NemaraCam app on the wall phone, tap{' '}
          <strong>Pair a phone</strong>, and enter this 6-digit code.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md border border-line bg-card-alt px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function countdown(expiresAt: Date, _tick: number): string {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return 'expired — close and reopen for a fresh code';
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `expires in ${m}:${s.toString().padStart(2, '0')}`;
}
