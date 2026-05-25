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
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-card px-4 py-3">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink3">
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
          'rounded-md border px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50',
          paused
            ? 'border-line bg-paper-dim text-ink3'
            : 'border-action/30 bg-action text-action-ink',
        )}
      >
        {busy ? '…' : paused ? 'PAUSED' : 'ON'}
      </button>
      <span className="text-sm text-ink3">
        {paused
          ? `all ${totalCount} cameras hidden`
          : hiddenCount > 0
            ? `${totalCount - hiddenCount} of ${totalCount} cameras visible · ${hiddenCount} individually disabled`
            : `${totalCount} of ${totalCount} cameras visible`}
      </span>
      {error && (
        <span className="text-xs text-terra">err: {error}</span>
      )}
    </section>
  );
}
