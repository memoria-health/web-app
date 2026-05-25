import Link from 'next/link';
import { getServerNemara } from '@/lib/api/server';
import { DetectorList } from '@/app/_components/DetectorList';

export const dynamic = 'force-dynamic';

export default async function DetectorsPage() {
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients[0];

  // Parallel: load detectors + every camera's assignment set so we can
  // tell the caregiver "this detector runs on N cameras right now."
  // Custom detectors default to 0 (opt-in) so this chip is the user's
  // cue to go to /cameras/[id] and enable it where they want it.
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
    <div className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-sm font-semibold tracking-wide">Detectors</h1>
        <Link
          href="/detectors/new"
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          + New custom detector
        </Link>
      </header>
      <DetectorList
        initial={detectors}
        patientId={patient.id}
        totalCameras={cameras.length}
        cameraCount={cameraCount}
      />
    </div>
  );
}
