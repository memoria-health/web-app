import Link from 'next/link';
import { getServerNemara } from '@/lib/api/server';
import { AddCameraFlow } from '@/app/_components/AddCameraFlow';

export const dynamic = 'force-dynamic';

export default async function NewCameraPage() {
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients[0];

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-7xl w-full mx-auto">
      <header className="flex items-center gap-3">
        <Link href="/cameras" className="text-sm text-ink3 hover:text-ink">
          ← Cameras
        </Link>
        <span className="text-ink4">/</span>
        <h1 className="font-serif text-3xl tracking-tight text-ink">Add camera</h1>
      </header>
      <AddCameraFlow patientId={patient.id} />
    </div>
  );
}
