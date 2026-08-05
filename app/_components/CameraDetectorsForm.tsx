'use client';

import { useState } from 'react';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import type { Detector } from '@/lib/api/types';
import { categoryTone } from '@/lib/categoryPalette';

/**
 * Per-camera detector assignment toggles.
 *
 * Shows every patient-level detector (master switch in /detectors)
 * with a toggle for whether it's assigned to THIS camera. Toggling
 * optimistically updates local state, then PUTs the full new set;
 * rolls back if the request fails.
 *
 * `detectors.is_on=false` rows are still shown but disabled (greyed
 * out + chip "OFF globally") since toggling them per-camera while
 * the master switch is off has no effect.
 */
export function CameraDetectorsForm({
  cameraId,
  patientDetectors,
  initialAssignedIds,
  patientId,
}: {
  cameraId: string;
  patientDetectors: Detector[];
  initialAssignedIds: string[];
  patientId: string;
}) {
  const [assigned, setAssigned] = useState<Set<string>>(
    new Set(initialAssignedIds),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(detectorId: string, nextOn: boolean) {
    const prevAssigned = new Set(assigned);
    const optimistic = new Set(assigned);
    if (nextOn) optimistic.add(detectorId);
    else optimistic.delete(detectorId);

    setAssigned(optimistic);
    setBusy(detectorId);
    setError(null);
    try {
      const res = await getBrowserNemara().setCameraDetectors(cameraId, {
        detector_ids: Array.from(optimistic),
      });
      // Server is source of truth — adopt its set even if it matches.
      setAssigned(new Set(res.detector_ids));
    } catch (err) {
      setAssigned(prevAssigned);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (patientDetectors.length === 0) {
    return (
      <div className="rounded border border-dashed border-line px-4 py-8 text-center text-base text-ink3">
        No detectors configured. Add one from the{' '}
        <a href={`/patients/${patientId}/detectors`} className="text-terra underline">Detectors</a>{' '}
        page first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-terra">
          {error}
        </div>
      )}
      <ul className="divide-y divide-line rounded border border-line bg-card">
        {patientDetectors.map((d) => {
          const isAssigned = assigned.has(d.id);
          const masterOff = !d.is_on;
          const isBusy = busy === d.id;
          return (
            <li
              key={d.id}
              className={cn(
                'flex items-start gap-3 px-3 py-3',
                masterOff && 'opacity-60',
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-ink">
                    {d.name}
                  </span>
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-xs font-mono uppercase tracking-wide',
                      categoryTone(d.category).soft,
                      categoryTone(d.category).deep,
                    )}
                  >
                    {d.category}
                  </span>
                  {masterOff && (
                    <span className="rounded border border-line bg-paper-dim px-1.5 py-0.5 text-xs font-mono uppercase tracking-wide text-ink3">
                      off globally
                    </span>
                  )}
                </div>
                <p className="text-base text-ink3">{d.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isAssigned}
                aria-label={`${isAssigned ? 'Disable' : 'Enable'} ${d.name} on this camera`}
                onClick={() => toggle(d.id, !isAssigned)}
                disabled={isBusy || masterOff}
                className={cn(
                  'mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50',
                  isAssigned && !masterOff
                    ? 'border-action bg-action'
                    : 'border-line bg-paper-dim',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-paper shadow transition-transform',
                    isAssigned ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink3">
        Toggling here only affects <strong>this</strong> camera. Other
        cameras under the same patient are independent. The global master
        switch lives on the{' '}
        <a href={`/patients/${patientId}/detectors`} className="text-terra underline">
          Detectors
        </a>{' '}
        page.
      </p>
    </div>
  );
}
