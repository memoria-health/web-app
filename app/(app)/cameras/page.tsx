import Link from 'next/link';
import { getServerNemara } from '@/lib/api/server';
import { CameraList } from '@/app/_components/CameraList';

export const dynamic = 'force-dynamic';

export default async function CamerasPage() {
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients[0];
  const cameras = await api.listCameras(patient.id);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-sm font-semibold tracking-wide">Cameras</h1>
        <Link
          href="/cameras/new"
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          + Add camera
        </Link>
      </header>
      <CameraList patientId={patient.id} initial={cameras} />
    </div>
  );
}
