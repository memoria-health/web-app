import { notFound } from 'next/navigation';
import { getServerNemara } from '@/lib/api/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { VideoGrid } from '@/app/_components/VideoGrid';
import { EventsFeed } from '@/app/_components/EventsFeed';
import { AnalysesFeed } from '@/app/_components/AnalysesFeed';
import { PauseMonitoringToggle } from '@/app/_components/PauseMonitoringToggle';
import type { Analysis } from '@/lib/api/types';

// How many recent rows to pre-fill each per-camera AnalysesFeed with.
// Realtime only delivers events AFTER subscribe — without this prefetch,
// navigating away from / and back leaves each panel empty until the next
// tick arrives ~10s later. 30 rows ≈ 5 minutes of history at the
// ~10s tick cadence, plenty of context when returning to the tab.
const ANALYSES_HISTORY_PER_CAMERA = 30;

export const dynamic = 'force-dynamic';

export default async function PatientLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = await params;
  const api = await getServerNemara();
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();

  // Patient existence is already validated by the layout (404 there
  // if missing) — refetch here so we have the full row including
  // cameras_paused. listPatients is patient-list-scoped, cheap.
  const patients = await api.listPatients();
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) notFound();

  // Fetch cameras. Each tile in the live grid is "reserved" — every
  // paired camera gets a tile regardless of disabled / desired_state,
  // so the caregiver can always reach the ⋯ menu to re-enable. The
  // tile body itself swaps between live video / "Hidden" placeholder /
  // "Disconnected" placeholder based on state.
  //
  // Patient-level pause (patient.cameras_paused) still hides EVERY
  // tile — it's a kill switch, semantically different from per-camera
  // toggles. PauseMonitoringToggle at the top of the page is the only
  // affordance to un-pause it.
  //
  // Unpaired cameras (livekit_identity null) are excluded — they have
  // no LiveKit identity to render anything with. The /cameras pairing
  // flow handles them separately.
  const cameras = await api.listCameras(patient.id);
  const allPairedCameras = patient.cameras_paused
    ? []
    : cameras.filter(
        (c): c is typeof c & { livekit_identity: string } =>
          c.livekit_identity !== null,
      );
  const gridCameras = allPairedCameras.map((c) => ({
    id: c.id,
    identity: c.livekit_identity,
    room: c.room,
    disabled: c.disabled,
    ai_paused: c.ai_paused,
    desired_state: c.desired_state,
    paired: c.paired,
  }));
  const visibleCameras = patient.cameras_paused
    ? []
    : cameras.filter((c) => !c.disabled && c.desired_state === 'connected');
  const visibleCamerasPaired = visibleCameras.filter(
    (c): c is typeof c & { livekit_identity: string } =>
      c.livekit_identity !== null,
  );
  const enabledLivekitCameras = visibleCamerasPaired.map((c) => ({
    identity: c.livekit_identity,
    room: c.room,
    id: c.id,
  }));
  const enabledCameraIds = visibleCameras.map((c) => c.id);

  const room = `patient_${patient.id}`;

  // LiveKit token is minted in the patient layout now (so the room
  // stays connected across sub-tab navigation). We re-mint here just
  // to know whether the upstream mint will have succeeded — this lets
  // us show an inline error if the backend's LiveKit creds are broken,
  // instead of a confusing empty grid. JWT signing is cheap (~5ms),
  // and both tokens are independently valid.
  let lkError: string | null = null;
  try {
    await api.mintLiveKitToken({
      room,
      identity: `caregiver_${user!.id}_web`,
      role: 'viewer',
    });
  } catch (err) {
    lkError = err instanceof Error ? err.message : String(err);
  }

  const events = await api.listEvents(patient.id, { limit: 30 });
  const allDetectors = await api.listDetectors(patient.id);

  const historyLimit = ANALYSES_HISTORY_PER_CAMERA * Math.max(1, enabledLivekitCameras.length);
  const { data: recentAnalyses } = await supa
    .from('analyses')
    .select('*')
    .eq('patient_id', patient.id)
    .order('created_at', { ascending: false })
    .limit(historyLimit);

  const initialByCamera = new Map<string, Analysis[]>();
  for (const row of (recentAnalyses ?? []) as Analysis[]) {
    const bucket = initialByCamera.get(row.camera_id) ?? [];
    if (bucket.length < ANALYSES_HISTORY_PER_CAMERA) {
      bucket.push(row);
      initialByCamera.set(row.camera_id, bucket);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-7 px-6 py-6 max-w-7xl w-full mx-auto">
      <PauseMonitoringToggle
        patientId={patient.id}
        initialPaused={patient.cameras_paused}
        hiddenCount={cameras.filter((c) => c.disabled).length}
        totalCount={cameras.length}
      />

      <section>
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            Live grid
          </h2>
          <span className="text-xs font-mono text-ink4">room: {room}</span>
        </header>
        {lkError ? (
          <div className="rounded-lg border border-terra/40 bg-terra-soft px-4 py-3 text-sm text-terra-deep">
            Couldn&apos;t mint LiveKit token: {lkError}
          </div>
        ) : (
          <VideoGrid
            patientId={patient.id}
            hasLivekitToken={true}
            enabledCameras={gridCameras}
          />
        )}
      </section>

      <section>
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            Live analyses
          </h2>
          <span className="text-xs text-ink4">
            one column per camera · ~10s tick · provider, people, fall,
            wandering, agitation, medication, speech
          </span>
        </header>
        {enabledLivekitCameras.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-line bg-card text-base text-ink3">
            No active cameras to show analyses for.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {enabledLivekitCameras.map((cam) => (
              <AnalysesFeed
                key={cam.id}
                patientId={patient.id}
                enabledCameraIds={enabledCameraIds}
                cameraId={cam.id}
                cameraLabel={cam.room}
                initial={initialByCamera.get(cam.id) ?? []}
                detectors={allDetectors}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            Promoted events
          </h2>
          <span className="text-xs text-ink4">
            {events.items.length} recent · only when a detector fires
          </span>
        </header>
        <EventsFeed patientId={patient.id} initial={events.items} />
      </section>
    </div>
  );
}
