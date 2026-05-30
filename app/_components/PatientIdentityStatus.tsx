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
 * same language.
 *
 * Re-enrollment is mobile-only (the iOS app owns the live camera
 * capture flow). The web's only CTA is a hint to open the caregiver
 * app.
 */
export function PatientIdentityStatus({
  patientId,
  patientName,
  surface,
}: {
  patientId: string;
  patientName: string;
  // `detail` only renders when enrollment is incomplete, so the patient
  // page surfaces a nudge to enroll. `settings` always renders so the
  // settings page can show the enrollment status (complete / in progress
  // / incomplete) as part of the patient's profile.
  surface: 'detail' | 'settings';
}) {
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

  if (loading || error || !summary) {
    // On the patient detail page we only ever want to show the
    // incomplete-enrollment nudge. Skipping the loading shimmer
    // avoids flashing a placeholder card on the page for every
    // already-enrolled patient.
    if (surface === 'detail') return null;
    return (
      <Card>
        <Indicator state="loading" />
        <Text title="Patient identity" subtitle={error ? "Couldn't load enrollment status." : 'Loading…'} />
      </Card>
    );
  }

  const state = stateOf(summary);
  if (surface === 'detail' && state !== 'not_enrolled') return null;
  return (
    <Card>
      <Indicator state={state} />
      <Text title={titleFor(state, patientName)} subtitle={subtitleFor(state)} />
    </Card>
  );
}

// ── states ──────────────────────────────────────────────────────────

type CardState = 'enrolled' | 'processing' | 'not_enrolled' | 'loading';

function stateOf(s: FaceEnrollmentSummary): CardState {
  if (s.processing_count > 0) return 'processing';
  if (s.selfie_count > 0) return 'enrolled';
  return 'not_enrolled';
}

// Copy stays byte-identical with iOS PatientSettingsView.identityCardTitle
// / .identityCardSubtitle. If you change one, change the other.

function titleFor(state: CardState, name: string): string {
  switch (state) {
    case 'enrolled':
      return `${name}'s face enrollment is complete`;
    case 'processing':
      return `${name}'s face enrollment is in progress`;
    case 'not_enrolled':
      return `${name}'s face enrollment is incomplete`;
    case 'loading':
      return 'Patient identity';
  }
}

function subtitleFor(state: CardState): string {
  switch (state) {
    case 'not_enrolled':
      return 'Open the caregiver app to enroll.';
    default:
      return '';
  }
}

// ── presentation ────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-card px-4 py-3">
      {children}
    </div>
  );
}

function Text({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col">
      <p className="text-base text-ink">{title}</p>
      {subtitle && <p className="text-sm text-ink3">{subtitle}</p>}
    </div>
  );
}

function Indicator({ state }: { state: CardState }) {
  // Inline SVGs so the card has zero icon-lib dependencies and renders
  // identically wherever the component is embedded.
  if (state === 'enrolled') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7 shrink-0 text-success"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path
          d="M7.5 12.5l3 3 6-6"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
  if (state === 'processing') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7 shrink-0 animate-spin text-terra"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.4" fill="none" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }
  // not_enrolled and loading both render the dashed empty circle.
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 shrink-0 text-ink3"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="3 3"
        fill="none"
      />
    </svg>
  );
}
