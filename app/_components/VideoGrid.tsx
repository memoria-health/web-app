'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AudioTrack,
  ParticipantTile,
  VideoTrack,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import type {
  RealtimePostgresUpdatePayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresDeletePayload,
} from '@supabase/supabase-js';
import { getBrowserNemara } from '@/lib/api/client';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';

interface EnabledCamera {
  id: string;        // backend cameras.id — needed for the menu API calls
  identity: string;  // matches participant identity once the wall phone joins
  room: string;      // human-readable name shown above each tile
  // Each tile is "reserved" in the grid regardless of state — these
  // flags drive the in-tile placeholder + the menu's labels.
  disabled: boolean;
  ai_paused: boolean;
  desired_state: 'connected' | 'disconnected';
  // False while no wall phone has completed the handshake. We render
  // an "Awaiting pairing" placeholder and skip the LiveKit subscription
  // since there's no published track yet.
  paired: boolean;
  // Backend liveness (publishing) — used only to keep "app closed" from
  // ever shadowing a live feed.
  online: boolean;
  // Whether the Memoria Sensor iPhone app is running (polling). false +
  // !online → "app closed" (open the app), distinct from a reconnectable
  // "Disconnected". Only false for iPhone sensors; Pi stays true.
  app_present: boolean;
}

function GridInner({ enabledCameras }: { enabledCameras: EnabledCamera[] }) {
  // The LiveKit room — used to resume the browser AudioContext on a user
  // gesture (see toggleAudio). GridInner only renders inside <LiveKitRoom>
  // (useTracks below requires it too), so this is always available here.
  const room = useRoomContext();
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true },
  );
  // Same hook, microphone source. Each wall phone publishes one mic
  // track; the AudioTrack component renders it iff the caregiver
  // unmuted that tile via the speaker toggle. Default state below is
  // "all muted" — caregivers explicitly opt in to listening per camera.
  const audioTracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: false }],
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
  const audioByIdentity = new Map<string, (typeof audioTracks)[number]>();
  for (const t of audioTracks) {
    if (!audioByIdentity.has(t.participant.identity)) {
      audioByIdentity.set(t.participant.identity, t);
    }
  }

  // Per-tile audio unmute state, keyed by participant identity. Default
  // is muted for every camera ("all rooms silent unless I opt in").
  const [audioUnmuted, setAudioUnmuted] = useState<Set<string>>(new Set());
  const toggleAudio = (identity: string) => {
    // Resume the browser AudioContext on THIS user gesture. Removing
    // RoomAudioRenderer (so per-tile mute could work) also removed LiveKit's
    // autoplay-unlock, leaving the AudioContext suspended ("could not playback
    // audio"). `startAudio()` must be called from a gesture; the toggle click
    // is one. Idempotent + harmless once audio is already unlocked, so we call
    // it on every toggle (the unmute case is the one that matters).
    void room.startAudio().catch(() => {});
    setAudioUnmuted((prev) => {
      const next = new Set(prev);
      if (next.has(identity)) next.delete(identity);
      else next.add(identity);
      return next;
    });
  };

  if (enabledCameras.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line bg-card text-base text-ink3">
        No sensors. Pair a Memoria Sensor from the Sensors tab.
      </div>
    );
  }

  // 2-col grid that wraps. 1 camera → just one cell on the left, half-window-width.
  // 2 → side by side. 3 → 2 on row 1, 1 on row 2. And so on.
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {enabledCameras.map((cam) => {
        const trackRef = trackByIdentity.get(cam.identity);
        const audioRef = audioByIdentity.get(cam.identity);
        const isAudible = audioUnmuted.has(cam.identity);
        // The Memoria Sensor app is shut on the phone: not publishing and
        // its 1s heartbeat stopped. Reconnect can't help — the phone isn't
        // polling — so the tile + menu say "open the app". `app_present`
        // is only ever false for iPhone sensors (Pi has no app to close).
        const appClosed = !cam.online && cam.app_present === false;
        // Always mount AudioTrack when an audio track exists; use the
        // `volume` prop to gate audible output (0 = silent, 1 = audible).
        // Conditional mount/unmount of `<AudioTrack>` was causing a
        // "mute once, can't mute back" symptom — the <audio> element
        // toggling in/out of the DOM seemed to interfere with the next
        // click's hit detection on the same tile. Volume-gating mirrors
        // the iOS LiveKitClient pattern (track stays subscribed, volume
        // toggled) and removes the churn.
        return (
          <div
            key={cam.id}
            className="flex flex-col gap-2"
            data-camera-identity={cam.identity}
          >
            <div>
              <span className="font-serif text-xl text-ink">{cam.room}</span>
            </div>
            {/* Outer wrapper is positioned but NOT overflow-hidden, so
                the ⋯ dropdown can escape the tile bounds on narrow
                widths instead of getting clipped. The aspect-video div
                inside keeps overflow-hidden for the video's rounded
                corners. */}
            <div className="relative">
              <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-paper-dim">
                <CameraTileBody
                  paired={cam.paired}
                  disabled={cam.disabled}
                  aiPaused={cam.ai_paused}
                  desiredState={cam.desired_state}
                  appClosed={appClosed}
                  trackRef={trackRef}
                />
                {/* Per-tile audio — the ONLY audio sink now that
                    RoomAudioRenderer is removed (see LiveRoomProvider). `volume`
                    gates audibility from the per-tile mute toggle. */}
                {audioRef && (
                  <AudioTrack
                    trackRef={audioRef as Parameters<typeof AudioTrack>[0]['trackRef']}
                    volume={isAudible ? 1.0 : 0.0}
                  />
                )}
              </div>
              <CameraTileAudioButton
                cameraRoom={cam.room}
                hasAudioTrack={!!audioRef}
                isAudible={isAudible}
                onToggle={() => toggleAudio(cam.identity)}
              />
              <CameraTileMenu
                cameraId={cam.id}
                cameraRoom={cam.room}
                disabled={cam.disabled}
                aiPaused={cam.ai_paused}
                desiredState={cam.desired_state}
                appClosed={appClosed}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/// What renders inside the tile's aspect-video box, based on the camera's
/// state. Precedence: disconnected > hidden > video (with optional AI-paused
/// overlay) > waiting. We don't render a ParticipantTile for
/// hidden/disconnected cameras — the caregiver chose to stop monitoring
/// them, no point loading the video. For `ai_paused` we still show the
/// live video; only the AI tick is skipped, so the overlay pill hints
/// at the suspended detection.
function CameraTileBody({
  paired,
  disabled,
  aiPaused,
  desiredState,
  appClosed,
  trackRef,
}: {
  paired: boolean;
  disabled: boolean;
  aiPaused: boolean;
  desiredState: 'connected' | 'disconnected';
  // iPhone sensor whose Memoria Sensor app is closed (not online +
  // heartbeat stopped). Reconnect can't help; tell the user to reopen
  // the app. Takes precedence over the reconnectable "Disconnected".
  appClosed: boolean;
  // The LiveKit track type — kept loose because the GridInner-internal
  // shape isn't exported. Only used as: present → render ParticipantTile.
  trackRef: Parameters<typeof ParticipantTile>[0]['trackRef'] | undefined;
}) {
  // "Awaiting pairing" beats every other state — there literally is no
  // wall phone publishing yet, so nothing else can be true.
  if (!paired) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="font-serif text-xl text-ink2">Awaiting pairing</span>
        <span className="text-sm text-ink3">
          Open this sensor in /cameras to view the 6-digit code.
        </span>
      </div>
    );
  }
  // App closed beats "Disconnected": the phone isn't running, so the ⋯
  // Reconnect won't bring it back — the caregiver must reopen the app.
  if (appClosed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-ink3">
        <span className="font-serif text-xl text-ink2">Sensor app closed</span>
        <span className="text-xs text-ink4">
          Open Memoria Sensor on the camera phone
        </span>
      </div>
    );
  }
  if (desiredState === 'disconnected') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-ink3">
        <span className="font-serif text-xl text-ink2">Disconnected</span>
        <span className="text-xs text-ink4">Click ⋯ to reconnect</span>
      </div>
    );
  }
  if (disabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-ink3">
        <span className="font-serif text-xl text-ink2">Hidden</span>
        <span className="text-xs text-ink4">
          Tile hidden + AI paused. Click ⋯ → Show to resume.
        </span>
      </div>
    );
  }
  if (trackRef) {
    // `VideoTrack` is the bare-bones renderer — just the <video> tag
    // bound to the LiveKit track. Switched from `ParticipantTile` so
    // we don't get LiveKit's default participant-name overlay + audio
    // indicator bar at the bottom, which was eating ~30px of the
    // visible frame. The video fills the aspect-video container via
    // object-cover (cropping minor letterboxing if the camera's
    // intrinsic ratio differs from 16:9).
    //
    // We only enter this branch when trackRef is truthy AND the
    // subscription is live (`useTracks` was called with
    // `withPlaceholder: false`), so a cast to VideoTrack's stricter
    // `TrackReference` (publication required) is safe.
    return (
      <div className="relative h-full w-full">
        <VideoTrack
          trackRef={trackRef as Parameters<typeof VideoTrack>[0]['trackRef']}
          className="h-full w-full object-cover"
        />
        {aiPaused && (
          <div className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-sm border border-warning/40 bg-card-alt/90 px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-warning backdrop-blur">
            AI Paused
          </div>
        )}
      </div>
    );
  }
  // Paired, intended-on, not hidden, but no video track yet — the sensor
  // is coming up (cold connect or a reconnect). Show an active buffering
  // state so the gap reads as "connecting", not "nothing happened".
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-ink4">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-ink4/30 border-t-ink2"
        aria-hidden
      />
      <span className="text-base italic">Connecting — this can take a moment.</span>
    </div>
  );
}

/// Per-tile audio mute toggle. Sits in the top-left of the tile so it
/// doesn't collide with the ⋯ menu in the top-right. Disabled (greyed +
/// not clickable) when there's no audio track on the publisher yet —
/// useful state for the caregiver to know "this camera isn't sending
/// mic data, can't unmute."
function CameraTileAudioButton({
  cameraRoom,
  hasAudioTrack,
  isAudible,
  onToggle,
}: {
  cameraRoom: string;
  hasAudioTrack: boolean;
  isAudible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!hasAudioTrack) return;
        onToggle();
      }}
      disabled={!hasAudioTrack}
      aria-pressed={isAudible}
      aria-label={
        !hasAudioTrack
          ? `${cameraRoom} has no audio yet`
          : isAudible
            ? `Mute ${cameraRoom} audio`
            : `Unmute ${cameraRoom} audio`
      }
      title={
        !hasAudioTrack
          ? 'No audio track yet'
          : isAudible
            ? 'Mute'
            : 'Unmute'
      }
      className="absolute left-2 top-2 z-50 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line/60 bg-card/90 text-ink backdrop-blur hover:border-line hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
    >
      {/* Pure SVG so we don't drag in another icon dep. Speaker-with-
          waves for audible, speaker-with-slash for muted. */}
      {isAudible ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M3 6h2.5L8.5 3.5v9L5.5 10H3V6z" />
          <path d="M11 5.5a3 3 0 0 1 0 5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M12.5 4a5 5 0 0 1 0 8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M3 6h2.5L8.5 3.5v9L5.5 10H3V6z" />
          <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}


/// Per-tile overflow menu. Two state-aware toggles:
///
///   - Pause AI ↔ Resume AI    (toggles `cameras.ai_paused`)
///   - Disconnect ↔ Reconnect  (toggles `cameras.desired_state`)
///
/// (The old "Hide ↔ Show" toggle — `cameras.disabled` — was removed: the
/// caregiver's options are just Disconnect or Pause AI. The `disabled`
/// field still exists and is honored where read; it's no longer settable.)
///
/// Confirm dialog fires only on the connecting→disconnecting direction
/// (the destructive one); reconnecting is harmless.
function CameraTileMenu({
  cameraId,
  cameraRoom,
  disabled,
  aiPaused,
  desiredState,
  appClosed,
}: {
  cameraId: string;
  cameraRoom: string;
  disabled: boolean;
  aiPaused: boolean;
  desiredState: 'connected' | 'disconnected';
  // iPhone app closed: a "Reconnect" here is a no-op (the phone isn't
  // polling to hear it), so we disable that button and point the user
  // at the phone instead.
  appClosed: boolean;
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

  /// Toggle `ai_paused`. Video keeps streaming either way; only the
  /// LLM tick is skipped. Instant + reversible — no confirm dialog.
  /// Disabled while the camera is fully hidden (`disabled=true`)
  /// because in that state the AI is already paused by the stronger
  /// flag, and the menu item would be ambiguous.
  async function handleToggleAiPaused(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    setErr(null);
    try {
      await getBrowserNemara().updateCamera(cameraId, { ai_paused: !aiPaused });
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
  /// `finally { setBusy(false) }`: the tile stays MOUNTED across the
  /// state change (reserved tile), so a stale `busy=true` would leave the
  /// button permanently disabled. Always clear it, success or failure.
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

  // State-derived labels for the buttons.
  const aiLabel = busy
    ? aiPaused ? 'Resuming AI…' : 'Pausing AI…'
    : aiPaused ? 'Resume AI' : 'Pause AI';
  const aiSubtitle = aiPaused
    ? 'Resume AI tick. Video keeps streaming either way.'
    : 'Pause AI tick. Video keeps streaming.';

  const dcLabel = busy
    ? desiredState === 'disconnected' ? 'Reconnecting…' : 'Disconnecting…'
    : desiredState === 'disconnected' ? 'Reconnect' : 'Disconnect (privacy)';
  // When the app is closed, a Reconnect is a no-op (nothing on the phone
  // is polling to hear it) — disable it and point the user at the phone.
  const dcDisabledByAppClosed = appClosed && desiredState === 'disconnected';
  const dcSubtitle = dcDisabledByAppClosed
    ? 'App closed — open Memoria Sensor on the phone first.'
    : desiredState === 'disconnected'
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
        title="Sensor options"
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
            onClick={handleToggleAiPaused}
            disabled={busy || disabled || desiredState === 'disconnected'}
            className="block w-full px-3 py-2.5 text-left text-base text-ink hover:bg-paper-dim disabled:opacity-50"
          >
            {aiLabel}
            <div className="mt-0.5 text-xs font-normal leading-tight text-ink3">
              {aiSubtitle}
            </div>
          </button>
          <button
            type="button"
            onClick={handleToggleDisconnect}
            disabled={busy || dcDisabledByAppClosed}
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
  patientId,
  hasLivekitToken,
  enabledCameras,
}: {
  patientId: string;
  // Whether the patient layout successfully minted a LiveKit token.
  // If false, no `<LiveKitRoom>` is mounted upstream and useTracks()
  // here would return empty — show an explicit error instead of an
  // empty grid so the caregiver knows the upstream mint failed.
  hasLivekitToken: boolean;
  enabledCameras: EnabledCamera[];
}) {
  // Own the camera list as client state so realtime updates from
  // OTHER surfaces (iOS PATCH of `disabled`, wall-phone PATCH of
  // `desired_state`, dashboard removes, fresh pairings) reflect
  // immediately. The server-rendered `enabledCameras` prop is just
  // the initial snapshot — after first paint every mutation flows
  // through this subscription, not through a page refresh.
  const [cameras, setCameras] = useState<EnabledCamera[]>(enabledCameras);

  // Mirror prop changes back into state (covers an SSR re-render
  // landing while the user is on the page, e.g. after a hard nav).
  useEffect(() => {
    setCameras(enabledCameras);
  }, [enabledCameras]);

  // Realtime: cameras table, scoped to this patient. Same auth-aware
  // client + payload-driven mutation pattern as CameraList /
  // EventsFeed / AnalysesFeed.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void (async () => {
      const supa = await getAuthedBrowserSupabase();
      if (cancelled) return;
      const channel = supa
        .channel(`videogrid-cameras:${patientId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'cameras',
            filter: `patient_id=eq.${patientId}`,
          },
          (payload: RealtimePostgresUpdatePayload<{
            id: string;
            livekit_identity: string | null;
            room: string;
            disabled: boolean;
            ai_paused: boolean;
            desired_state: 'connected' | 'disconnected';
            // Raw DB columns. Caregiver-scoped RLS ensures we only
            // receive rows we own; the bcrypt-hashed values here are
            // used solely to derive `paired` for the tile UI.
            // iPhone cameras carry api_key_hash; Pi cameras carry
            // ingest_token_hash. Either being non-null means paired —
            // the previous code only checked api_key_hash, so every
            // Pi UPDATE caused the tile to flip to "Awaiting pairing".
            api_key_hash: string | null;
            ingest_token_hash: string | null;
            // Drives the "app closed" vs reconnectable "Disconnected"
            // distinction; the PresenceSweeper flips app_present so the
            // tile updates live with no refresh.
            online: boolean;
            app_present: boolean;
          }>) => {
            const next = payload.new;
            setCameras((prev) =>
              prev.map((c) =>
                c.id === next.id
                  ? {
                      ...c,
                      identity: next.livekit_identity ?? c.identity,
                      room: next.room,
                      disabled: next.disabled,
                      ai_paused: next.ai_paused,
                      desired_state: next.desired_state,
                      paired:
                        next.api_key_hash !== null
                        || next.ingest_token_hash !== null,
                      online: next.online,
                      app_present: next.app_present,
                    }
                  : c,
              ),
            );
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'cameras',
            filter: `patient_id=eq.${patientId}`,
          },
          (payload: RealtimePostgresInsertPayload<{
            id: string;
            livekit_identity: string | null;
            room: string;
            disabled: boolean;
            ai_paused: boolean;
            desired_state: 'connected' | 'disconnected';
            api_key_hash: string | null;
            ingest_token_hash: string | null;
            online: boolean;
            app_present: boolean;
          }>) => {
            const fresh = payload.new;
            // No livekit_identity yet = backend hasn't reserved one.
            // (Currently identities are assigned at create_pairing_code,
            // so this is mostly defensive — if that ever moves to
            // post-pair, this guard is what keeps us from inserting a
            // null-identity tile.)
            if (!fresh.livekit_identity) return;
            setCameras((prev) => {
              if (prev.some((c) => c.id === fresh.id)) return prev;
              return [
                ...prev,
                {
                  id: fresh.id,
                  identity: fresh.livekit_identity!,
                  room: fresh.room,
                  disabled: fresh.disabled,
                  ai_paused: fresh.ai_paused,
                  desired_state: fresh.desired_state,
                  paired:
                    fresh.api_key_hash !== null
                    || fresh.ingest_token_hash !== null,
                  online: fresh.online,
                  app_present: fresh.app_present ?? true,
                },
              ];
            });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'cameras',
            filter: `patient_id=eq.${patientId}`,
          },
          (payload: RealtimePostgresDeletePayload<{ id: string }>) => {
            const removedId = payload.old.id;
            if (!removedId) return;
            setCameras((prev) => prev.filter((c) => c.id !== removedId));
          },
        )
        .subscribe();
      cleanup = () => {
        void supa.removeChannel(channel);
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [patientId]);

  if (!hasLivekitToken) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line bg-card text-base text-ink3">
        No LiveKit token available
      </div>
    );
  }
  if (cameras.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line bg-card text-base text-ink3">
        No sensors yet. Pair a wall phone from /cameras.
      </div>
    );
  }
  // LiveKitRoom is mounted up in the patient layout via
  // LiveRoomProvider — so this grid just consumes the existing room
  // context via useTracks(). That preserves the room connection across
  // sub-tab navigation; previously this component owned the wrapper,
  // which tore down the room every time the user left the Live tab.
  return <GridInner enabledCameras={cameras} />;
}
