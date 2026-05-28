'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  RealtimePostgresDeletePayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from '@supabase/supabase-js';
import { getBrowserNemara } from '@/lib/api/client';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import type { Detector, DetectorSensitivity } from '@/lib/api/types';

const SENSITIVITY: DetectorSensitivity[] = ['low', 'standard', 'high', 'off'];

export function DetectorList({
  initial,
  patientId,
  totalCameras,
  cameraCount,
}: {
  initial: Detector[];
  patientId: string;
  // Total cameras for this patient — used to render the "N / total" chip.
  totalCameras: number;
  // detector_id → number of cameras currently assigned. Computed
  // server-side. Missing key = 0 cameras (custom detectors default
  // to this until the caregiver opts them in per camera).
  cameraCount: Record<string, number>;
}) {
  const router = useRouter();
  const [detectors, setDetectors] = useState(initial);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Realtime: pick up INSERTs (the user just created a custom detector
  // in another tab — or in this one, optimistically) and UPDATEs
  // (background compile just finished populating `identifier` and
  // `prompt_fragment`). Without this, the user would have to refresh
  // to see compile completion. See lib/supabase/client.ts for why we
  // await getAuthedBrowserSupabase — race with setAuth otherwise.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void (async () => {
      const supa = await getAuthedBrowserSupabase();
      if (cancelled) return;
      const channel = supa
        .channel(`detectors-${patientId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'detectors',
            filter: `patient_id=eq.${patientId}`,
          },
          (payload: RealtimePostgresInsertPayload<Detector>) => {
            const next = payload.new;
            setDetectors((prev) => {
              if (prev.some((d) => d.id === next.id)) return prev;
              return [...prev, next];
            });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'detectors',
            filter: `patient_id=eq.${patientId}`,
          },
          (payload: RealtimePostgresUpdatePayload<Detector>) => {
            const updated = payload.new;
            setDetectors((prev) =>
              prev.map((d) => (d.id === updated.id ? updated : d)),
            );
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'detectors',
            // No filter on DELETE: Postgres only carries the
            // REPLICA IDENTITY columns in the old_record payload,
            // and filters reference column values from the new row
            // (which is empty here). We catch every detector
            // DELETE in the project, then drop it client-side if
            // we don't have it in state.
          },
          (payload: RealtimePostgresDeletePayload<Detector>) => {
            const oldId = (payload.old as { id?: string } | undefined)?.id;
            if (!oldId) return;
            setDetectors((prev) => prev.filter((d) => d.id !== oldId));
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

  async function patch(id: string, body: Parameters<ReturnType<typeof getBrowserNemara>['updateDetector']>[1]) {
    setPending((prev) => new Set(prev).add(id));
    setError(null);
    try {
      const updated = await getBrowserNemara().updateDetector(id, body);
      setDetectors((prev) => prev.map((d) => (d.id === id ? updated : d)));
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete detector "${name}"?`)) return;
    setPending((prev) => new Set(prev).add(id));
    setError(null);
    try {
      await getBrowserNemara().deleteDetector(id);
      // Drop optimistically — Realtime DELETE will fire too, but
      // the filter above is a no-op for an already-absent row.
      setDetectors((prev) => prev.filter((d) => d.id !== id));
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (detectors.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-card px-4 py-8 text-center text-base text-ink3">
        No detectors. Built-ins should auto-seed when you add a patient.
      </div>
    );
  }

  const presets = detectors.filter((d) => d.source === 'preset');
  const customs = detectors.filter((d) => d.source === 'custom');

  return (
    <>
      {error && (
        <div className="mb-3 rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep">
          {error}
        </div>
      )}
      <Section
        title="BUILT-IN"
        detectors={presets}
        pending={pending}
        patch={patch}
        remove={remove}
        totalCameras={totalCameras}
        cameraCount={cameraCount}
      />
      <Section
        title="CUSTOM"
        detectors={customs}
        pending={pending}
        patch={patch}
        remove={remove}
        totalCameras={totalCameras}
        cameraCount={cameraCount}
        emptyHint={
          <>
            None yet.{' '}
            <Link href={`/patients/${patientId}/detectors/new`} className="text-terra underline">
              Create one →
            </Link>
          </>
        }
      />
    </>
  );
}

function Section({
  title,
  detectors,
  pending,
  patch,
  remove,
  emptyHint,
  totalCameras,
  cameraCount,
}: {
  title: string;
  detectors: Detector[];
  pending: Set<string>;
  patch: (id: string, body: { is_on?: boolean; sensitivity?: DetectorSensitivity }) => void;
  remove: (id: string, name: string) => void;
  emptyHint?: React.ReactNode;
  totalCameras: number;
  cameraCount: Record<string, number>;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
        {title}
      </h2>
      {detectors.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-card px-4 py-3 text-base text-ink3">
          {emptyHint ?? 'None.'}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-card overflow-hidden">
          {detectors.map((d) => {
            const busy = pending.has(d.id);
            return (
              <li key={d.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif text-xl text-ink">
                        {d.name}
                      </span>
                      <span
                        className={cn(
                          'rounded-sm border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider',
                          d.category === 'safety'
                            ? 'border-terra/40 bg-terra-soft text-terra-deep'
                            : 'border-sky/40 bg-sky-soft text-sky',
                        )}
                      >
                        {d.category}
                      </span>
                      {d.source === 'custom' && (
                        <span className="rounded-sm border border-action/30 bg-action-soft px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-ink2">
                          custom
                        </span>
                      )}
                      {d.source === 'custom' && d.identifier === null && (
                        // Background compile still in progress — the
                        // tick pipeline silently skips this detector
                        // until the UPDATE arrives via Realtime and
                        // identifier becomes non-null.
                        <span
                          className="inline-flex items-center gap-1 rounded-sm border border-warning/40 bg-card-alt px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-warning"
                          title="Generating the LLM prompt for this detector. Usually takes 3–5 seconds. Until compile finishes, this detector won't run on any camera ticks."
                        >
                          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                          compiling…
                        </span>
                      )}
                      <span
                        className={cn(
                          'rounded-sm border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider',
                          (cameraCount[d.id] ?? 0) === 0
                            ? 'border-line bg-paper-dim text-ink4'
                            : 'border-line bg-paper-dim text-ink2',
                        )}
                        title="Cameras this detector is currently assigned to"
                      >
                        {cameraCount[d.id] ?? 0} / {totalCameras} cameras
                      </span>
                    </div>
                    <p className="mt-1 text-base text-ink2">
                      {d.description}
                    </p>
                    <p className="mt-1 font-mono text-xs uppercase tracking-wider text-ink4">
                      {d.shape} · {d.where_scope} · {d.when_scope}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.source === 'custom' && (
                      <Link
                        href={`/patients/${d.patient_id}/detectors/${d.id}`}
                        className="text-base text-ink3 hover:text-ink underline-offset-2 hover:underline"
                      >
                        Edit
                      </Link>
                    )}
                    <button
                      onClick={() => patch(d.id, { is_on: !d.is_on })}
                      disabled={busy}
                      aria-pressed={d.is_on}
                      className={cn(
                        'rounded-md border px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50',
                        d.is_on
                          ? 'border-action/30 bg-action text-action-ink'
                          : 'border-line bg-paper-dim text-ink3',
                      )}
                    >
                      {d.is_on ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() => remove(d.id, d.name)}
                      disabled={busy}
                      title="Delete detector"
                      className="rounded-md border border-terra/40 bg-terra-soft/60 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-terra-deep hover:bg-terra-soft disabled:opacity-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {d.is_on && (
                  <div className="flex items-center gap-2 pl-1">
                    <span className="font-mono text-xs uppercase tracking-wider text-ink3">
                      sensitivity
                    </span>
                    {SENSITIVITY.map((s) => (
                      <button
                        key={s}
                        onClick={() => patch(d.id, { sensitivity: s })}
                        disabled={busy || d.sensitivity === s}
                        className={cn(
                          'rounded-sm px-2 py-0.5 font-mono text-xs uppercase tracking-wider transition-colors',
                          d.sensitivity === s
                            ? 'bg-ink text-paper'
                            : 'border border-line bg-card text-ink3 hover:text-ink',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
