import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerNemara } from '@/lib/api/server';
import { DetectorEditor } from '@/app/_components/DetectorEditor';

export const dynamic = 'force-dynamic';

export default async function EditDetectorPage({
  params,
}: {
  params: Promise<{ id: string; detectorId: string }>;
}) {
  const { id: patientId, detectorId } = await params;
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) notFound();
  const [detectors, cameras] = await Promise.all([
    api.listDetectors(patient.id),
    api.listCameras(patient.id),
  ]);
  const detector = detectors.find((d) => d.id === detectorId);
  if (!detector) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-7xl w-full mx-auto">
      <header className="flex items-center gap-3 flex-wrap">
        <Link href={`/patients/${patient.id}/detectors`} className="text-base text-ink3 hover:text-ink">
          ← Detectors
        </Link>
        <span className="text-ink4">/</span>
        <h1 className="font-serif text-4xl tracking-tight text-ink">
          {detector.name}
        </h1>
        <span className="rounded-sm border border-line bg-paper-dim px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-ink3">
          {detector.source}
        </span>
      </header>
      <DetectorEditor detector={detector} cameras={cameras} />
    </div>
  );
}
