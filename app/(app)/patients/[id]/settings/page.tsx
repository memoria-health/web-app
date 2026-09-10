import { notFound } from 'next/navigation';
import { PatientForm } from '@/app/_components/PatientForm';
import { EmailAlertsSettings } from '@/app/_components/EmailAlertsSettings';
import { EvaluationModeSettings } from '@/app/_components/EvaluationModeSettings';
import { DataCollectionSettings } from '@/app/_components/DataCollectionSettings';
import { BlurPeopleSettings } from '@/app/_components/BlurPeopleSettings';
import { PatientAccessSettings } from '@/app/_components/PatientAccessSettings';
import { PatientIdentityStatus } from '@/app/_components/PatientIdentityStatus';
import { AudioCaptureToggle } from '@/app/_components/AudioCaptureToggle';
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
    <div className="anim-stagger flex flex-1 flex-col gap-6 px-6 py-6 max-w-3xl w-full mx-auto">
      <header>
        <h1 className="font-serif text-3xl tracking-tight text-ink">
          Advanced settings
        </h1>
      </header>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-4 font-serif text-2xl text-ink">Profile</h2>
        <PatientForm mode="edit" initial={patient} />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-4 font-serif text-2xl text-ink">Shared access</h2>
        <PatientAccessSettings patientId={patient.id} />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-4 font-serif text-2xl text-ink">Monitoring</h2>
        <PauseMonitoringToggle
          patientId={patient.id}
          initialPaused={patient.cameras_paused}
        />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-4 font-serif text-2xl text-ink">Audio</h2>
        <AudioCaptureToggle
          patientId={patient.id}
          initialEnabled={patient.audio_capture_enabled}
        />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-4 font-serif text-2xl text-ink">Face enrollment</h2>
        <PatientIdentityStatus
          patientId={patient.id}
          patientName={firstName}
          surface="settings"
        />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-4 font-serif text-2xl text-ink">Email alerts</h2>
        <EmailAlertsSettings
          patientId={patient.id}
          accountEmail={accountEmail}
          initialEnabled={patient.email_alerts_enabled}
          initialRecipients={patient.email_alert_recipients}
        />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-4 font-serif text-2xl text-ink">Privacy</h2>
        <BlurPeopleSettings patientId={patient.id} />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="font-serif text-2xl text-ink">Accuracy</h2>
          <span className="rounded-full bg-action-soft px-2 py-0.5 text-[10px] font-bold tracking-wide text-action">
            RECOMMENDED
          </span>
        </div>
        <EvaluationModeSettings
          patientId={patient.id}
          initialEnabled={patient.event_gate_enabled}
        />
      </section>

      <section className="rounded-lg border border-line bg-card px-5 py-5">
        <h2 className="mb-4 font-serif text-2xl text-ink">Data collection</h2>
        <DataCollectionSettings
          patientId={patient.id}
          initialEnabled={patient.data_collection_enabled}
        />
      </section>
    </div>
  );
}
