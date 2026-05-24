'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/utils/time';
import { cn } from '@/lib/utils/cn';
import type { Analysis } from '@/lib/api/types';

const MAX_ROWS = 50;

function pct(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return `${Math.round(v * 100)}%`;
}

function asBool(v: unknown): boolean {
  return v === true;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function AnalysesFeed({
  patientId,
  initial = [],
}: {
  patientId: string;
  initial?: Analysis[];
}) {
  const [rows, setRows] = useState<Analysis[]>(initial);
  const [tick, setTick] = useState(0);
  const [debug, setDebug] = useState<{
    mounted: boolean;
    subStatus: string;
    eventsReceived: number;
    lastEventAt: string | null;
    error: string | null;
  }>({
    mounted: false,
    subStatus: 'mounting',
    eventsReceived: 0,
    lastEventAt: null,
    error: null,
  });

  useEffect(() => {
    console.log('[ANALYSES-FEED] mount, patientId=', patientId);
    setDebug((d) => ({ ...d, mounted: true, subStatus: 'subscribing' }));

    let receivedCount = 0;
    const supa = getBrowserSupabase();
    const channel = supa
      .channel(`analyses-debug-${patientId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'analyses',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload: RealtimePostgresInsertPayload<Analysis>) => {
          receivedCount += 1;
          console.log(
            '[ANALYSES-FEED] postgres_changes received:',
            payload.new.id,
            payload.new.provider,
            payload.new.created_at,
          );
          setDebug((d) => ({
            ...d,
            eventsReceived: receivedCount,
            lastEventAt: new Date().toISOString(),
          }));
          setRows((prev) => {
            const next = payload.new;
            if (prev.some((r) => r.id === next.id)) return prev;
            return [next, ...prev].slice(0, MAX_ROWS);
          });
        },
      )
      .subscribe((status: string, err?: Error) => {
        console.log('[ANALYSES-FEED] subscribe status:', status, err);
        setDebug((d) => ({
          ...d,
          subStatus: status,
          error: err ? String(err) : null,
        }));
      });
    return () => {
      console.log('[ANALYSES-FEED] unmount, removing channel');
      void supa.removeChannel(channel);
    };
  }, [patientId]);

  // Re-render every 5s so relative timestamps stay fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const debugBar = (
    <div className="mb-2 rounded border border-amber-700 bg-amber-950/30 px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-200">
      <strong className="text-amber-400">[DEBUG]</strong>{' '}
      mounted={String(debug.mounted)} · subStatus={debug.subStatus} ·
      eventsReceived={debug.eventsReceived} ·
      lastEventAt={debug.lastEventAt ?? '—'} · rowsInState={rows.length} ·
      patientId={patientId.slice(0, 8)}…{debug.error && (
        <> · <span className="text-red-400">err={debug.error}</span></>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <>
        {debugBar}
        <div className="rounded border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          Waiting for the detector worker to produce a tick…<br />
          <span className="text-xs text-zinc-600">
            (about every 10 seconds when motion is detected)
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      {debugBar}
      <ul
        className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-950"
        aria-label="detection analyses"
      >
        {rows.map((a) => (
          <AnalysisRow key={a.id} a={a} />
        ))}
      </ul>
    </>
  );
}

function AnalysisRow({ a }: { a: Analysis }) {
  const f = a.detector_fields ?? {};

  const peopleCount = asNumber(f.people_count) ?? (a.people_present ? 1 : 0);

  const fallDetected = asBool(f.fall_detected);
  const fallConf = pct(f.fall_confidence);
  const fallReason = asString(f.fall_reasoning);

  const wanderingDetected = asBool(f.wandering_detected);
  const wanderingConf = pct(f.wandering_confidence);
  const wanderingReason = asString(f.wandering_reasoning);

  const agitationDetected = asBool(f.agitation_detected);
  const agitationConf = pct(f.agitation_confidence);
  const agitationReason = asString(f.agitation_reasoning);

  const medicationTaken = asBool(f.medication_taken);
  const medicationConf = pct(f.medication_confidence);
  const medicationReason = asString(f.medication_reasoning);

  const speechHeard = asBool(f.speech_heard);
  const speechTranscript = asString(f.speech_transcript);

  const skippedReason = asString(f.skipped_reason);

  return (
    <li
      className={cn(
        'flex flex-col gap-1.5 px-3 py-2.5',
        fallDetected && 'bg-red-950/40',
      )}
    >
      {/* metadata row */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono text-zinc-500">
          {timeAgo(a.created_at)}
        </span>
        <span className="font-mono text-zinc-600 truncate max-w-[12rem]">
          cam {a.camera_id.slice(0, 8)}
        </span>
        {/* people */}
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono',
            a.people_present
              ? 'border-emerald-700 bg-emerald-950/60 text-emerald-300'
              : 'border-zinc-800 bg-zinc-900 text-zinc-500',
          )}
        >
          👤 {peopleCount}
        </span>
        {/* motion */}
        <span
          className={cn(
            'inline-flex items-center rounded border px-1.5 py-0.5 font-mono uppercase tracking-wide',
            a.motion_in_clip
              ? 'border-amber-700 bg-amber-950/40 text-amber-300'
              : 'border-zinc-800 bg-zinc-900 text-zinc-500',
          )}
        >
          {a.motion_in_clip ? 'motion' : 'still'}
        </span>
        {/* state */}
        <span
          className={cn(
            'inline-flex items-center rounded border px-1.5 py-0.5 font-mono uppercase tracking-wide',
            a.state_after === 'open'
              ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
              : 'border-zinc-700 bg-zinc-900 text-zinc-400',
          )}
        >
          {a.state_after}
        </span>
        {/* provider */}
        <span
          className={cn(
            'ml-auto inline-flex items-center rounded border px-1.5 py-0.5 font-mono uppercase tracking-wide',
            a.provider === 'gemini' && 'border-sky-800 bg-sky-950/50 text-sky-300',
            a.provider === 'openai' && 'border-purple-800 bg-purple-950/50 text-purple-300',
            a.provider === 'skipped' && 'border-zinc-800 bg-zinc-900 text-zinc-500',
          )}
        >
          {a.provider}
        </span>
        {/* fall + wandering + agitation badges (right-aligned cluster) */}
        {fallDetected && (
          <span className="inline-flex items-center rounded bg-red-600 px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wide text-white">
            FALL · {fallConf ?? '?'}
          </span>
        )}
        {wanderingDetected && (
          <span className="inline-flex items-center rounded border border-yellow-700 bg-yellow-950/40 px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wide text-yellow-200">
            WANDERING · {wanderingConf ?? '?'}
          </span>
        )}
        {agitationDetected && (
          <span className="inline-flex items-center rounded border border-orange-700 bg-orange-950/40 px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wide text-orange-200">
            AGITATION · {agitationConf ?? '?'}
          </span>
        )}
        {medicationTaken && (
          <span className="inline-flex items-center rounded border border-emerald-800 bg-emerald-950/40 px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wide text-emerald-300">
            MEDICATION · {medicationConf ?? '?'}
          </span>
        )}
      </div>

      {/* description */}
      <p className="text-[14px] leading-relaxed text-zinc-100">
        {skippedReason ? (
          <span className="italic text-zinc-500">
            tick skipped — {skippedReason.replace(/_/g, ' ')}
          </span>
        ) : (
          a.description
        )}
      </p>

      {/* reasonings */}
      {fallReason && (
        <p className="text-[12px] leading-relaxed text-amber-200/80">
          <span className="font-semibold text-amber-400">Fall reasoning: </span>
          {fallReason}
        </p>
      )}
      {wanderingReason && (
        <p className="text-[12px] leading-relaxed text-yellow-200/80">
          <span className="font-semibold text-yellow-400">Wandering reasoning: </span>
          {wanderingReason}
        </p>
      )}
      {agitationReason && (
        <p className="text-[12px] leading-relaxed text-orange-200/80">
          <span className="font-semibold text-orange-400">Agitation reasoning: </span>
          {agitationReason}
        </p>
      )}
      {medicationReason && (
        <p className="text-[12px] leading-relaxed text-emerald-200/80">
          <span className="font-semibold text-emerald-400">Medication reasoning: </span>
          {medicationReason}
        </p>
      )}

      {/* speech */}
      {speechHeard && speechTranscript && (
        <p className="text-[12px] leading-relaxed text-sky-200/90">
          <span className="font-semibold text-sky-400">Speech: </span>
          &ldquo;{speechTranscript}&rdquo;
        </p>
      )}
    </li>
  );
}
