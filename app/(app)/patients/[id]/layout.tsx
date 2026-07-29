import { notFound } from 'next/navigation';
import { PatientProvider } from '@/app/_components/PatientProvider';
import { SetupBreadcrumb } from '@/app/_components/SetupBreadcrumb';
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

  // Mint a viewer token for this patient's room. Room is `patient_<id>`.
  // The caregiver participant identity keeps the canonical `caregiver_<uid>_web`
  // prefix (the backend requires `caregiver_` so the privacy media-cut can
  // target it; see nemara-backend src/api/livekit.py) but appends a per-connection
  // random suffix. Without it, two web tabs (or laptop+phone) on the SAME patient
  // mint the IDENTICAL identity, and LiveKit evicts the duplicate → the two
  // connections thrash each other (endless connecting/disconnecting). A unique
  // suffix lets them coexist as separate viewers. Generated per server render, so
  // it's stable within a tab (layouts persist across sub-tab nav) and distinct
  // per new tab. Failure to mint is non-fatal — LiveRoomProvider skips the room.
  const api = await getServerNemara();
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();

  let lkToken: string | null = null;
  try {
    const minted = await api.mintLiveKitToken({
      room: `patient_${patient.id}`,
      identity: `caregiver_${user!.id}_web_${crypto.randomUUID().slice(0, 8)}`,
      role: 'viewer',
    });
    lkToken = minted.token;
  } catch {
    lkToken = null;
  }

  return (
    <PatientProvider patients={patients} selected={patient}>
      {/* `privacyMode` drives an IN-PLACE room reconnect inside the
          provider when privacy flips (the layout re-mints `token` to
          match — severed when on, restored when off). We pass the flag
          rather than keying the provider, so the room reconnects without
          remounting the page the caregiver is on (no flash / scroll
          jump). */}
      <LiveRoomProvider
        token={lkToken}
        serverUrl={env.LIVEKIT_URL}
        privacyMode={patient.privacy_mode_enabled}
      >
        <SetupBreadcrumb />
        {children}
      </LiveRoomProvider>
    </PatientProvider>
  );
}
