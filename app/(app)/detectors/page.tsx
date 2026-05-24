import Link from 'next/link';
import { getServerNemara } from '@/lib/api/server';
import { DetectorList } from '@/app/_components/DetectorList';

export const dynamic = 'force-dynamic';

export default async function DetectorsPage() {
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients[0];
  const detectors = await api.listDetectors(patient.id);

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
      <DetectorList initial={detectors} />
    </div>
  );
}
