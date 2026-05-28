import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerNemara } from '@/lib/api/server';
import { DetectorForm } from '@/app/_components/DetectorForm';

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
  const cameras = await api.listCameras(patient.id);

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-7xl w-full mx-auto">
      <header className="flex items-center gap-3">
        <Link href={`/patients/${patient.id}/detectors`} className="text-base text-ink3 hover:text-ink">
          ← Detectors
        </Link>
        <span className="text-ink4">/</span>
        <h1 className="font-serif text-4xl tracking-tight text-ink">
          New custom detector
        </h1>
      </header>
      <DetectorForm
        mode="create"
        patientId={patient.id}
        cameras={cameras}
      />
    </div>
  );
}
