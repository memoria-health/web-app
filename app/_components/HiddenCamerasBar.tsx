'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import type { Camera } from '@/lib/api/types';

/// Pill row of currently-not-visible cameras shown below the live grid.
///
/// Two state flavors with different action labels:
///   - Hidden  (cameras.disabled=true)        → "show"    [instant]
///   - Off     (cameras.desired_state='disconnected') → "reconnect" [~1-2s]
///
/// Both call PATCH /v1/cameras/{id} with the inverse flag, then
/// router.refresh() so the home page re-fetches and the camera pops
/// back into the live grid.
///
/// Rendered only when at least one camera is in one of these states;
/// takes zero space otherwise.
export function HiddenCamerasBar({
  hiddenCameras,
  disconnectedCameras,
}: {
  hiddenCameras: Pick<Camera, 'id' | 'room'>[];
  disconnectedCameras: Pick<Camera, 'id' | 'room'>[];
}) {
  if (hiddenCameras.length === 0 && disconnectedCameras.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {hiddenCameras.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink3">
            Hidden ({hiddenCameras.length}):
          </span>
          {hiddenCameras.map((cam) => (
            <CameraActionPill
              key={`hide-${cam.id}`}
              camera={cam}
              variant="hidden"
            />
          ))}
        </div>
      )}
      {disconnectedCameras.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink3">
            Disconnected ({disconnectedCameras.length}):
          </span>
          {disconnectedCameras.map((cam) => (
            <CameraActionPill
              key={`reconnect-${cam.id}`}
              camera={cam}
              variant="disconnected"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CameraActionPill({
  camera,
  variant,
}: {
  camera: Pick<Camera, 'id' | 'room'>;
  variant: 'hidden' | 'disconnected';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act() {
    setBusy(true);
    setErr(null);
    try {
      // The two variants invert different fields:
      //   hidden       → disabled=false       (instant)
      //   disconnected → desired_state='connected'  (~1-2s; phone polls)
      const patch =
        variant === 'hidden'
          ? { disabled: false }
          : { desired_state: 'connected' as const };
      await getBrowserNemara().updateCamera(camera.id, patch);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      // Always clear busy — if this component is ever rendered in a
      // context where it doesn't unmount on state change, leaving
      // busy=true would permanently disable the button. Same bug
      // pattern that bit the reserved-tile VideoGrid menu.
      setBusy(false);
    }
  }

  const label =
    variant === 'hidden'
      ? busy
        ? '…'
        : err
          ? 'retry'
          : 'show'
      : busy
        ? '…'
        : err
          ? 'retry'
          : 'reconnect';

  const hoverClasses =
    variant === 'hidden'
      ? 'hover:border-success/40 hover:bg-card-alt hover:text-success'
      : 'hover:border-warning/40 hover:bg-card-alt hover:text-warning';

  return (
    <button
      type="button"
      onClick={act}
      disabled={busy}
      title={
        err
          ? `Couldn't ${variant === 'hidden' ? 'show' : 'reconnect'}: ${err}`
          : variant === 'hidden'
            ? `Show ${camera.room} again`
            : `Reconnect ${camera.room} — phone will rejoin LiveKit (~1-2s)`
      }
      className={`inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1 font-mono text-xs text-ink2 disabled:opacity-50 transition-colors ${hoverClasses}`}
    >
      <span>{camera.room}</span>
      <span className="text-ink4">·</span>
      <span className="font-semibold uppercase tracking-wider">{label}</span>
    </button>
  );
}
