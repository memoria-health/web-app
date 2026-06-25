'use client';

import { useState } from 'react';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

/// Per-patient data-collection toggle. Lives in the patient Settings
/// tab. Mirrors EmailAlertsSettings' master switch: optimistic flip,
/// rollback on error, control disabled during the in-flight PATCH.
/// Each toggle PATCHes the patient row with `data_collection_enabled`;
/// the backend stamps `data_collection_decided_at` server-side, so once
/// the caregiver has touched this the first-open consent modal never
/// re-appears (the modal and this toggle drive the same flag).
export function DataCollectionSettings({
  patientId,
  initialEnabled,
  suspendedByPrivacy = false,
}: {
  patientId: string;
  initialEnabled: boolean;
  // Privacy mode SUSPENDS data collection without changing the stored
  // choice. While on, this control is locked and reads as suspended; the
  // underlying value is preserved and resumes when privacy clears.
  suspendedByPrivacy?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = getBrowserNemara();

  // Reset busy in finally — never in catch — so a thrown error can't
  // leave the control permanently disabled.
  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setBusy(true);
    setError(null);
    try {
      await api.updatePatient(patientId, { data_collection_enabled: next });
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

      {/* Master toggle. The knob is a flex-positioned child of the
          track (justify-end when on) — no absolute/translate math, so
          it can't drift off the edge. */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-base text-ink">
            Contribute recordings to research
          </span>
          {suspendedByPrivacy && (
            <span className="text-sm text-ink3">
              Suspended while Privacy mode is on. Your choice is saved and
              resumes the moment Privacy mode is turned off.
            </span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy || suspendedByPrivacy}
          onClick={toggleEnabled}
          className={cn(
            'flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50',
            enabled ? 'justify-end bg-action' : 'justify-start bg-line',
          )}
        >
          <span className="h-6 w-6 rounded-full bg-card shadow-sm" />
        </button>
      </div>
    </div>
  );
}
