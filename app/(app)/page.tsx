import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PatientRosterList } from '@/app/_components/PatientRosterList';
import { patientSession } from '@/lib/server/patientSession';

export const dynamic = 'force-dynamic';

/// Roster home. Mirrors the iOS RosterView's role:
///   - 0 patients → empty state CTA
///   - 1 patient  → server redirect to /patients/<id> so the
///                  single-patient caregiver lands directly on the
///                  Live view (no extra tap).
///   - 2+ patients → roster grid; pick one to drill in.
export default async function HomePage() {
  const { patients } = await patientSession();

  if (patients.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="font-serif text-4xl tracking-tight text-ink">
          Welcome to Memoria
        </h1>
        <p className="mt-3 max-w-md text-base text-ink3">
          To get started, add the person you&apos;ll be caring for. You
          can pair cameras to them and configure detectors next.
        </p>
        <Link
          href="/patients/new"
          className="mt-6 rounded-md bg-action px-5 py-2.5 text-sm font-semibold text-action-ink hover:bg-ink2 transition-colors"
        >
          Add your first patient
        </Link>
      </div>
    );
  }

  if (patients.length === 1) {
    redirect(`/patients/${patients[0].id}`);
  }

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
      <PatientRosterList initial={patients} />
    </div>
  );
}
