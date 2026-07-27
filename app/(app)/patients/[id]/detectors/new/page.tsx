import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerNemara } from '@/lib/api/server';
import { DetectorCreateFlow } from '@/app/_components/DetectorCreateFlow';

export const dynamic = 'force-dynamic';

export default async function NewDetectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = await params;
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) notFound();

  // Rooms for the "Where it runs" picker come from the patient's paired
  // cameras — fetched here so the create card is fully self-contained.
  const cameras = await api.listCameras(patientId);

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-7xl w-full mx-auto">
      <header className="flex items-center gap-3">
        <Link href={`/patients/${patient.id}/detectors`} className="text-base text-ink3 hover:text-ink">
          ← Detectors
        </Link>
        <span className="text-ink4">/</span>
        <h1 className="font-serif text-4xl tracking-tight text-ink">
          New detector
        </h1>
      </header>
      <DetectorCreateFlow patientId={patient.id} cameras={cameras} />
    </div>
  );
}
