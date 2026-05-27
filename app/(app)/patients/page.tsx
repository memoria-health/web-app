import Link from 'next/link';
import { PatientRosterList } from '@/app/_components/PatientRosterList';
import { patientSession } from '@/lib/server/patientSession';

export const dynamic = 'force-dynamic';

export default async function PatientsPage() {
  const { patients } = await patientSession();

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-5xl w-full mx-auto">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-serif text-4xl tracking-tight text-ink">Patients</h1>
        <Link
          href="/patients/new"
          className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-ink hover:bg-ink2 transition-colors"
        >
          + Add patient
        </Link>
      </header>

      {patients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-card px-4 py-12 text-center text-ink3">
          No patients yet. Add one to start pairing cameras.
        </div>
      ) : (
        <PatientRosterList initial={patients} />
      )}
    </div>
  );
}
