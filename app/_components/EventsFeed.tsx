'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from '@supabase/supabase-js';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { formatLocalTime, timeAgo } from '@/lib/utils/time';
import { cn } from '@/lib/utils/cn';
import type { DetectionEvent } from '@/lib/api/types';

export function EventsFeed({
  patientId,
  initial,
}: {
  patientId: string;
  initial: DetectionEvent[];
}) {
  const [events, setEvents] = useState<DetectionEvent[]>(initial);
  const [tick, setTick] = useState(0);

  // Catch-up refetch. Realtime has NO replay: anything inserted while
  // this browser tab was hidden (the socket is throttled/dropped in a
  // backgrounded tab) is never pushed when the tab wakes. We re-pull the
  // latest page directly from Supabase — RLS scopes it to this caregiver
  // — so a freshly-fired event lands the moment the tab is visible again,
  // without a manual reload. Mirrors the iOS foreground `resync()`.
  const refetch = useCallback(async () => {
    const supa = await getAuthedBrowserSupabase();
    const { data } = await supa
      .from('events')
      .select('*')
      .eq('patient_id', patientId)
      .order('occurred_at', { ascending: false })
      .limit(50);
    if (data) setEvents(data as DetectionEvent[]);
  }, [patientId]);

  // Run once on mount (covers the gap between the server-rendered
  // `initial` and the live subscription) and on every tab-visible/focus.
  useEffect(() => {
    void refetch();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refetch]);

  // Must await getAuthedBrowserSupabase — see lib/supabase/client.ts for
  // the anon-role race that drops every broadcast otherwise.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void (async () => {
      const supa = await getAuthedBrowserSupabase();
      if (cancelled) return;
      const channel = supa
        .channel(`events:${patientId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'events',
            filter: `patient_id=eq.${patientId}`,
          },
          (payload: RealtimePostgresInsertPayload<DetectionEvent>) => {
            setEvents((prev) => {
              const next = payload.new;
              if (prev.some((e) => e.id === next.id)) return prev;
              return [next, ...prev].slice(0, 50);
            });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'events',
            filter: `patient_id=eq.${patientId}`,
          },
          (payload: RealtimePostgresUpdatePayload<DetectionEvent>) => {
            const updated = payload.new;
            setEvents((prev) =>
              prev.map((e) => (e.id === updated.id ? updated : e)),
            );
          },
        )
        .subscribe();
      cleanup = () => {
        void supa.removeChannel(channel);
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [patientId]);

  // Re-render every 30s so timeAgo strings stay fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Suppress unused-var lint without changing render output.
  void tick;

  const rows = useMemo(
    () =>
      [...events].sort((a, b) =>
        a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0,
      ),
    [events],
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-card px-6 py-16 text-center">
        <svg
          viewBox="0 0 24 24"
          className="h-10 w-10 text-ink3"
          aria-hidden="true"
        >
          <path
            d="M3 13l2.5-7h13L21 13M3 13v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5M3 13h5l1.5 2.5h5L16 13h5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <p className="font-serif text-2xl text-ink">Nothing to see here yet</p>
        <p className="max-w-sm text-base text-ink3">
          When a detector notices something, events will stream in here. Pair a
          Memoria Sensor to start monitoring.
        </p>
      </div>
    );
  }

  return (
    <ul
      className="divide-y divide-line rounded-lg border border-line bg-card overflow-hidden"
      aria-label="detection events"
    >
      {rows.map((e) => (
        <li
          key={e.id}
          className={cn(
            'flex items-start gap-3 px-4 py-3',
            e.category === 'safety' && 'bg-terra-soft/30',
          )}
        >
          <span
            className={cn(
              'mt-1 inline-flex shrink-0 items-center rounded-sm border px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider',
              e.category === 'safety'
                ? 'border-terra/40 bg-terra-soft text-terra-deep'
                : 'border-sky/40 bg-sky-soft text-sky',
            )}
          >
            {e.category}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl text-ink">{e.title}</p>
            {e.narrative && (
              <p className="mt-1 text-base leading-relaxed text-ink2">
                {e.narrative}
              </p>
            )}
            {/* timeAgo is clock-dependent, so SSR and hydration can disagree
                by a second — scope hydration tolerance to this line's text. */}
            <p className="mt-1.5 font-mono text-xs text-ink4 tracking-wide" suppressHydrationWarning>
              {e.location} · {timeAgo(e.occurred_at)} ·{' '}
              <code>{formatLocalTime(e.occurred_at)}</code>
              {e.reviewed && <> · reviewed</>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
