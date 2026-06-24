'use client';

import { useState } from 'react';
import { Video } from 'lucide-react';
import { getBrowserNemara } from '@/lib/api/client';

/// First-open data-collection consent banner. Rendered by the patient
/// detail page when `patient.data_collection_decided_at == null` (the
/// caregiver has never been asked). Styled as a bottom banner to match
/// `AlertsFirstRunPrompt` — same shell, bare inline icon, and buttons —
/// rather than a blocking centered modal.
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
      role="region"
      aria-label="Data collection consent"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 animate-[fadeIn_150ms_ease-out]"
    >
      <div className="flex w-full max-w-2xl items-start gap-3 rounded-lg border border-line bg-card px-4 py-3 shadow-lg">
        <Video className="mt-0.5 h-5 w-5 shrink-0 text-ink2" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm text-ink2">
          <p className="font-medium text-ink">Help improve care for everyone.</p>
          <p className="mt-1">
            With your permission, Memoria will{' '}
            <strong className="font-semibold text-ink">
              securely store video and audio clips of {patientName}
            </strong>{' '}
            to help improve our understanding of elderly health and disease.
          </p>
          <p className="mt-1">
            This is optional, never required, and you can turn it off anytime in
            Settings.
          </p>
          {error && <p className="mt-1 text-terra-deep">{error}</p>}
        </div>
        {/* "Not now" is the secondary; "Share recordings" the primary —
            both disabled during the in-flight PATCH. Same button styling
            as the alerts banner. */}
        <div className="flex shrink-0 items-center gap-2 self-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="rounded-md border border-line bg-transparent px-3 py-1.5 text-sm text-ink2 transition-colors hover:bg-paper-dim hover:text-ink disabled:opacity-50"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="rounded-md bg-action px-3 py-1.5 text-sm font-semibold text-action-ink transition-colors hover:bg-ink2 disabled:opacity-50"
          >
            Share recordings
          </button>
        </div>
      </div>
    </div>
  );
}
