import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerNemara } from '@/lib/api/server';
import { DetectorList } from '@/app/_components/DetectorList';
import { BetaChip } from '@/app/_components/CustomDetectorBetaNotice';

export const dynamic = 'force-dynamic';

export default async function DetectorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = await params;
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) notFound();

  const [detectors, cameras] = await Promise.all([
    api.listDetectors(patient.id),
    api.listCameras(patient.id),
  ]);

  const assignmentsByCamera = await Promise.all(
    cameras.map((c) =>
      api.getCameraDetectors(c.id).catch(() => ({ detector_ids: [] as string[] })),
    ),
  );

  const cameraCount: Record<string, number> = {};
  for (const a of assignmentsByCamera) {
    for (const did of a.detector_ids) {
      cameraCount[did] = (cameraCount[did] ?? 0) + 1;
    }
  }

  return (
    <div className="anim-stagger flex flex-1 flex-col gap-6 px-6 py-6 max-w-7xl w-full mx-auto">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl tracking-tight text-ink">Detectors</h1>
        {/* BETA is stuck ONTO the button rather than sitting on its own
            line, matching iOS and Android. */}
        <div className="relative">
          <Link
            href={`/patients/${patient.id}/detectors/new`}
            className="inline-block rounded bg-action px-4 py-2 text-sm font-medium text-action-ink transition-colors hover:bg-ink2"
          >
            + New custom detector
          </Link>
          <span className="pointer-events-none absolute -right-2 -top-2">
            <BetaChip />
          </span>
        </div>
      </header>
      <DetectorList
        initial={detectors}
        patientId={patient.id}
        cameraCount={cameraCount}
      />
    </div>
  );
}
