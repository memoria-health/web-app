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
import type { Detector } from '@/lib/api/types';
import { DetectorIcon } from '@/lib/icons/detectorIcons';
import { roomsLabel } from '@/lib/detectors/labels';
import { AccuracyCaveatNotice } from './AccuracyCaveatNotice';
import {
  BetaChip,
  CustomDetectorBetaNotice,
} from './CustomDetectorBetaNotice';
import { categoryTone } from '@/lib/categoryPalette';


export function DetectorList({
  initial,
  patientId,
  cameraCount,
}: {
  initial: Detector[];
  patientId: string;
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
            // Raw DB row: derive where_scope (dropped column) so it matches
            // the API shape the rest of the UI reads.
            const next: Detector = {
              ...payload.new,
            };
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
            const updated: Detector = {
              ...payload.new,
            };
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
        cameraCount={cameraCount}
      />
      <Section
        title="CUSTOM"
        showsBeta
        detectors={customs}
        pending={pending}
        patch={patch}
        remove={remove}
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
  cameraCount,
  showsBeta = false,
}: {
  title: string;
  detectors: Detector[];
  pending: Set<string>;
  patch: (id: string, body: { is_on?: boolean }) => void;
  remove: (id: string, name: string) => void;
  emptyHint?: React.ReactNode;
  cameraCount: Record<string, number>;
  showsBeta?: boolean;
}) {
  // Which row's ⋯ overflow menu is open (Edit + Delete live in here now).
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  return (
    <section className="mt-6 first:mt-0">
      {/* The BETA marker lives on the section header, not on each row.
          Per-row it repeated the same thing on every custom detector. */}
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
          {title}
        </h2>
        {showsBeta && <BetaChip />}
      </div>
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
                  {/* Icon tint carries the category (safety vs routine), so
                      the separate category pill is gone. */}
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border',
                      categoryTone(d.category).soft,
                      categoryTone(d.category).deep,
                    )}
                    title={categoryTone(d.category).label}
                  >
                    <DetectorIcon name={d.icon_name} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-serif text-xl text-ink">
                        {d.name}
                      </span>
                      {d.source === 'custom' && d.identifier === null && (
                        // Background compile still in progress — the tick
                        // pipeline skips this detector until identifier lands.
                        // Kept as a bare dot so the row stays minimal.
                        <span
                          className="inline-flex shrink-0 items-center rounded-sm border border-warning/40 bg-card-alt px-1 py-0.5"
                          title="Generating this detector's instructions. Until it finishes, it won't run on any camera."
                        >
                          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-base text-ink2">{d.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-sm border border-line bg-paper-dim px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-ink3">
                        {roomsLabel(d.where_rooms)} ·{' '}
                        {d.when_scope === 'ALWAYS' ? 'Always' : d.when_scope}
                      </span>
                      {(cameraCount[d.id] ?? 0) === 0 && (
                        <span
                          className="font-mono text-xs uppercase tracking-wider text-ink4"
                          title="Not assigned to any camera yet"
                        >
                          no cameras
                        </span>
                      )}
                    </div>
                    {d.accuracy_caveat && (
                      <div className="mt-1.5">
                        <AccuracyCaveatNotice compact />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Edit reaches every detector now, presets included, so
                        their where/when can be changed from the editor. */}
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
                    {/* ⋯ overflow: Edit + Delete (both here now, per design). */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setMenuOpen(menuOpen === d.id ? null : d.id)
                        }
                        disabled={busy}
                        aria-label="More actions"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen === d.id}
                        className="rounded-md border border-line bg-paper-dim px-2.5 py-1.5 text-ink3 hover:text-ink disabled:opacity-50 transition-colors"
                      >
                        <span className="text-base leading-none">⋯</span>
                      </button>
                      {menuOpen === d.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpen(null)}
                          />
                          <div
                            role="menu"
                            className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-md border border-line bg-card shadow-lg"
                          >
                            <Link
                              href={`/patients/${d.patient_id}/detectors/${d.id}`}
                              onClick={() => setMenuOpen(null)}
                              className="block px-3 py-2 text-sm text-ink hover:bg-paper-dim"
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(null);
                                remove(d.id, d.name);
                              }}
                              className="block w-full px-3 py-2 text-left text-sm text-terra-deep hover:bg-terra-soft"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
