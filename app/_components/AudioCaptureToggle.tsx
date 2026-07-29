'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

/**
 * Patient-wide audio capture toggle — the facilities audio kill. Calls
 * PATCH /v1/patients/{id} { audio_capture_enabled: bool }. When off, the
 * camera publishers never publish an audio track (severed at the source
 * — live audio, clips, and transcripts are all silent), and detectors
 * that listen (calling for help) fall back to visual-only. The flip
 * reaches gateway cameras within seconds via the roster long-poll.
 *
 * Care facilities where audio recording is not permitted must keep this
 * OFF for every resident.
 */
export function AudioCaptureToggle({
  patientId,
  initialEnabled,
}: {
  patientId: string;
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    setError(null);
    setEnabled(next); // optimistic
    try {
      await getBrowserNemara().updatePatient(patientId, {
        audio_capture_enabled: next,
      });
      startTransition(() => router.refresh());
    } catch (err) {
      setEnabled(!next); // roll back
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-card px-4 py-3">
      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
        Audio
      </span>
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={enabled}
        title={
          enabled
            ? 'Cameras capture audio (live sound, clips, speech alerts). Click to disable audio entirely.'
            : 'Audio is fully disabled — no sound is captured, recorded, or analyzed. Click to enable.'
        }
        className={cn(
          'rounded-md border px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50',
          enabled
            ? 'border-action/30 bg-action text-action-ink'
            : 'border-line bg-paper-dim text-ink3',
        )}
      >
        {busy ? '…' : enabled ? 'ON' : 'OFF'}
      </button>
      <span className="text-base text-ink3">
        {enabled
          ? 'sound is captured and analyzed'
          : 'no sound is captured, recorded, or analyzed'}
      </span>
      {error && <span className="text-xs text-terra">err: {error}</span>}
    </section>
  );
}
