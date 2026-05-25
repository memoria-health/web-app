'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from '@supabase/supabase-js';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/utils/time';
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
      <p className="text-sm text-ink3 italic">
        No detections yet. Pair a wall phone and let it publish — events will
        stream in here.
      </p>
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
              'mt-1 inline-flex shrink-0 items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
              e.category === 'safety'
                ? 'border-terra/40 bg-terra-soft text-terra-deep'
                : 'border-sky/40 bg-sky-soft text-sky',
            )}
          >
            {e.category}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-base text-ink">{e.title}</p>
            {e.narrative && (
              <p className="mt-1 text-sm leading-relaxed text-ink2">
                {e.narrative}
              </p>
            )}
            <p className="mt-1.5 font-mono text-[11px] text-ink4 tracking-wide">
              {e.location} · {timeAgo(e.occurred_at)} ·{' '}
              <code>{e.occurred_at.slice(11, 19)}</code>
              {e.has_clip && (
                <>
                  {' '}
                  · <span className="text-terra">clip</span>
                </>
              )}
              {e.reviewed && <> · reviewed</>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
