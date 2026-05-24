'use client';

import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

function GridInner() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true },
  );

  // Only show actual wall-phone cameras — hide internal participants like
  // the backend subscriber-bot worker, which joins the same room as a
  // viewer to pull frames for the detector pipeline.
  const cameraTracks = tracks.filter((t) =>
    t.participant.identity.startsWith('cam_'),
  );

  if (cameraTracks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded border border-dashed border-zinc-800 text-sm text-zinc-500">
        Waiting for cameras to join the room…
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
}: {
  token: string;
  serverUrl: string;
}) {
  if (!token) {
    return (
      <div className="flex h-64 items-center justify-center rounded border border-dashed border-zinc-800 text-sm text-zinc-500">
        No LiveKit token available
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
      <GridInner />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
