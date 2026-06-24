import { notFound } from 'next/navigation';
import { getServerNemara } from '@/lib/api/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { VideoGrid } from '@/app/_components/VideoGrid';
import { EventsFeed } from '@/app/_components/EventsFeed';
import { LiveAnalysesSection } from '@/app/_components/LiveAnalysesSection';
import { PatientIdentityStatus } from '@/app/_components/PatientIdentityStatus';
import { DataCollectionConsentGate } from '@/app/_components/DataCollectionConsentGate';
import { type Analysis } from '@/lib/api/types';
import { SHOW_LIVE_ANALYSES } from '@/lib/featureFlags';

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
  // paired camera gets a tile regardless of disabled / desired_state /
  // patient-level pause, so the caregiver can always reach the ⋯ menu
  // to re-enable. The tile body itself swaps between live video /
  // "Hidden" placeholder / "Disconnected" placeholder based on state.
  //
  // Patient-level pause (patient.cameras_paused) cascades every camera's
  // desired_state to 'disconnected', so the tiles render the
  // "Disconnected" placeholder and STAY in their grid slot rather than
  // vanishing (the old behavior collapsed the whole grid to "No cameras
  // yet", which read as "cameras gone" instead of "monitoring paused").
  // Reconnect-all flips desired_state back and the tiles go live again.
  //
  // Unpaired cameras (livekit_identity null) are excluded — they have
  // no LiveKit identity to render anything with. The /cameras pairing
  // flow handles them separately.
  const cameras = await api.listCameras(patient.id);
  const allPairedCameras = cameras.filter(
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
    // Carried so the tile can distinguish "app closed" (open Memoria
    // Sensor) from a reconnectable "Disconnected". `online` lets us keep
    // app-closed from ever shadowing a live feed.
    online: c.online,
    app_present: c.app_present ?? true,
  }));
  // Analyses feeds mount as soon as a camera is paired + meant-to-be-on
  // (`desired_state === 'connected'`), WITHOUT requiring `online`. `online`
  // lags — it's written by the worker's reconciler only after it attaches,
  // so gating the feed on it means the feed never mounts until a manual
  // reload/reconnect (the bug). Mounting eagerly is safe: the feed's
  // analyses realtime subscription is live from the start, so once the
  // camera actually comes online and ticks are written, they stream into
  // the already-mounted feed with NO page reload. We mount feeds (and build
  // the enabled-set the feed filters on) off this stable list.
  // NOTE: deliberately NOT router.refresh() — it's unreliable in Next 16
  // here (see CameraList).
  // Follows per-camera state only — the patient-level pause flag is NOT a
  // gate (a camera that's connected gets its feed regardless of the bulk
  // disconnect-all/reconnect-all button; detection itself is decoupled from
  // cameras_paused too).
  const analysesFeedCameras = cameras.filter(
    (c): c is typeof c & { livekit_identity: string } =>
      c.livekit_identity !== null
      && !c.disabled
      && c.desired_state === 'connected',
  );

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

  const historyLimit = ANALYSES_HISTORY_PER_CAMERA * Math.max(1, analysesFeedCameras.length);
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
      {/* First-open data-collection consent. Renders a modal only when
          the caregiver has never decided (decided_at == null); inert
          (renders nothing) once a decision has been recorded. */}
      <DataCollectionConsentGate
        patientId={patient.id}
        patientName={patient.preferred_name || patient.full_name}
        initialDecidedAt={patient.data_collection_decided_at}
      />

      <PatientIdentityStatus
        patientId={patient.id}
        patientName={patient.preferred_name || patient.full_name}
        surface="detail"
      />

      <section>
        <header className="mb-3">
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            Live grid
          </h2>
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

      {/* Hidden via feature flag — flip SHOW_LIVE_ANALYSES in lib/featureFlags
          to bring it back. Code + data fetch are intentionally left intact. */}
      {SHOW_LIVE_ANALYSES && (
        <section>
          <header className="mb-3">
            <h2 className="font-serif text-3xl tracking-tight text-ink">
              Live analyses
            </h2>
          </header>
          <LiveAnalysesSection
            patientId={patient.id}
            camerasPaused={patient.cameras_paused}
            initialCameras={cameras}
            detectors={allDetectors}
            initialByCamera={Object.fromEntries(initialByCamera)}
          />
        </section>
      )}

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
