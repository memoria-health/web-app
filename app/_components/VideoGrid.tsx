'use client';

import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

function GridInner({ enabledIdentities }: { enabledIdentities: string[] }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true },
  );

  // Whitelist: only show tracks whose participant identity is in the
  // enabled list. The enabled list:
  //  - Always excludes the backend subscriber-bot (its identity starts
  //    with `detector_worker_`, never with `cam_`, so it's never in
  //    the list which is computed from the cameras DB rows).
  //  - Excludes any camera the user has disabled (cameras.disabled = true).
  //  - Is EMPTY when patient.cameras_paused = true (hides everything).
  const enabledSet = new Set(enabledIdentities);
  const cameraTracks = tracks.filter((t) =>
    enabledSet.has(t.participant.identity),
  );

  if (cameraTracks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded border border-dashed border-zinc-800 text-sm text-zinc-500">
        {enabledIdentities.length === 0
          ? 'All cameras are off. Turn one back on to see live video.'
          : 'Waiting for cameras to join the room…'}
      </div>
    );
  }

  return (
    <div className="min-h-[20rem]">
      <GridLayout tracks={cameraTracks}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}

export function VideoGrid({
  token,
  serverUrl,
  enabledIdentities,
}: {
  token: string;
  serverUrl: string;
  enabledIdentities: string[];
}) {
  if (!token) {
    return (
      <div className="flex h-64 items-center justify-center rounded border border-dashed border-zinc-800 text-sm text-zinc-500">
        No LiveKit token available
      </div>
    );
  }
  // Short-circuit: if NO cameras are enabled, don't even bother connecting
  // to LiveKit. Saves a WebSocket + token round-trip every refresh.
  if (enabledIdentities.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded border border-dashed border-zinc-800 text-sm text-zinc-500">
        All cameras are off. Turn one back on to see live video.
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
      <GridInner enabledIdentities={enabledIdentities} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
