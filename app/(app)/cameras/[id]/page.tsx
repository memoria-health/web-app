import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerNemara } from '@/lib/api/server';
import { CameraDetectorsForm } from '@/app/_components/CameraDetectorsForm';
import { timeAgo } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

export default async function CameraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients[0];

  // Fetch in parallel: camera list (to find this camera + status),
  // patient's full detector list, and this camera's current assignments.
  const [cameras, patientDetectors, assignments] = await Promise.all([
    api.listCameras(patient.id),
    api.listDetectors(patient.id),
    api.getCameraDetectors(id).catch(() => null),
  ]);
  const camera = cameras.find((c) => c.id === id);
  if (!camera || !assignments) notFound();

  const statusLabel = !camera.livekit_identity
    ? { text: 'PAIRING', tone: 'pairing' as const }
    : camera.online
      ? { text: 'LIVE', tone: 'live' as const }
      : { text: 'OFFLINE', tone: 'offline' as const };
  const toneClass: Record<typeof statusLabel.tone, string> = {
    live: 'border-action/30 bg-action text-action-ink',
    offline: 'border-line bg-paper-dim text-ink3',
    pairing: 'border-warning/40 bg-card-alt text-warning',
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-7xl w-full mx-auto">
      <header className="flex items-center gap-3 flex-wrap">
        <Link href="/cameras" className="text-sm text-ink3 hover:text-ink">
          ← Cameras
        </Link>
        <span className="text-ink4">/</span>
        <h1 className="font-serif text-3xl tracking-tight text-ink">{camera.room}</h1>
        <span
          className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${toneClass[statusLabel.tone]}`}
        >
          {statusLabel.text}
        </span>
        {camera.disabled && (
          <span className="inline-flex items-center rounded-sm border border-line bg-paper-dim px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink3">
            OFF
          </span>
        )}
      </header>

      <section className="rounded-lg border border-line bg-card px-4 py-4">
        <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink3">
          Camera info
        </h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-ink3">Display ID</dt>
          <dd className="font-mono text-ink2">
            CAM {String(camera.display_id).padStart(2, '0')}
          </dd>
          <dt className="text-ink3">LiveKit identity</dt>
          <dd className="font-mono text-ink2">
            {camera.livekit_identity ?? '— not yet claimed —'}
          </dd>
          <dt className="text-ink3">Last seen</dt>
          <dd className="text-ink2">{timeAgo(camera.last_seen_at)}</dd>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink3">
          Detectors running on this camera
        </h2>
        <CameraDetectorsForm
          cameraId={camera.id}
          patientDetectors={patientDetectors}
          initialAssignedIds={assignments.detector_ids}
        />
      </section>
    </div>
  );
}
