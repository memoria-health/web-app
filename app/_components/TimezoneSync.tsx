'use client';

import { useEffect } from 'react';
import { getBrowserNemara } from '@/lib/api/client';

/// Silently keeps the caregiver's stored timezone in sync with their
/// browser. Scheduled ("absence") detectors evaluate their windows in
/// this zone, so "medication by 5pm" means 5pm where the caregiver is.
/// Renders nothing; on mount it compares the browser's resolved IANA
/// timezone to the stored value and PATCHes /v1/me only if they differ
/// (no-op on every subsequent load).
export function TimezoneSync({ current }: { current: string }) {
  useEffect(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTz || browserTz === current) return;
    void getBrowserNemara()
      .updateTimezone(browserTz)
      .catch(() => {
        /* best-effort — scheduler falls back to the stored/default tz */
      });
  }, [current]);
  return null;
}
