'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';

/// First-run walkthrough for the web dashboard. Rendered by the (app)
/// layout when the caregiver's `onboarded_web` flag is false. The user
/// can step through the cards or skip; either way we PATCH
/// `onboarded_web = true` so it never shows again for this account.
/// Per-surface: the iOS app tracks its own flag, so learning the web
/// flow doesn't suppress the iOS walkthrough.
///
/// Low-key by design: a centered modal with a handful of cards, each
/// an optional annotated screenshot + a short explanation. No
/// coachmark overlays (those are fragile against real DOM). Screenshot
/// assets live in /public/onboarding; a card with a missing image just
/// renders text, so the modal is robust if an asset is absent.

interface Step {
  title: string;
  body: string;
  /// Path under /public. Omit for a text-only card.
  image?: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Memoria',
    body:
      'Memoria turns a spare phone into an AI-monitored camera for the people you care for. This dashboard is where you watch live, review what the AI noticed, and get alerted when something needs attention.',
  },
  {
    title: 'Start with a patient',
    body:
      'Everything is organized around a patient. Create one from the home screen, then switch between patients anytime using the dropdown at the top of the page.',
    image: '/onboarding/01-patient.png',
  },
  {
    title: 'Pair a wall phone',
    body:
      'Open a patient → Cameras → Add camera. You’ll get a 6-digit code. Open the MemoriaSensor app on the phone you’re mounting and enter that code to pair it. Each phone watches one room.',
    image: '/onboarding/02-cameras.png',
  },
  {
    title: 'Watch live + tune detectors',
    body:
      'The Live tab shows each camera’s video and a running feed of what the AI sees every few seconds. The Detectors tab lets you turn falls, wandering, agitation, and medication checks on or off per camera.',
    image: '/onboarding/03-live.png',
  },
  {
    title: 'Get notified',
    body:
      'When a detector fires, it lands in the Events feed and triggers a push to the iOS app. You can also enable email alerts in Settings so you’re covered even when you’re at your desk.',
    image: '/onboarding/04-events.png',
  },
];

export function OnboardingModal() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  async function finish() {
    // Optimistically hide so the UI feels instant; the PATCH + refresh
    // run in the background. If the PATCH somehow fails the modal will
    // reappear on the next full load, which is acceptable.
    setClosing(true);
    try {
      await getBrowserNemara().markWebOnboarded();
    } catch {
      // Swallow — worst case the walkthrough shows again next load.
    }
    router.refresh();
  }

  if (closing) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Getting started with Memoria"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-[fadeIn_150ms_ease-out]"
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-card shadow-2xl">
        {/* Image / illustration area. Screenshots have varied aspect
            ratios (some are wide+short nav crops, others taller) — use
            object-contain inside a capped-height box so the annotation
            is never cropped off. */}
        {current.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.image}
            alt={current.title}
            className="max-h-[38vh] w-full border-b border-line bg-paper-dim object-contain"
            // If the screenshot asset is missing, hide the broken-image
            // icon — the card still reads fine as text-only.
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex aspect-[3/1] w-full items-center justify-center border-b border-line bg-paper-dim">
            <span className="font-serif text-5xl text-ink2">Memoria</span>
          </div>
        )}

        {/* Copy */}
        <div className="flex flex-col gap-3 px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <h2 className="font-serif text-2xl tracking-tight text-ink">
            {current.title}
          </h2>
          <p className="text-base leading-relaxed text-ink2">{current.body}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                i === step
                  ? 'h-1.5 w-5 rounded-full bg-action transition-all'
                  : 'h-1.5 w-1.5 rounded-full bg-line transition-all'
              }
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-ink3 hover:text-ink transition-colors"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-md border border-line bg-card-alt px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim transition-colors"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={finish}
                className="rounded-md bg-action px-5 py-2 text-sm font-semibold text-action-ink hover:bg-ink2 transition-colors"
              >
                Get started
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="rounded-md bg-action px-5 py-2 text-sm font-semibold text-action-ink hover:bg-ink2 transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
