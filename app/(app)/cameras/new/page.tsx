import Link from 'next/link';
import { getServerNemara } from '@/lib/api/server';
import { AddCameraFlow } from '@/app/_components/AddCameraFlow';

export const dynamic = 'force-dynamic';

export default async function NewCameraPage() {
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients[0];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center gap-3">
        <Link href="/cameras" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Cameras
        </Link>
        <h1 className="text-sm font-semibold tracking-wide">Add camera</h1>
      </header>
      <AddCameraFlow patientId={patient.id} />
    </div>
  );
}
