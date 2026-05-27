import Link from 'next/link';
import { PatientForm } from '@/app/_components/PatientForm';

export const dynamic = 'force-dynamic';

export default function NewPatientPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-3xl w-full mx-auto">
      <header className="flex items-center gap-3 flex-wrap">
        <Link href="/patients" className="text-base text-ink3 hover:text-ink">
          ← Patients
        </Link>
        <span className="text-ink4">/</span>
        <h1 className="font-serif text-4xl tracking-tight text-ink">
          Add patient
        </h1>
      </header>
      <PatientForm mode="create" />
    </div>
  );
}
