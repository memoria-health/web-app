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
      <p className="text-sm text-zinc-500">
        No detections yet. Pair a wall phone and let it publish — events will
        stream in here.
      </p>
    );
  }

  return (
    <ul
      className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-950"
      aria-label="detection events"
    >
      {rows.map((e) => (
        <li
          key={e.id}
          className={cn(
            'flex items-start gap-3 px-3 py-2.5',
            e.category === 'safety' && 'bg-red-950/20',
          )}
        >
          <span
            className={cn(
              'mt-0.5 inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              e.category === 'safety'
                ? 'border-red-800 bg-red-950/60 text-red-300'
                : 'border-sky-800 bg-sky-950/60 text-sky-300',
            )}
          >
            {e.category}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">{e.title}</p>
            {e.narrative && (
              <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-400">
                {e.narrative}
              </p>
            )}
            <p className="mt-1 text-[11px] text-zinc-500">
              {e.location} · {timeAgo(e.occurred_at)} ·{' '}
              <code className="font-mono">{e.occurred_at.slice(11, 19)}</code>
              {e.has_clip && (
                <>
                  {' '}
                  · <span className="text-emerald-400">clip</span>
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
