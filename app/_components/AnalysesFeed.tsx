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
              // Sort by captured_at (when the clip was taken), not
              // arrival order. Gemini calls vary in latency (~3-15s),
              // so a slow T-tick can land after a fast T+10 tick if
              // we just prepend by insert order.
              return [next, ...prev]
                .sort((a, b) => b.captured_at.localeCompare(a.captured_at))
                .slice(0, MAX_ROWS);
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
    <div className="mb-2 rounded-md border border-warning/40 bg-card-alt px-3 py-2 font-mono text-xs leading-relaxed text-ink2">
      <strong className="text-warning">[DEBUG]</strong>{' '}
      mounted={String(debug.mounted)} · subStatus={debug.subStatus} ·
      eventsReceived={debug.eventsReceived} ·
      lastEventAt={debug.lastEventAt ?? '—'} · rowsInState={rows.length}
      {cameraId && (
        <> · cam={cameraId.slice(0, 8)}…</>
      )}
      {debug.error && (
        <> · <span className="text-terra">err={debug.error}</span></>
      )}
    </div>
  );

  // Optional per-camera label header (when cameraId is set, this feed
  // is one cell of a per-camera grid — show the room name so the user
  // knows which video tile it pairs with).
  const headerBar = cameraLabel ? (
    <div className="mb-2 flex items-center justify-between">
      <span className="font-serif text-xl text-ink">{cameraLabel}</span>
      <span className="font-mono text-xs text-ink4 tracking-wide">
        {cameraId?.slice(0, 8)}…
      </span>
    </div>
  ) : null;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col">
        {headerBar}
        {debugBar}
        <div className="rounded-lg border border-dashed border-line bg-card px-4 py-8 text-center text-base text-ink3">
          Waiting for the detector worker to produce a tick…<br />
          <span className="text-xs text-ink4">
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
        className="divide-y divide-line rounded-lg border border-line bg-card overflow-hidden"
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

  // Re-ID's per-clip verdict. asBool collapses missing into false, so
  // keep the raw value around to distinguish "Re-ID ran and said no
  // patient" from "Re-ID didn't run this tick" (no enrollment, timeout,
  // skipped reason, etc). We render nothing in the unknown case.
  const patientInClipRaw = f.identity_patient_in_clip;
  const patientInClipKnown = typeof patientInClipRaw === 'boolean';
  const patientInClip = patientInClipRaw === true;

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
        'flex flex-col gap-2 px-4 py-3',
        fallDetected && 'bg-terra-soft/40',
      )}
    >
      {/* metadata row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-ink3 tracking-wide">
          {timeAgo(a.captured_at)}
        </span>
        <span className="font-mono text-ink4 truncate max-w-[12rem] tracking-wide">
          cam {a.camera_id.slice(0, 8)}
        </span>
        {/* patient present (Re-ID verdict) */}
        {patientInClipKnown && (
          <span
            className={cn(
              'inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono uppercase tracking-wider',
              patientInClip
                ? 'border-success/40 bg-card-alt text-success'
                : 'border-line bg-paper-dim text-ink4',
            )}
          >
            {patientInClip ? 'patient present' : 'no patient'}
          </span>
        )}
        {/* motion */}
        <span
          className={cn(
            'inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono uppercase tracking-wider',
            a.motion_in_clip
              ? 'border-warning/40 bg-card-alt text-warning'
              : 'border-line bg-paper-dim text-ink4',
          )}
        >
          {a.motion_in_clip ? 'motion' : 'still'}
        </span>
        {/* provider */}
        <span
          className={cn(
            'ml-auto inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono uppercase tracking-wider',
            a.provider === 'gemini' && 'border-sky/40 bg-sky-soft text-sky',
            a.provider === 'openai' && 'border-sky/40 bg-sky-soft text-sky',
            a.provider === 'skipped' && 'border-line bg-paper-dim text-ink4',
          )}
        >
          {a.provider}
        </span>
        {/* fall + wandering + agitation badges (right-aligned cluster) */}
        {fallDetected && (
          <span className="inline-flex items-center rounded-sm bg-terra px-2 py-0.5 font-mono font-semibold uppercase tracking-wider text-terra-ink">
            FALL · {fallConf ?? '?'}
          </span>
        )}
        {wanderingDetected && (
          <span className="inline-flex items-center rounded-sm border border-warning/40 bg-card-alt px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wider text-warning">
            WANDERING · {wanderingConf ?? '?'}
          </span>
        )}
        {agitationDetected && (
          <span className="inline-flex items-center rounded-sm border border-terra/40 bg-terra-soft px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wider text-terra-deep">
            AGITATION · {agitationConf ?? '?'}
          </span>
        )}
        {medicationTaken && (
          <span className="inline-flex items-center rounded-sm border border-success/40 bg-card-alt px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wider text-success">
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
              className="inline-flex items-center rounded-sm border border-sky/40 bg-sky-soft px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wider text-sky"
            >
              {d.name.toUpperCase()} · {d.confidence ?? '?'}
            </span>
          ))}
      </div>

      {/* description */}
      <p className="text-base leading-relaxed text-ink">
        {skippedReason ? (
          <span className="italic text-ink4">
            tick skipped — {skippedReason.replace(/_/g, ' ')}
          </span>
        ) : (
          a.description
        )}
      </p>

      {/* reasonings */}
      {fallReason && (
        <p className="text-base leading-relaxed text-ink2">
          <span className="font-semibold text-terra">Fall reasoning: </span>
          {fallReason}
        </p>
      )}
      {wanderingReason && (
        <p className="text-base leading-relaxed text-ink2">
          <span className="font-semibold text-warning">Wandering reasoning: </span>
          {wanderingReason}
        </p>
      )}
      {agitationReason && (
        <p className="text-base leading-relaxed text-ink2">
          <span className="font-semibold text-terra-deep">Agitation reasoning: </span>
          {agitationReason}
        </p>
      )}
      {medicationReason && (
        <p className="text-base leading-relaxed text-ink2">
          <span className="font-semibold text-success">Medication reasoning: </span>
          {medicationReason}
        </p>
      )}

      {/* Custom detector reasonings — shown whether detected was true
          or not (the LLM always returns a reasoning explaining its
          judgment, useful to see why it said "no" too). */}
      {customDetectorEntries.map((d) =>
        d.reasoning ? (
          <p key={`reason-${d.identifier}`} className="text-base leading-relaxed text-ink2">
            <span className="font-semibold text-sky">
              {d.name} reasoning:{' '}
            </span>
            {d.reasoning}
          </p>
        ) : null,
      )}

      {/* speech */}
      {speechHeard && speechTranscript && (
        <p className="text-base leading-relaxed text-ink2">
          <span className="font-semibold text-sky">Speech: </span>
          &ldquo;{speechTranscript}&rdquo;
        </p>
      )}
    </li>
  );
}
