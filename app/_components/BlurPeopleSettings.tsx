'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

/// Per-patient "Blur people" toggle. Client-side and DEVICE-LOCAL (stored in
/// localStorage per patient) — it only changes how THIS browser renders the
/// live grid: a MoveNet pose mask blurs people on-canvas while the room stays
/// visible. It touches no backend state and doesn't affect recording or what
/// anyone else sees. Distinct from per-camera room-derived privacy
/// (`Camera.privacy_enabled`), which withholds the feed for everyone at the
/// SFU. VideoGrid reads the same key on mount.
const keyFor = (patientId: string) => `skeleton-mode:${patientId}`;

export function BlurPeopleSettings({ patientId }: { patientId: string }) {
  // localStorage isn't available during SSR, so start off and hydrate in an
  // effect (matches how VideoGrid reads the same key).
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(keyFor(patientId)) === '1');
    } catch {
      /* localStorage unavailable — leave off */
    }
  }, [patientId]);

  function toggle() {
    setEnabled((v) => {
      const next = !v;
      try {
        localStorage.setItem(keyFor(patientId), next ? '1' : '0');
      } catch {
        /* noop */
      }
      return next;
    });
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-base text-ink">Blur people</span>
        <span className="text-sm text-ink3">
          {enabled
            ? 'People in the live feed are blurred on this device. The room stays visible.'
            : 'Blur anyone who appears in the live feed while keeping the room visible. Applies to this browser only.'}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        // Drop focus after click so a stray Spacebar/Enter doesn't re-toggle.
        onClick={(e) => { e.currentTarget.blur(); toggle(); }}
        className={cn(
          'flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
          enabled ? 'justify-end bg-action' : 'justify-start bg-line',
        )}
      >
        <span className="h-6 w-6 rounded-full bg-card shadow-sm" />
      </button>
    </div>
  );
}
