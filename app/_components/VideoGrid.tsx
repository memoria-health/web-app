'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { getBrowserNemara } from '@/lib/api/client';

interface EnabledCamera {
  id: string;        // backend cameras.id — needed for the menu API calls
  identity: string;  // matches participant identity once the wall phone joins
  room: string;      // human-readable name shown above each tile
  // Each tile is "reserved" in the grid regardless of state — these
  // two flags drive the in-tile placeholder + the menu's labels.
  disabled: boolean;
  desired_state: 'connected' | 'disconnected';
}

function GridInner({ enabledCameras }: { enabledCameras: EnabledCamera[] }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true },
  );

  // Index tracks by participant identity so we can render one tile per
  // EXPECTED camera (not per active track). This way each camera always
  // gets its own grid cell — joined cameras show video, not-yet-joined
  // cameras show a placeholder. With the LiveKit GridLayout we used to
  // use, the layout would shift around as cameras joined/left; this is
  // calmer and lets the user predict where each camera lives.
  const trackByIdentity = new Map<string, (typeof tracks)[number]>();
  for (const t of tracks) {
    if (!trackByIdentity.has(t.participant.identity)) {
      trackByIdentity.set(t.participant.identity, t);
    }
  }

  if (enabledCameras.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line bg-card text-base text-ink3">
        No cameras. Pair a wall phone from /cameras.
      </div>
    );
  }

  // 2-col grid that wraps. 1 camera → just one cell on the left, half-window-width.
  // 2 → side by side. 3 → 2 on row 1, 1 on row 2. And so on.
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {enabledCameras.map((cam) => {
        const trackRef = trackByIdentity.get(cam.identity);
        return (
          <div
            key={cam.id}
            className="flex flex-col gap-2"
            data-camera-identity={cam.identity}
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-xl text-ink">{cam.room}</span>
              <span className="font-mono text-xs text-ink4 tracking-wide">
                {cam.identity}
              </span>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-paper-dim">
              <CameraTileBody
                disabled={cam.disabled}
                desiredState={cam.desired_state}
                trackRef={trackRef}
              />
              <CameraTileMenu
                cameraId={cam.id}
                cameraRoom={cam.room}
                disabled={cam.disabled}
                desiredState={cam.desired_state}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/// What renders inside the tile's aspect-video box, based on the camera's
/// state. Precedence: disconnected > hidden > video > waiting. We don't
/// render a ParticipantTile for hidden/disconnected cameras — the
/// caregiver chose to stop monitoring them, no point loading the video.
function CameraTileBody({
  disabled,
  desiredState,
  trackRef,
}: {
  disabled: boolean;
  desiredState: 'connected' | 'disconnected';
  // The LiveKit track type — kept loose because the GridInner-internal
  // shape isn't exported. Only used as: present → render ParticipantTile.
  trackRef: Parameters<typeof ParticipantTile>[0]['trackRef'] | undefined;
}) {
  if (desiredState === 'disconnected') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-ink3">
        <span className="font-serif text-xl text-ink2">Disconnected</span>
        <span className="text-xs text-ink4">
          Phone left LiveKit. Click ⋯ → Reconnect.
        </span>
      </div>
    );
  }
  if (disabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-ink3">
        <span className="font-serif text-xl text-ink2">Hidden</span>
        <span className="text-xs text-ink4">
          AI paused. Click ⋯ → Show to resume.
        </span>
      </div>
    );
  }
  if (trackRef) {
    return <ParticipantTile trackRef={trackRef} />;
  }
  return (
    <div className="flex h-full items-center justify-center text-base text-ink4 italic">
      Waiting for camera to join…
    </div>
  );
}

/// Per-tile overflow menu. Always shows two toggles with state-aware
/// labels:
///
///   - Hide ↔ Show      (toggles `cameras.disabled`)
///   - Disconnect ↔ Reconnect (toggles `cameras.desired_state`)
///
/// The menu is the only way to leave AND re-enter both states from
/// the live grid — tiles stay in place regardless of state so the
/// caregiver can always reach the ⋯ button. Confirm dialog fires
/// only on the connecting→disconnecting direction (the destructive
/// one); reconnecting is harmless.
function CameraTileMenu({
  cameraId,
  cameraRoom,
  disabled,
  desiredState,
}: {
  cameraId: string;
  cameraRoom: string;
  disabled: boolean;
  desiredState: 'connected' | 'disconnected';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Click outside the menu closes it. Listener only attached while
  // the menu is open so we don't churn document handlers.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  /// Toggle `disabled`. Both directions are instant + reversible —
  /// no confirm dialog. Phone keeps publishing either way (this only
  /// gates LLM calls + dashboard visibility, not the LiveKit
  /// connection itself).
  ///
  /// `finally { setBusy(false) }` matters here: the component stays
  /// MOUNTED across the state change (reserved tile), so a stale
  /// `busy=true` would leave the button permanently disabled. Always
  /// clear it, success or failure.
  async function handleToggleHide(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    setErr(null);
    try {
      await getBrowserNemara().updateCamera(cameraId, { disabled: !disabled });
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  /// Toggle `desired_state`. Confirm only when going FROM connected
  /// TO disconnected — that's the destructive direction (LiveKit
  /// connection drops, reconnect takes ~1-2s of polling). Going BACK
  /// to connected is one click — no confirm needed.
  ///
  /// Same `finally { setBusy(false) }` reasoning as handleToggleHide.
  async function handleToggleDisconnect(e: React.MouseEvent) {
    e.stopPropagation();
    if (desiredState === 'connected') {
      if (!window.confirm(
        `Disconnect ${cameraRoom}? The wall phone will leave LiveKit ` +
        `entirely. No video, no AI calls, no LiveKit costs. Reconnect ` +
        `takes ~1-2s.`,
      )) return;
    }
    setBusy(true);
    setErr(null);
    const next = desiredState === 'connected' ? 'disconnected' : 'connected';
    try {
      await getBrowserNemara().updateCamera(cameraId, { desired_state: next });
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  // State-derived labels for the buttons. Helper text underneath
  // explains the wire effect so users learn the difference between
  // Hide (instant) and Disconnect (LiveKit reconnect).
  const hideShowLabel = busy
    ? disabled ? 'Showing…' : 'Hiding…'
    : disabled ? 'Show camera' : 'Hide camera';
  const hideShowSubtitle = disabled
    ? 'Resume AI calls. Instant.'
    : 'Pause AI calls. LiveKit stays connected.';

  const dcLabel = busy
    ? desiredState === 'disconnected' ? 'Reconnecting…' : 'Disconnecting…'
    : desiredState === 'disconnected' ? 'Reconnect' : 'Disconnect (privacy)';
  const dcSubtitle = desiredState === 'disconnected'
    ? 'Phone rejoins LiveKit (~1-2s).'
    : 'Phone leaves LiveKit. ~1-2s reconnect.';

  return (
    <div className="absolute right-2 top-2 z-50">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={busy}
        aria-label={`Options for ${cameraRoom}`}
        title="Camera options"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line/60 bg-card/90 text-ink backdrop-blur hover:border-line hover:bg-card disabled:opacity-50"
      >
        <span className="text-base leading-none">⋯</span>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 min-w-[12rem] overflow-hidden rounded-md border border-line bg-card shadow-lg"
        >
          <button
            type="button"
            onClick={handleToggleHide}
            disabled={busy}
            className="block w-full px-3 py-2.5 text-left text-base text-ink hover:bg-paper-dim disabled:opacity-50"
          >
            {hideShowLabel}
            <div className="mt-0.5 text-xs font-normal leading-tight text-ink3">
              {hideShowSubtitle}
            </div>
          </button>
          <button
            type="button"
            onClick={handleToggleDisconnect}
            disabled={busy}
            className={
              desiredState === 'disconnected'
                ? 'block w-full border-t border-line px-3 py-2.5 text-left text-sm text-success hover:bg-card-alt disabled:opacity-50'
                : 'block w-full border-t border-line px-3 py-2.5 text-left text-sm text-terra hover:bg-terra-soft/60 disabled:opacity-50'
            }
          >
            {dcLabel}
            <div
              className={
                desiredState === 'disconnected'
                  ? 'mt-0.5 text-xs font-normal leading-tight text-success/80'
                  : 'mt-0.5 text-xs font-normal leading-tight text-terra/80'
              }
            >
              {dcSubtitle}
            </div>
          </button>
        </div>
      )}
      {err && (
        <div className="absolute right-0 top-full mt-1 max-w-[14rem] rounded-md border border-terra/40 bg-terra-soft px-2.5 py-1.5 text-xs text-terra-deep">
          {err}
        </div>
      )}
    </div>
  );
}

export function VideoGrid({
  token,
  serverUrl,
  enabledCameras,
}: {
  token: string;
  serverUrl: string;
  enabledCameras: EnabledCamera[];
}) {
  if (!token) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line bg-card text-base text-ink3">
        No LiveKit token available
      </div>
    );
  }
  // Short-circuit: if NO paired cameras at all (patient.cameras_paused
  // or zero paired phones), skip the LiveKit connection. Saves a
  // WebSocket + token round-trip. Note this is the FULL list of
  // paired cameras now (including hidden + disconnected), not just
  // visible ones — tiles for hidden/disconnected still render inside
  // GridInner so the user can re-enable from the ⋯ menu.
  if (enabledCameras.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line bg-card text-base text-ink3">
        No cameras yet. Pair a wall phone from /cameras.
      </div>
    );
  }
  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      audio={false}
      video={false}
      data-lk-theme="default"
    >
      <GridInner enabledCameras={enabledCameras} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
