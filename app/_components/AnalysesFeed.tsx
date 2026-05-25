'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/utils/time';
import { cn } from '@/lib/utils/cn';
import type { Analysis, Detector } from '@/lib/api/types';

// Identifiers handled by the hardcoded chip/reasoning rendering paths
// below. Custom detectors fall through to the generic renderer.
const HARDCODED_IDENTIFIERS = new Set([
  'fall', 'wandering', 'agitation', 'medication',
]);

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
  enabledCameraIds,
  cameraId,
  cameraLabel,
  initial = [],
  detectors = [],
}: {
  patientId: string;
  // Whitelist of camera IDs to show analyses for. Analyses from
  // disabled cameras (or all cameras when patient.cameras_paused is
  // true) are dropped both on initial render and as they arrive via
  // Realtime. The backend writes synthetic "skipped" rows for them
  // anyway — this filter just keeps the UI clean from the user's POV.
  enabledCameraIds: string[];
  // Optional: pin this feed to a SINGLE camera. When set, only that
  // camera's rows are shown. Used by the dashboard's 2-col grid where
  // each cell is a per-camera feed. When omitted, the feed shows
  // every enabled camera's rows interleaved (legacy single-feed shape).
  cameraId?: string;
  // Optional label shown above the feed when cameraId is set — usually
  // the camera's room name, so the user knows which tile this feed
  // belongs to.
  cameraLabel?: string;
  initial?: Analysis[];
  // Patient's detector list. Used to resolve custom-detector
  // identifiers (e.g. `custom_b05b58a7`) to human-readable names
  // (e.g. "Drinking water") when rendering reasoning lines.
  detectors?: Detector[];
}) {
  // If `cameraId` is set, narrow the enabled set to JUST that camera.
  // This lets the same single Realtime subscription filter rows for N
  // side-by-side feeds without N duplicate channels.
  const enabledSet = new Set(
    cameraId ? [cameraId] : enabledCameraIds,
  );
  const [rows, setRows] = useState<Analysis[]>(
    initial.filter((r) => enabledSet.has(r.camera_id)),
  );
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
    console.log('[ANALYSES-FEED] mount, patientId=', patientId, 'time=', new Date().toISOString());
    setDebug((d) => ({ ...d, mounted: true, subStatus: 'awaiting-auth' }));

    let receivedCount = 0;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    // CRITICAL: await the authed client before subscribing. If we subscribe
    // synchronously with the un-authed client, the subscription registers
    // on the realtime server with claims.role="anon" and claims.sub="" —
    // and the RLS policy `caregiver_id = auth.uid()` on analyses then
    // evaluates auth.uid() as NULL, silently dropping every broadcast.
    // The channel will still say SUBSCRIBED. We've been bitten by this.
    void (async () => {
      const supa = await getAuthedBrowserSupabase();
      if (cancelled) return;

      // Channel name MUST include cameraId when set. Without it, two
      // panels mounted in the same render tick get identical Date.now()
      // values → identical channel names → Supabase shares one channel
      // between them → only one panel actually receives events. The
      // other stays silently empty even though the backend is writing
      // rows for that camera. Including cameraId guarantees uniqueness
      // per panel.
      const channelName = cameraId
        ? `analyses-${patientId}-${cameraId}-${Date.now()}`
        : `analyses-${patientId}-all-${Date.now()}`;
      console.log('[ANALYSES-FEED] creating channel (auth ready):', channelName);
      setDebug((d) => ({ ...d, subStatus: 'subscribing' }));

      const channel = supa
        .channel(channelName)
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
              'camera_in_enabled_set:',
              enabledSet.has(payload.new.camera_id),
            );
            setDebug((d) => ({
              ...d,
              eventsReceived: receivedCount,
              lastEventAt: new Date().toISOString(),
            }));
            // Drop analyses from disabled cameras silently — the backend
            // wrote them (as `skipped` rows) but the user has chosen not
            // to see them. Decision happens here, not on the server,
            // because the user can toggle cameras on/off live and we
            // don't want to re-subscribe.
            if (!enabledSet.has(payload.new.camera_id)) return;
            setRows((prev) => {
              const next = payload.new;
              if (prev.some((r) => r.id === next.id)) return prev;
              return [next, ...prev].slice(0, MAX_ROWS);
            });
          },
        )
        .subscribe((status: string, err?: Error) => {
          console.log(
            '[ANALYSES-FEED] subscribe status:',
            status,
            err ? `err=${err}` : '',
            'time=', new Date().toISOString(),
            'channelName=', channelName,
          );
          setDebug((d) => ({
            ...d,
            subStatus: status,
            error: err ? String(err) : null,
          }));
        });

      // Heartbeat every 30s so we can SEE the channel is still alive
      // (or notice it went silent).
      const heartbeat = setInterval(() => {
        console.log(
          '[ANALYSES-FEED] heartbeat — events received so far:',
          receivedCount,
          'time=', new Date().toISOString(),
        );
      }, 30000);

      cleanup = () => {
        console.log('[ANALYSES-FEED] unmount, removing channel');
        clearInterval(heartbeat);
        void supa.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // Re-subscribe (effectively just re-bind the enabledSet closure)
    // whenever the enabled camera list changes — so toggling a camera
    // off from /cameras takes effect on this feed immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, cameraId, enabledCameraIds.join(',')]);

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
      lastEventAt={debug.lastEventAt ?? '—'} · rowsInState={rows.length}
      {cameraId && (
        <> · cam={cameraId.slice(0, 8)}…</>
      )}
      {debug.error && (
        <> · <span className="text-red-400">err={debug.error}</span></>
      )}
    </div>
  );

  // Optional per-camera label header (when cameraId is set, this feed
  // is one cell of a per-camera grid — show the room name so the user
  // knows which video tile it pairs with).
  const headerBar = cameraLabel ? (
    <div className="mb-1 flex items-center justify-between text-[11px]">
      <span className="font-mono text-zinc-400">{cameraLabel}</span>
      <span className="font-mono text-zinc-600">
        {cameraId?.slice(0, 8)}…
      </span>
    </div>
  ) : null;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col">
        {headerBar}
        {debugBar}
        <div className="rounded border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          Waiting for the detector worker to produce a tick…<br />
          <span className="text-xs text-zinc-600">
            (about every 10 seconds when motion is detected)
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {headerBar}
      {debugBar}
      <ul
        className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-950"
        aria-label="detection analyses"
      >
        {rows.map((a) => (
          <AnalysisRow key={a.id} a={a} detectors={detectors} />
        ))}
      </ul>
    </div>
  );
}

function AnalysisRow({
  a,
  detectors,
}: {
  a: Analysis;
  detectors: Detector[];
}) {
  const f = a.detector_fields ?? {};

  // identifier → human-readable name. Used for custom detector labels.
  // Built once per row from the patient's detector list.
  const nameByIdentifier = new Map<string, string>();
  for (const d of detectors) {
    if ((d as Detector & { identifier?: string | null }).identifier) {
      nameByIdentifier.set(
        (d as Detector & { identifier?: string }).identifier!,
        d.name,
      );
    }
  }

  // Find every `*_detected` and `*_reasoning` key in detector_fields
  // that doesn't belong to one of the hardcoded presets (fall,
  // wandering, agitation, medication) or to a non-detector key
  // (people_*, speech_*, motion_*, skipped_*). What remains are the
  // custom detectors compiled via the detector_compiler — render them
  // generically below.
  const customDetectorEntries: Array<{
    identifier: string;
    name: string;
    detected: boolean;
    confidence: string | null;
    reasoning: string | null;
  }> = [];
  const seenIdentifiers = new Set<string>();
  for (const key of Object.keys(f)) {
    // Pull the identifier out of `<id>_detected` / `<id>_reasoning`
    // / `<id>_confidence`. The shared prefix is the identifier.
    let identifier: string | null = null;
    if (key.endsWith('_detected')) identifier = key.slice(0, -'_detected'.length);
    else if (key.endsWith('_reasoning')) identifier = key.slice(0, -'_reasoning'.length);
    else if (key.endsWith('_confidence')) identifier = key.slice(0, -'_confidence'.length);
    if (identifier === null) continue;
    if (seenIdentifiers.has(identifier)) continue;
    if (HARDCODED_IDENTIFIERS.has(identifier)) continue;
    // Filter out non-detector field families that happen to use a
    // similar suffix pattern (speech_*, people_*, etc.).
    if (
      identifier === 'speech' ||
      identifier === 'people' ||
      identifier === 'motion' ||
      identifier === 'skipped'
    ) continue;
    seenIdentifiers.add(identifier);
    customDetectorEntries.push({
      identifier,
      name: nameByIdentifier.get(identifier) ?? identifier,
      detected: asBool(f[`${identifier}_detected`]),
      confidence: pct(f[`${identifier}_confidence`]),
      reasoning: asString(f[`${identifier}_reasoning`]),
    });
  }

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
        {/* Custom detector chips — only shown when the detector
            actually fired this tick (detected=true). */}
        {customDetectorEntries
          .filter((d) => d.detected)
          .map((d) => (
            <span
              key={`chip-${d.identifier}`}
              className="inline-flex items-center rounded border border-sky-700 bg-sky-950/50 px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wide text-sky-300"
            >
              {d.name.toUpperCase()} · {d.confidence ?? '?'}
            </span>
          ))}
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

      {/* Custom detector reasonings — shown whether detected was true
          or not (the LLM always returns a reasoning explaining its
          judgment, useful to see why it said "no" too). */}
      {customDetectorEntries.map((d) =>
        d.reasoning ? (
          <p key={`reason-${d.identifier}`} className="text-[12px] leading-relaxed text-sky-200/80">
            <span className="font-semibold text-sky-400">
              {d.name} reasoning:{' '}
            </span>
            {d.reasoning}
          </p>
        ) : null,
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
