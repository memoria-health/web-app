'use client';

import { useEffect, useState } from 'react';
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  RealtimePostgresDeletePayload,
} from '@supabase/supabase-js';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { AnalysesFeed } from './AnalysesFeed';
import type { Analysis, Camera, Detector } from '@/lib/api/types';

// Client-side reactive camera list for the "Live analyses" section.
//
// The patient page is a server component that fetches the camera list ONCE
// at load, so a camera PAIRED after load (or one whose desired_state /
// disabled flips) would never get a feed mounted until a manual reload.
// This component seeds from that server list and then subscribes to the
// cameras realtime channel (same pattern as CameraList) — mounting and
// unmounting feeds as cameras are paired, enabled, or removed. No reload.
// (router.refresh() is unreliable in Next 16 — see CameraList — so we keep
// the list in client state instead.)

type CameraRow = Camera & {
  api_key_hash: string | null;
  ingest_token_hash: string | null;
};

function withPaired(row: CameraRow): Camera {
  return {
    ...row,
    paired: row.api_key_hash !== null || row.ingest_token_hash !== null,
  };
}

export function LiveAnalysesSection({
  patientId,
  camerasPaused,
  initialCameras,
  detectors,
  initialByCamera,
}: {
  patientId: string;
  camerasPaused: boolean;
  initialCameras: Camera[];
  detectors: Detector[];
  initialByCamera: Record<string, Analysis[]>;
}) {
  const [cameras, setCameras] = useState<Camera[]>(initialCameras);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    // Must await the authed client before subscribing — an anon-role
    // subscription silently drops every RLS-filtered broadcast.
    void (async () => {
      const supa = await getAuthedBrowserSupabase();
      if (cancelled) return;
      const channel = supa
        .channel(`live-analyses-cameras:${patientId}:${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'cameras', filter: `patient_id=eq.${patientId}` },
          (payload: RealtimePostgresInsertPayload<CameraRow>) => {
            const fresh = withPaired(payload.new);
            setCameras((prev) =>
              prev.some((c) => c.id === fresh.id)
                ? prev
                : [...prev, fresh].sort((a, b) => a.display_id - b.display_id),
            );
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'cameras', filter: `patient_id=eq.${patientId}` },
          (payload: RealtimePostgresUpdatePayload<CameraRow>) => {
            const next = withPaired(payload.new);
            setCameras((prev) =>
              prev.map((c) => (c.id === next.id ? { ...c, ...next } : c)),
            );
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'cameras', filter: `patient_id=eq.${patientId}` },
          (payload: RealtimePostgresDeletePayload<Camera>) => {
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

  // Same predicate as the page used to compute server-side: a camera gets a
  // feed as soon as it's paired (has a livekit_identity) + meant-to-be-on
  // (desired_state connected), WITHOUT requiring `online` (which lags).
  // Per-camera state only — `camerasPaused` (the bulk button) is no longer a
  // gate. A connected camera shows its feed regardless of the patient-level
  // flag, matching the grid + detection.
  const feedCameras = cameras.filter(
    (c) =>
      c.livekit_identity !== null &&
      !c.disabled &&
      c.desired_state === 'connected',
  );
  const feedCameraIds = feedCameras.map((c) => c.id);

  if (feedCameras.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-line bg-card text-base text-ink3">
        No active cameras to show analyses for.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {feedCameras.map((cam) => (
        <AnalysesFeed
          key={cam.id}
          patientId={patientId}
          enabledCameraIds={feedCameraIds}
          cameraId={cam.id}
          cameraLabel={cam.room}
          initial={initialByCamera[cam.id] ?? []}
          detectors={detectors}
        />
      ))}
    </div>
  );
}
