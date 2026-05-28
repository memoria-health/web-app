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
      <LiveRoomProvider token={lkToken} serverUrl={env.LIVEKIT_URL}>
        {children}
      </LiveRoomProvider>
    </PatientProvider>
  );
}
