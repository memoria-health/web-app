'use client';

import { useRef, useState } from 'react';
import { getBrowserNemara } from '@/lib/api/client';
import type { Detector } from '@/lib/api/types';
import { AccuracyCaveatNotice } from './AccuracyCaveatNotice';

// Caregiver-facing transparency panel for a custom detector, mirroring the
// iOS DetectorDetailSheet: what Memoria looks for (the compiled criteria),
// the plain-words changes you've asked for, and an "ask for a change" box
// that refines behavior without touching the raw prompt. Presets have no
// compiled criteria, so this renders nothing for them.
export function DetectorInsight({ detector: initial }: { detector: Detector }) {
  const [detector, setDetector] = useState<Detector>(initial);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Presets don't compile custom criteria — nothing to show.
  if (detector.source !== 'custom') return null;

  const criteria = detector.user_criteria ?? [];
  const refinements = detector.refinements ?? [];

  async function pollUntilRecompiled(before: string, tries = 0) {
    // The backend recompiles asynchronously, so re-list until user_criteria
    // moves off its pre-refine value. ~9s ceiling; stop quietly if it hasn't
    // landed (it'll be correct on the next page load).
    if (tries >= 6) return;
    await new Promise<void>((r) => {
      pollTimer.current = setTimeout(r, 1500);
    });
    try {
      const list = await getBrowserNemara().listDetectors(detector.patient_id);
      const fresh = list.find((d) => d.id === detector.id);
      if (fresh) {
        setDetector(fresh);
        if (JSON.stringify(fresh.user_criteria ?? []) !== before) return;
      }
    } catch {
      // transient list failure — keep polling
    }
    await pollUntilRecompiled(before, tries + 1);
  }

  async function submitRefine() {
    const text = feedback.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    const before = JSON.stringify(detector.user_criteria ?? []);
    try {
      // POST returns immediately with the refinement appended; the recompile
      // (new criteria) runs async, so poll the list until it lands.
      const updated = await getBrowserNemara().refineDetector(detector.id, {
        feedback: text,
      });
      setDetector(updated);
      setFeedback('');
      await pollUntilRecompiled(before);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {detector.accuracy_caveat && <AccuracyCaveatNotice />}

      <section className="rounded border border-line bg-card p-6">
        <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
          What Memoria looks for
        </h2>
        {criteria.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {criteria.map((line, i) => (
              <CriteriaLine key={i} line={line} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink4">
            {busy ? 'Updating…' : 'Still compiling — check back in a moment.'}
          </p>
        )}

        {refinements.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
              Changes you&apos;ve asked for
            </h3>
            <ul className="flex flex-col gap-1.5">
              {refinements.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink2">
                  <span className="text-ink4">→</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
            Ask for a change
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="e.g. don't count eating as choking"
            className="w-full resize-none rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink outline-none focus:border-action/50"
          />
          {error && <p className="mt-2 text-xs text-terra-deep">{error}</p>}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={busy || !feedback.trim()}
              onClick={submitRefine}
              className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-ink transition-colors hover:bg-ink2 disabled:opacity-50"
            >
              {busy ? 'Applying…' : 'Apply change'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// One compiled-criteria line, formatted "Counts: …" / "Doesn't count: …" /
// "Caution: …". Bold the label before the colon; plain lines pass through.
function CriteriaLine({ line }: { line: string }) {
  const idx = line.indexOf(':');
  if (idx === -1) return <li className="text-sm text-ink2">{line}</li>;
  const label = line.slice(0, idx);
  const rest = line.slice(idx + 1).trim();
  return (
    <li className="text-sm text-ink2">
      <span className="font-semibold text-ink">{label}:</span> {rest}
    </li>
  );
}
