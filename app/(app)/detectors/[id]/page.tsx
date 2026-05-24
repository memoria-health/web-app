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
  const detectors = await api.listDetectors(patient.id);
  const detector = detectors.find((d) => d.id === id);
  if (!detector) notFound();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center gap-3">
        <Link href="/detectors" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Detectors
        </Link>
        <span className="text-zinc-700">/</span>
        <h1 className="text-sm font-semibold tracking-wide">
          {detector.name}
        </h1>
        <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
          {detector.source}
        </span>
      </header>
      <DetectorForm mode="edit" detector={detector} />
    </div>
  );
}
