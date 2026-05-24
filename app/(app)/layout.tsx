import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServerNemara } from '@/lib/api/server';
import { isAPIError } from '@/lib/api/errors';
import type { Patient } from '@/lib/api/types';
import { TopNav } from '@/app/_components/TopNav';
import { PatientProvider } from '@/app/_components/PatientProvider';

async function ensureCaregiverAndPatient(): Promise<{
  email: string | null;
  patient: Patient;
}> {
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect('/login');

  const api = await getServerNemara();

  // Ensure caregiver row exists. /v1/me returns 404 if not provisioned.
  try {
    await api.getMe();
  } catch (err) {
    if (isAPIError(err) && err.status === 404) {
      const displayName =
        (user.user_metadata?.display_name as string | undefined) ??
        user.email?.split('@')[0] ??
        'Caregiver';
      await api.createMe({ display_name: displayName });
    } else {
      throw err;
    }
  }

  // Ensure at least one patient exists. Single-patient mode for v1.
  const patients = await api.listPatients();
  if (patients.length === 0) {
    const created = await api.createPatient({
      full_name: 'Default Patient',
      preferred_name: 'Default',
      relation: 'other',
    });
    return { email: user.email ?? null, patient: created };
  }
  return { email: user.email ?? null, patient: patients[0] };
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email, patient } = await ensureCaregiverAndPatient();

  return (
    <div className="flex flex-1 flex-col">
      <TopNav email={email} />
      <PatientProvider patient={patient}>
        <main className="flex-1 flex flex-col">{children}</main>
      </PatientProvider>
    </div>
  );
}
