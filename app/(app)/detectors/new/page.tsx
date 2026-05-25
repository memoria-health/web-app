import Link from 'next/link';
import { getServerNemara } from '@/lib/api/server';
import { DetectorForm } from '@/app/_components/DetectorForm';

export const dynamic = 'force-dynamic';

export default async function NewDetectorPage() {
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients[0];
  // Cameras are passed in so the form can render a "Where" dropdown
  // populated with the caregiver's actual rooms. The detector itself
  // is still patient-scoped — per-camera assignment lives in
  // /cameras/[id]. Where is a free-text scope hint that the LLM uses
  // to focus its prompt (e.g. "KITCHEN" means "only fire on kitchen
  // scenes"); choosing a room here just preselects that hint.
  const cameras = await api.listCameras(patient.id);

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
      <DetectorForm
        mode="create"
        patientId={patient.id}
        cameras={cameras}
      />
    </div>
  );
}
