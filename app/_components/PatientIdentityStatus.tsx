'use client';

import { useEffect, useState } from 'react';
import { getBrowserNemara } from '@/lib/api/client';
import type { FaceEnrollmentSummary } from '@/lib/api/types';

/**
 * Patient identity (Re-ID) status card.
 *
 * Read-only surface that mirrors the iOS PatientSettings card.
 * Three states, all rendered with byte-identical copy on both
 * surfaces so a caregiver flipping between web and mobile sees the
 * same numbers and language.
 *
 * Re-enrollment is mobile-only (the iOS app owns the live camera
 * capture flow). The web's only CTA is a hint to open the caregiver
 * app to re-enroll.
 */
export function PatientIdentityStatus({ patientId }: { patientId: string }) {
  const [summary, setSummary] = useState<FaceEnrollmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await getBrowserNemara().getFaceEnrollmentSummary(patientId);
        if (!cancelled) setSummary(s);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return (
      <div className="rounded-md border border-line bg-card px-4 py-3">
        <p className="font-mono text-xs uppercase tracking-wider text-ink3">
          PATIENT IDENTITY
        </p>
        <p className="text-base text-ink3">Loading…</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-md border border-line bg-card px-4 py-3">
        <p className="font-mono text-xs uppercase tracking-wider text-ink3">
          PATIENT IDENTITY
        </p>
        <p className="text-base text-ink3">
          Couldn&apos;t load enrollment status.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-line bg-card px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-wider text-ink3">
        PATIENT IDENTITY
      </p>
      <p className="text-base text-ink">{titleFor(summary)}</p>
      <p className="text-sm text-ink3">{subtitleFor(summary)}</p>
    </div>
  );
}

// The two copy helpers must stay byte-identical with the iOS
// PatientSettingsView.identityCardTitle / .identityCardSubtitle.
// If you change one, change the other.

function titleFor(s: FaceEnrollmentSummary): string {
  if (s.processing_count > 0) {
    return `Processing ${s.processing_count} photos…`;
  }
  if (s.selfie_count > 0) {
    return `Enrolled · ${s.selfie_count} selfies · ${s.harvested_count} harvested`;
  }
  return 'Not enrolled';
}

function subtitleFor(s: FaceEnrollmentSummary): string {
  if (s.processing_count > 0) {
    return "We're processing the captured photos. This usually takes under a minute.";
  }
  if (s.selfie_count > 0 && s.last_update) {
    const d = new Date(s.last_update);
    return `Last update ${d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }
  if (s.selfie_count === 0) {
    return 'Tap Enroll to set up identity so Nemara can tell your patient apart from others in the household.';
  }
  return '';
}
