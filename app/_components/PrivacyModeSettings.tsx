'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

/// Per-patient Privacy mode toggle. While on, the backend stores no
/// clips, severs the live video+audio feed at the SFU, and strips event
/// clips from insights — the text insights keep flowing. Privacy
/// SUSPENDS data collection without changing the stored consent decision
/// (so DataCollectionSettings shows itself as suspended, not flipped).
///
/// After a successful flip we call `router.refresh()` so the patient
/// layout re-mints the LiveKit token (with the new subscribe grants) and
/// the live grid re-renders — restoring video when privacy clears, and
/// showing the placard when it turns on.
export function PrivacyModeSettings({
  patientId,
  initialEnabled,
}: {
  patientId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = getBrowserNemara();
  const router = useRouter();

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setBusy(true);
    setError(null);
    try {
      await api.updatePatient(patientId, { privacy_mode_enabled: next });
      // Re-run the layout (re-mint token with new grants) + page (placard).
      router.refresh();
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
        <div className="flex flex-col gap-1">
          <span className="text-base text-ink">Privacy mode</span>
          <span className="text-sm text-ink3">
            {enabled
              ? 'Live video and audio are hidden and nothing is recorded. You still receive insights.'
              : 'Hide live video and audio and stop all recording. You still receive insights. This preserves dignity at all times.'}
          </span>
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
    </div>
  );
}
