import { getServerNemara } from '@/lib/api/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { VideoGrid } from '@/app/_components/VideoGrid';
import { EventsFeed } from '@/app/_components/EventsFeed';
import { AnalysesFeed } from '@/app/_components/AnalysesFeed';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const api = await getServerNemara();
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();

  const patients = await api.listPatients();
  const patient = patients[0];

  // Mint a viewer LiveKit token for this patient's room.
  // Token TTL is 1h on the backend; user refreshes to renew.
  const room = `patient_${patient.id}`;
  const identity = `caregiver_${user!.id}`;

  let token: string | null = null;
  let lkError: string | null = null;
  try {
    const minted = await api.mintLiveKitToken({
      room,
      identity,
      role: 'viewer',
    });
    token = minted.token;
  } catch (err) {
    lkError = err instanceof Error ? err.message : String(err);
  }

  const events = await api.listEvents(patient.id, { limit: 30 });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <section className="max-w-2xl">
        <header className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Live Grid
          </h2>
          <span className="text-[11px] font-mono text-zinc-600">
            room: {room}
          </span>
        </header>
        {lkError ? (
          <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            Couldn&apos;t mint LiveKit token: {lkError}
          </div>
        ) : (
          <VideoGrid token={token!} serverUrl={env.LIVEKIT_URL} />
        )}
      </section>

      <section>
        <header className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Live LLM analyses
          </h2>
          <span className="text-[11px] text-zinc-600">
            one row per ~10s tick · provider, people, fall, wandering,
            agitation, medication, speech
          </span>
        </header>
        <AnalysesFeed patientId={patient.id} />
      </section>

      <section>
        <header className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Promoted events
          </h2>
          <span className="text-[11px] text-zinc-600">
            {events.items.length} recent · only when a detector fires
          </span>
        </header>
        <EventsFeed patientId={patient.id} initial={events.items} />
      </section>
    </div>
  );
}
