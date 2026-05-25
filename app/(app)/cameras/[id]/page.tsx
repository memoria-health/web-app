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
    live: 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
    offline: 'border-zinc-700 bg-zinc-900 text-zinc-400',
    pairing: 'border-yellow-800 bg-yellow-950/40 text-yellow-300',
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center gap-3">
        <Link href="/cameras" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Cameras
        </Link>
        <span className="text-zinc-700">/</span>
        <h1 className="text-sm font-semibold tracking-wide">{camera.room}</h1>
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneClass[statusLabel.tone]}`}
        >
          {statusLabel.text}
        </span>
        {camera.disabled && (
          <span className="inline-flex items-center rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            OFF
          </span>
        )}
      </header>

      <section className="rounded border border-zinc-800 bg-zinc-950 px-3 py-3">
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Camera info
        </h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[12px]">
          <dt className="text-zinc-500">Display ID</dt>
          <dd className="font-mono text-zinc-300">
            CAM {String(camera.display_id).padStart(2, '0')}
          </dd>
          <dt className="text-zinc-500">LiveKit identity</dt>
          <dd className="font-mono text-zinc-300">
            {camera.livekit_identity ?? '— not yet claimed —'}
          </dd>
          <dt className="text-zinc-500">Last seen</dt>
          <dd className="text-zinc-300">{timeAgo(camera.last_seen_at)}</dd>
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
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
