'use client';

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
export function LiveRoomProvider({
  token,
  serverUrl,
  children,
}: {
  token: string | null;
  serverUrl: string;
  children: React.ReactNode;
}) {
  if (!token) {
    return <>{children}</>;
  }
  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      audio={false}
      video={false}
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
