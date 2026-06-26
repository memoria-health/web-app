import { notFound } from 'next/navigation';
import { PatientProvider } from '@/app/_components/PatientProvider';
import { LiveRoomProvider } from '@/app/_components/LiveRoomProvider';
import { patientSession } from '@/lib/server/patientSession';
import { getServerNemara } from '@/lib/api/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { env } from '@/lib/env';

/// Per-patient layout. Every page under /patients/[id]/* lives inside
/// this. We re-wrap PatientProvider with `selected = the URL patient`,
/// overriding the outer layout's `selected = null`, so children that
/// use `usePatient()` get the URL-resolved patient. The visible
/// per-patient chrome (sub-tabs + switcher) is rendered by TopNav
/// based on the URL — no separate sub-bar needed.
///
/// LiveKit Room is mounted HERE (not down in `<VideoGrid>`) so the
/// room connection survives sub-tab navigation. See LiveRoomProvider
/// for the full rationale.
export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { patients } = await patientSession();
  const patient = patients.find((p) => p.id === id);
  if (!patient) notFound();

  // Mint a viewer token for this patient's room. Room identity matches
  // the convention used everywhere else: `patient_<id>` for the room,
  // `caregiver_<uid>_web` for the caregiver participant. Failure is
  // non-fatal — LiveRoomProvider will skip mounting LiveKitRoom and
  // children that depend on it (VideoGrid) will show a placeholder.
  const api = await getServerNemara();
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();

  let lkToken: string | null = null;
  try {
    const minted = await api.mintLiveKitToken({
      room: `patient_${patient.id}`,
      identity: `caregiver_${user!.id}_web`,
      role: 'viewer',
    });
    lkToken = minted.token;
  } catch {
    lkToken = null;
  }

  return (
    <PatientProvider patients={patients} selected={patient}>
      {/* `key` flips with privacy state so a privacy toggle REMOUNTS the
          room — forcing a fresh LiveKit connect with the just-minted
          token (severed `can_subscribe=false` when on, restored when
          off). Without this, `router.refresh()` re-mints the token but
          the already-connected `<LiveKitRoom>` keeps its old severed
          session, so the feed never comes back after turning privacy off
          (you'd have to hard-refresh). Keyed on the boolean, NOT the
          token, so ordinary token refreshes + sub-tab nav don't churn the
          connection. */}
      <LiveRoomProvider
        key={patient.privacy_mode_enabled ? 'privacy-on' : 'privacy-off'}
        token={lkToken}
        serverUrl={env.LIVEKIT_URL}
      >
        {children}
      </LiveRoomProvider>
    </PatientProvider>
  );
}
