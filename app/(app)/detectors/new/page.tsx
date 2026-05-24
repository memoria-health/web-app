import Link from 'next/link';
import { getServerNemara } from '@/lib/api/server';
import { DetectorForm } from '@/app/_components/DetectorForm';

export const dynamic = 'force-dynamic';

export default async function NewDetectorPage() {
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients[0];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center gap-3">
        <Link href="/detectors" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Detectors
        </Link>
        <h1 className="text-sm font-semibold tracking-wide">
          New custom detector
        </h1>
      </header>
      <DetectorForm mode="create" patientId={patient.id} />
    </div>
  );
}
