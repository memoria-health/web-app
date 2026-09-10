'use client';

import { useState } from 'react';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { EvaluationModeInfoModal } from './EvaluationModeInfoModal';

/// "Evaluation mode" — the caregiver-facing face of the event gate.
///
/// When on, this patient's alerts are held for a few seconds and a
/// Memoria specialist sees a masked clip and can drop false alarms.
/// Backed by `patients.event_gate_enabled` through the ordinary patient
/// PATCH, same optimistic-flip-rollback-on-error shape as
/// DataCollectionSettings.
///
/// ON by default, which is why the ⓘ opens a real explainer rather than
/// a tooltip: for most households that modal is the first and only place
/// they learn a person sees masked footage of their home.
export function EvaluationModeSettings({
  patientId,
  initialEnabled,
}: {
  patientId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const api = getBrowserNemara();

  // Reset busy in finally — never in catch — so a thrown error can't
  // leave the control permanently disabled.
  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setBusy(true);
    setError(null);
    try {
      await api.updatePatient(patientId, { event_gate_enabled: next });
    } catch (e) {
      setEnabled(!next); // revert
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-base text-ink">Evaluation mode</span>
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            aria-label="About evaluation mode"
            className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-xs text-ink3 transition-colors hover:text-ink"
          >
            i
          </button>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={toggleEnabled}
          className={cn(
            'flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50',
            enabled ? 'justify-end bg-action' : 'justify-start bg-line',
          )}
        >
          <span className="h-6 w-6 rounded-full bg-card shadow-sm" />
        </button>
      </div>

      {showInfo && (
        <EvaluationModeInfoModal onClose={() => setShowInfo(false)} />
      )}
    </div>
  );
}
