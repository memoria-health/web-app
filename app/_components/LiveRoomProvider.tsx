'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';

/// Mounts a single `<LiveKitRoom>` at the patient-layout level so that
/// the room connection survives sub-tab navigation (Live ↔ Cameras ↔
/// Detectors ↔ Settings). Before this lived inside `<VideoGrid>`, which
/// only renders on the Live page — leaving Live therefore unmounted
/// VideoGrid, tore down the room, and returning paid the full WebRTC
/// handshake cost again (~1-2s of black screen).
///
/// With the room hoisted up, navigating between sub-tabs preserves the
/// patient layout (and this provider) — only the page content swaps.
/// Coming back to the Live page just re-attaches the existing GridInner
/// to an already-connected room, so video tiles light up instantly.
///
/// When `token` is null (mint failed in the layout), we render children
/// raw. `<VideoGrid>` checks for a non-null token via the same prop and
/// shows an error placeholder; useTracks() inside without a provider
/// just returns an empty list, which is fine for non-Live pages.
///
/// AUTO-RECONNECT: the LiveKit SDK gives up reconnecting after a few
/// attempts, which would strand the dashboard until a manual refresh if
/// the LiveKit server ever restarts (e.g. a cloud deploy). We keep the
/// browser retrying with capped backoff by REMOUNTING `<LiveKitRoom>`
/// (bumping `key`) whenever it disconnects or errors — mirroring the
/// gateway's own reconnect backstop, so a server blip self-heals with no
/// refresh. The SDK only fires `onDisconnected` after its OWN internal
/// retries are exhausted, so this layer only engages for real outages and
/// never fights the SDK's transparent recovery of brief blips.
export function LiveRoomProvider({
  token,
  serverUrl,
  children,
}: {
  token: string | null;
  serverUrl: string;
  children: React.ReactNode;
}) {
  // Bumping `attempt` remounts <LiveKitRoom> → a fresh connection.
  const [attempt, setAttempt] = useState(0);
  const backoffRef = useRef(1000); // ms; doubles per failure, capped at 8s
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const scheduleReconnect = useCallback(() => {
    if (timerRef.current) return; // one pending reconnect at a time
    const delay = backoffRef.current;
    backoffRef.current = Math.min(backoffRef.current * 2, 8000);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setAttempt((a) => a + 1);
    }, delay);
  }, []);

  if (!token) {
    return <>{children}</>;
  }

  return (
    <LiveKitRoom
      key={attempt}
      serverUrl={serverUrl}
      token={token}
      connect
      audio={false}
      video={false}
      onConnected={() => {
        backoffRef.current = 1000; // healthy again → reset backoff
      }}
      onDisconnected={scheduleReconnect}
      onError={scheduleReconnect}
    >
      {children}
      {/* Intentionally NO <RoomAudioRenderer />. It plays EVERY subscribed
          room audio track at full volume with no per-track control, which
          overrode the per-tile mute toggle in the live grid: each tile's own
          <AudioTrack volume={isAudible?1:0}> was correctly muted, but
          RoomAudioRenderer blasted the same track anyway (verified — the tile
          element read elVolume:0 while audio still played). Audio is rendered
          PER TILE in VideoGrid instead, so the mute button controls audibility.
          Do not re-add this without per-tile volume support. */}
    </LiveKitRoom>
  );
}
