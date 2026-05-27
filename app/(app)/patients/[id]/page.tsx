import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatientForm } from '@/app/_components/PatientForm';
import { patientSession } from '@/lib/server/patientSession';

export const dynamic = 'force-dynamic';

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { patients } = await patientSession();
  const patient = patients.find((p) => p.id === id);
  if (!patient) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-3xl w-full mx-auto">
      <header className="flex items-center gap-3 flex-wrap">
        <Link href="/patients" className="text-base text-ink3 hover:text-ink">
          ← Patients
        </Link>
        <span className="text-ink4">/</span>
        <h1 className="font-serif text-4xl tracking-tight text-ink">
          {patient.preferred_name || patient.full_name}
        </h1>
        <span className="font-mono text-xs text-ink4 tracking-wide capitalize">
          {patient.relation}
        </span>
      </header>
      <PatientForm mode="edit" initial={patient} />
    </div>
  );
}
