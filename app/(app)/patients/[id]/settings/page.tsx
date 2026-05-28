import { notFound } from 'next/navigation';
import { PatientForm } from '@/app/_components/PatientForm';
import { EmailAlertsSettings } from '@/app/_components/EmailAlertsSettings';
import { patientSession } from '@/lib/server/patientSession';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PatientSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { patients } = await patientSession();
  const patient = patients.find((p) => p.id === id);
  if (!patient) notFound();

  // Account email = the always-on recipient for this patient's alerts.
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  const accountEmail = user?.email ?? '';

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-3xl w-full mx-auto">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="font-serif text-3xl tracking-tight text-ink">
          Patient settings
        </h1>
        <span className="font-mono text-xs text-ink4 tracking-wide capitalize">
          {patient.relation}
        </span>
      </header>

      <PatientForm mode="edit" initial={patient} />

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-1 font-serif text-2xl text-ink">Email alerts</h2>
        <p className="mb-4 text-sm text-ink3">
          Get an email whenever a detector fires for{' '}
          {patient.preferred_name || patient.full_name}. The iOS app already
          gets push notifications — this covers you on the web, or loops in
          family who don’t have the app. Set per patient.
        </p>
        <EmailAlertsSettings
          patientId={patient.id}
          accountEmail={accountEmail}
          initialEnabled={patient.email_alerts_enabled}
          initialRecipients={patient.email_alert_recipients}
        />
      </section>
    </div>
  );
}
