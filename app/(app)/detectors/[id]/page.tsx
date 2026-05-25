import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerNemara } from '@/lib/api/server';
import { DetectorForm } from '@/app/_components/DetectorForm';

export const dynamic = 'force-dynamic';

export default async function EditDetectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerNemara();
  const patients = await api.listPatients();
  const patient = patients[0];
  const [detectors, cameras] = await Promise.all([
    api.listDetectors(patient.id),
    api.listCameras(patient.id),
  ]);
  const detector = detectors.find((d) => d.id === id);
  if (!detector) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-7xl w-full mx-auto">
      <header className="flex items-center gap-3 flex-wrap">
        <Link href="/detectors" className="text-sm text-ink3 hover:text-ink">
          ← Detectors
        </Link>
        <span className="text-ink4">/</span>
        <h1 className="font-serif text-3xl tracking-tight text-ink">
          {detector.name}
        </h1>
        <span className="rounded-sm border border-line bg-paper-dim px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink3">
          {detector.source}
        </span>
      </header>
      <DetectorForm mode="edit" detector={detector} cameras={cameras} />
    </div>
  );
}
