import { notFound } from 'next/navigation';
import { PatientForm } from '@/app/_components/PatientForm';
import { EmailAlertsSettings } from '@/app/_components/EmailAlertsSettings';
import { DataCollectionSettings } from '@/app/_components/DataCollectionSettings';
import { PrivacyModeSettings } from '@/app/_components/PrivacyModeSettings';
import { BlurPeopleSettings } from '@/app/_components/BlurPeopleSettings';
import { PatientAccessSettings } from '@/app/_components/PatientAccessSettings';
import { PatientIdentityStatus } from '@/app/_components/PatientIdentityStatus';
import { PauseMonitoringToggle } from '@/app/_components/PauseMonitoringToggle';
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
  const firstName = patient.preferred_name || patient.full_name;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6 max-w-3xl w-full mx-auto">
      <header>
        <h1 className="font-serif text-3xl tracking-tight text-ink">
          Patient settings
        </h1>
      </header>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-4 font-serif text-2xl text-ink">Profile</h2>
        <PatientForm mode="edit" initial={patient} />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-1 font-serif text-2xl text-ink">Shared access</h2>
        <p className="mb-4 text-sm text-ink3">
          People who can view and manage {firstName}. Invite another caregiver
          by their Memoria account email — they&apos;ll see {firstName} in their
          own dashboard. Only an owner can add or remove people.
        </p>
        <PatientAccessSettings patientId={patient.id} />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-1 font-serif text-2xl text-ink">Monitoring</h2>
        <p className="mb-4 text-sm text-ink3">
          Pause to stop watching {firstName}. All sensors turn off and
          AI alerts stop until you resume. Resume brings everything back
          in a few seconds.
        </p>
        <PauseMonitoringToggle
          patientId={patient.id}
          initialPaused={patient.cameras_paused}
        />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-1 font-serif text-2xl text-ink">Face enrollment</h2>
        <p className="mb-4 text-sm text-ink3">
          A few selfies of {firstName} help the app tell them apart from
          visitors. Add or update photos from the caregiver app on your
          phone.
        </p>
        <PatientIdentityStatus
          patientId={patient.id}
          patientName={firstName}
          surface="settings"
        />
      </section>

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

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-1 font-serif text-2xl text-ink">Privacy mode</h2>
        <p className="mb-4 text-sm text-ink3">
          Hide {firstName}&apos;s live video and audio and stop all recording.
          No one can watch or listen to the live feed, and nothing is stored.
          You still receive insights. This preserves {firstName}&apos;s dignity
          at all times. While on, it overrides Data collection below.
        </p>
        <PrivacyModeSettings
          patientId={patient.id}
          initialEnabled={patient.privacy_mode_enabled}
        />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-1 font-serif text-2xl text-ink">Blur people</h2>
        <p className="mb-4 text-sm text-ink3">
          Blur anyone who appears in {firstName}&apos;s live feed while keeping
          the room in view — helpful for extra dignity or when your screen is
          visible to others. This is a display-only filter that runs in your
          browser: it doesn&apos;t change recording, insights, or what anyone
          else sees, and it applies to this device only.
        </p>
        <BlurPeopleSettings patientId={patient.id} />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-1 font-serif text-2xl text-ink">Data collection</h2>
        <p className="mb-4 text-sm text-ink3">
          With your permission, Memoria will securely store video and audio
          clips of {firstName} to help improve our understanding of elderly
          health and disease. This is optional, never required, and you can
          turn it off anytime.
        </p>
        <DataCollectionSettings
          patientId={patient.id}
          initialEnabled={patient.data_collection_enabled}
          suspendedByPrivacy={patient.privacy_mode_enabled}
        />
      </section>
    </div>
  );
}
