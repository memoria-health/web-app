import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerNemara } from '@/lib/api/server';
import { CameraDetectorsForm } from '@/app/_components/CameraDetectorsForm';
import { ShowPairingCodeButton } from '@/app/_components/ShowPairingCodeButton';

export const dynamic = 'force-dynamic';

export default async function CameraDetailPage({
  params,
}: {
  params: Promise<{ id: string; cameraId: string }>;
}) {
  const { id: patientId, cameraId } = await params;
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) notFound();

  // Fetch in parallel: camera list (to find this camera + status),
  // patient's full detector list, and this camera's current assignments.
  const [cameras, patientDetectors, assignments] = await Promise.all([
    api.listCameras(patient.id),
    api.listDetectors(patient.id),
    api.getCameraDetectors(cameraId).catch(() => null),
  ]);
  const camera = cameras.find((c) => c.id === cameraId);
  if (!camera || !assignments) notFound();

  // App closed (iPhone sensor, not online, heartbeat stopped) is the
  // distinct 4th state: reconnect can't help, the caregiver must reopen
  // Memoria Sensor. Only ever true for iPhone sensors — Pi stays present.
  const appClosed = !camera.online && camera.app_present === false;
  const statusLabel = !camera.paired
    ? { text: 'PAIRING', tone: 'pairing' as const }
    : camera.online
      ? { text: 'LIVE', tone: 'live' as const }
      : appClosed
        ? { text: 'APP CLOSED', tone: 'appClosed' as const }
        : { text: 'OFFLINE', tone: 'offline' as const };
  const toneClass: Record<typeof statusLabel.tone, string> = {
    live: 'border-action/30 bg-action text-action-ink',
    offline: 'border-line bg-paper-dim text-ink3',
    pairing: 'border-warning/40 bg-card-alt text-warning',
    appClosed: 'border-warning/40 bg-card-alt text-warning',
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-7xl w-full mx-auto">
      <header className="flex items-center gap-3 flex-wrap">
        <Link href={`/patients/${patient.id}/cameras`} className="text-base text-ink3 hover:text-ink">
          ← Sensors
        </Link>
        <span className="text-ink4">/</span>
        <h1 className="font-serif text-4xl tracking-tight text-ink">{camera.room}</h1>
        <span
          className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${toneClass[statusLabel.tone]}`}
        >
          {statusLabel.text}
        </span>
        {camera.disabled && (
          <span className="inline-flex items-center rounded-sm border border-line bg-paper-dim px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
            HIDDEN
          </span>
        )}
        {camera.ai_paused && !camera.disabled && (
          <span className="inline-flex items-center rounded-sm border border-warning/40 bg-card-alt px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-warning">
            AI PAUSED
          </span>
        )}
      </header>

      <section className="rounded-lg border border-line bg-card px-4 py-4">
        <h2 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
          Sensor info
        </h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-ink3">Display ID</dt>
          <dd className="font-mono text-ink2">
            SENSOR {String(camera.display_id).padStart(2, '0')}
          </dd>
          <dt className="text-ink3">LiveKit identity</dt>
          <dd className="font-mono text-ink2">
            {camera.livekit_identity ?? '— not yet claimed —'}
          </dd>
        </dl>
      </section>

      {camera.source_type === 'phone' && !camera.paired && (
        <section className="rounded-lg border border-warning/40 bg-card-alt px-4 py-4">
          <h2 className="mb-1 font-mono text-xs font-semibold uppercase tracking-wider text-warning">
            Awaiting pairing
          </h2>
          <p className="mb-3 text-sm text-ink2">
            No wall phone has claimed this sensor yet. Tap to view a 6-digit
            pairing code, then enter it on the MemoriaSensor wall-phone app to
            complete pairing.
          </p>
          <ShowPairingCodeButton cameraId={camera.id} room={camera.room} />
        </section>
      )}

      <section>
        <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
          Detectors running on this sensor
        </h2>
        <CameraDetectorsForm
          cameraId={camera.id}
          patientDetectors={patientDetectors}
          initialAssignedIds={assignments.detector_ids}
          patientId={patient.id}
        />
      </section>
    </div>
  );
}
