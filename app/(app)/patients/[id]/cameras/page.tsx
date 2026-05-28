import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerNemara } from '@/lib/api/server';
import { CameraList } from '@/app/_components/CameraList';

export const dynamic = 'force-dynamic';

export default async function CamerasPage({
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
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl tracking-tight text-ink">Cameras</h1>
        <Link
          href={`/patients/${patient.id}/cameras/new`}
          className="rounded bg-action px-4 py-2 text-sm font-medium text-action-ink transition-colors hover:bg-ink2"
        >
          + Add camera
        </Link>
      </header>
      <CameraList patientId={patient.id} initial={cameras} />
    </div>
  );
}
