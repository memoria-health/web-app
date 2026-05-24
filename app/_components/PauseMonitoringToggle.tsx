'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

/**
 * Patient-wide "monitoring on/off" toggle. Calls
 * PATCH /v1/patients/{id} { cameras_paused: bool }.
 *
 * When paused:
 *  - Backend detector worker skips the LLM call for every camera
 *    (writes synthetic "monitoring paused" rows to analyses)
 *  - Web hides ALL cameras from the live grid + analyses feed
 *  - LiveKit connections stay alive — re-enabling is instant
 *
 * `hiddenCount` shows how many cameras are individually disabled even
 * when monitoring is on (useful context for the user).
 */
export function PauseMonitoringToggle({
  patientId,
  initialPaused,
  hiddenCount,
  totalCount,
}: {
  patientId: string;
  initialPaused: boolean;
  hiddenCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggle() {
    const next = !paused;
    setBusy(true);
    setError(null);
    // Optimistic flip.
    setPaused(next);
    try {
      await getBrowserNemara().updatePatient(patientId, {
        cameras_paused: next,
      });
      startTransition(() => router.refresh());
    } catch (err) {
      // Roll back.
      setPaused(!next);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Monitoring
      </span>
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={!paused}
        title={
          paused
            ? 'All cameras are off (LLM is skipped, cameras hidden). Click to resume.'
            : 'All cameras are being monitored. Click to pause everything.'
        }
        className={cn(
          'rounded border px-3 py-1 text-xs font-semibold uppercase tracking-wide disabled:opacity-50',
          paused
            ? 'border-zinc-700 bg-zinc-900 text-zinc-400'
            : 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
        )}
      >
        {busy ? '…' : paused ? 'PAUSED' : 'ON'}
      </button>
      <span className="text-[11px] text-zinc-500">
        {paused
          ? `all ${totalCount} cameras hidden`
          : hiddenCount > 0
            ? `${totalCount - hiddenCount} of ${totalCount} cameras visible · ${hiddenCount} individually disabled`
            : `${totalCount} of ${totalCount} cameras visible`}
      </span>
      {error && (
        <span className="text-[11px] text-red-400">err: {error}</span>
      )}
    </section>
  );
}
