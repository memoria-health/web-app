import { getServerNemara } from '@/lib/api/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { env } from '@/lib/env';
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

export default async function HomePage() {
  const api = await getServerNemara();
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();

  const patients = await api.listPatients();
  const patient = patients[0];

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
    desired_state: c.desired_state,
  }));
  // Analyses feeds + the prefetch query still only target cameras that
  // are actually producing analyses right now — visible (not hidden,
  // not disconnected). Showing an analyses panel for a hidden camera
  // would just be a stale historical list with no new rows.
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

  // Mint a viewer LiveKit token for this patient's room.
  // Token TTL is 1h on the backend; user refreshes to renew.
  const room = `patient_${patient.id}`;
  const identity = `caregiver_${user!.id}`;

  let token: string | null = null;
  let lkError: string | null = null;
  try {
    const minted = await api.mintLiveKitToken({
      room,
      identity,
      role: 'viewer',
    });
    token = minted.token;
  } catch (err) {
    lkError = err instanceof Error ? err.message : String(err);
  }

  const events = await api.listEvents(patient.id, { limit: 30 });

  // Patient's detector list — passed to AnalysesFeed so the row
  // renderer can resolve custom-detector identifiers (custom_<hex>) to
  // human-readable names (the caregiver's "Drinking water" etc.).
  const allDetectors = await api.listDetectors(patient.id);

  // Pre-fill the per-camera AnalysesFeed panels with the most recent
  // rows from public.analyses, scoped to this patient. RLS already
  // filters to caregiver_id = auth.uid() (the analyses_owner policy)
  // so this server-side query only returns rows owned by the logged-in
  // user even though we're using the anon key. We over-fetch and then
  // bucket per-camera in JS — one query is cheaper than N camera-scoped
  // queries.
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
    <div className="flex flex-1 flex-col gap-6 p-4">
      <PauseMonitoringToggle
        patientId={patient.id}
        initialPaused={patient.cameras_paused}
        hiddenCount={cameras.filter((c) => c.disabled).length}
        totalCount={cameras.length}
      />

      <section>
        <header className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Live Grid
          </h2>
          <span className="text-[11px] font-mono text-zinc-600">
            room: {room}
          </span>
        </header>
        {lkError ? (
          <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            Couldn&apos;t mint LiveKit token: {lkError}
          </div>
        ) : (
          <VideoGrid
            token={token!}
            serverUrl={env.LIVEKIT_URL}
            enabledCameras={gridCameras}
          />
        )}
      </section>

      <section>
        <header className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Live LLM analyses
          </h2>
          <span className="text-[11px] text-zinc-600">
            one column per camera · ~10s tick · provider, people, fall,
            wandering, agitation, medication, speech
          </span>
        </header>
        {enabledLivekitCameras.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded border border-dashed border-zinc-800 text-sm text-zinc-500">
            No active cameras to show analyses for.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
        <header className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Promoted events
          </h2>
          <span className="text-[11px] text-zinc-600">
            {events.items.length} recent · only when a detector fires
          </span>
        </header>
        <EventsFeed patientId={patient.id} initial={events.items} />
      </section>
    </div>
  );
}
