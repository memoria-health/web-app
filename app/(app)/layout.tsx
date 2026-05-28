import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServerNemara } from '@/lib/api/server';
import { isAPIError } from '@/lib/api/errors';
import { TopNav } from '@/app/_components/TopNav';
import { OnboardingModal } from '@/app/_components/OnboardingModal';
import { TimezoneSync } from '@/app/_components/TimezoneSync';
import { PatientProvider } from '@/app/_components/PatientProvider';
import { patientSession } from '@/lib/server/patientSession';

async function ensureCaregiver(): Promise<{
  email: string | null;
  onboardedWeb: boolean;
  timezone: string;
}> {
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect('/login');

  const api = await getServerNemara();

  // Ensure caregiver row exists. /v1/me returns 404 if not provisioned —
  // happens for users who completed Supabase Auth signup but whose
  // backend caregiver row never landed (e.g. email-confirmation flow
  // that bypassed the post-signup provisioning hook). Fresh rows come
  // back with onboarded_web=false, so the walkthrough shows on first
  // visit.
  let onboardedWeb = true;
  let timezone = 'America/New_York';
  try {
    const me = await api.getMe();
    onboardedWeb = me.onboarded_web;
    timezone = me.timezone;
  } catch (err) {
    if (isAPIError(err) && err.status === 404) {
      const displayName =
        (user.user_metadata?.display_name as string | undefined) ??
        user.email?.split('@')[0] ??
        'Caregiver';
      const created = await api.createMe({ display_name: displayName });
      onboardedWeb = created.onboarded_web;
      timezone = created.timezone;
    } else {
      throw err;
    }
  }

  return { email: user.email ?? null, onboardedWeb, timezone };
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email, onboardedWeb, timezone } = await ensureCaregiver();
  // Resolve the caregiver's patient list + current selection from
  // cookie. Pages downstream consume this via the PatientProvider's
  // `usePatient()` (throws if no patient — for pages that require
  // one) or `useMaybePatient()` (returns null — for empty-state
  // handling on the home page).
  const { patients, selected } = await patientSession();

  return (
    <div className="flex flex-1 flex-col">
      <PatientProvider patients={patients} selected={selected}>
        <TopNav email={email} />
        <main className="flex-1 flex flex-col">{children}</main>
        {!onboardedWeb && <OnboardingModal />}
        <TimezoneSync current={timezone} />
      </PatientProvider>
    </div>
  );
}
