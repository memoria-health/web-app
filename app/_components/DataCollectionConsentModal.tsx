'use client';

import { useState } from 'react';
import { Video } from 'lucide-react';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

/// First-open data-collection consent modal. Rendered by the patient
/// detail page when `patient.data_collection_decided_at == null` (the
/// caregiver has never been asked). Mirrors OnboardingModal's plain
/// `role="dialog"` overlay — no dialog dependency.
///
/// Both choices RECORD a decision: "Share recordings" PATCHes
/// {data_collection_enabled: true}, "Not now" PATCHes false. The
/// backend stamps `data_collection_decided_at` server-side whenever
/// the field is present, so either choice stops the banner from
/// re-nagging; the Settings toggle is how the caregiver changes it
/// later. We pass the resulting `enabled` value up via `onDecide` so
/// the parent can optimistically hide the modal for the session.
export function DataCollectionConsentModal({
  patientId,
  patientName,
  onDecide,
}: {
  patientId: string;
  patientName: string;
  onDecide: (enabled: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      await getBrowserNemara().updatePatient(patientId, {
        data_collection_enabled: enabled,
      });
      onDecide(enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help improve care for everyone"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 animate-[fadeIn_150ms_ease-out]"
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-card shadow-2xl">
        {/* Copy. Bare icon inline with the title, mirroring the alerts
            banner's [icon][text] row (no badge). */}
        <div className="flex flex-col gap-3 px-6 py-6">
          <div className="flex items-center gap-2.5">
            <Video className="h-6 w-6 shrink-0 text-ink2" aria-hidden="true" />
            <h2 className="font-serif text-2xl tracking-tight text-ink">
              Help improve care for everyone.
            </h2>
          </div>
          <p className="text-base leading-relaxed text-ink2">
            With your permission, Memoria will{" "}
            <strong className="font-semibold text-ink">
              securely store video and audio clips of {patientName}
            </strong>{" "}
            to help improve our understanding of elderly health and disease.
          </p>
          <p className="text-base leading-relaxed text-ink2">
            This is optional, never required, and you can turn it off anytime in
            Settings.
          </p>
        </div>

        {error && (
          <div className="mx-6 mb-2 rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep">
            {error}
          </div>
        )}

        {/* Controls. "Not now" is the secondary; "Share recordings" the
            primary action — both disabled during the in-flight PATCH. */}
        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className={cn(
              'rounded-md border border-line bg-transparent px-4 py-2 text-sm text-ink2 hover:bg-paper-dim hover:text-ink transition-colors disabled:opacity-50',
            )}
          >
            Not now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className={cn(
              'rounded-md bg-action px-5 py-2 text-sm font-semibold text-action-ink hover:bg-ink2 transition-colors disabled:opacity-50',
            )}
          >
            Share recordings
          </button>
        </div>
      </div>
    </div>
  );
}
