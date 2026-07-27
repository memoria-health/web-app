'use client';

// Scroll-to-accept modal for the Terms of Service + Privacy Notice. The
// "I agree" button unlocks only after the user scrolls past the end of every
// document (a bottom sentinel becomes visible). Presentational + reusable:
//   - the (app) TermsGate wraps it with acceptTerms() and NO close (the
//     non-skippable post-login enforcement),
//   - the signup form wraps it with a local "agreed" flag and a close, so
//     the caregiver reviews + confirms right at signup.
// It owns no persistence — `onAgree` decides what acceptance means.

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { LEGAL_DOCS } from '@/lib/legal';

const TermsPdfStack = dynamic(() => import('./TermsPdfStack'), {
  ssr: false,
  loading: () => (
    <div className="py-16 text-center text-sm text-ink3">Loading documents…</div>
  ),
});

export function TermsConsentModal({
  onAgree,
  onClose,
  agreeLabel = 'I agree',
}: {
  onAgree: () => Promise<void> | void;
  // When provided the modal is dismissible (backdrop + Cancel). Omit for the
  // non-skippable enforcement gate.
  onClose?: () => void;
  agreeLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);
  // True only once every document has loaded — the button stays locked until
  // there's real content to scroll through (guards against a failed load
  // leaving a short body whose end is trivially "reached").
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(560);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.min(el.clientWidth - 32, 760)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Gate on the ACTUAL scroll position, not an initial sentinel visibility
  // (which fires before the PDF pages render and would latch open early).
  // Recheck on scroll AND whenever the content height changes (pages render
  // in async), so reaching the true bottom is what unlocks Agree.
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el) return;
    const check = () => {
      // 24px slack for sub-pixel rounding at the very end.
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 24);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (content) ro.observe(content);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, []);

  const canAgree = ready && atBottom;

  async function agree() {
    setBusy(true);
    setError(null);
    try {
      await onAgree();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review and accept terms"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      onClick={onClose ? () => onClose() : undefined}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-serif text-2xl tracking-tight text-ink">
            Review our Terms &amp; Privacy
          </h2>
          <p className="mt-1 text-sm text-ink3">
            Please scroll to the end of{' '}
            {LEGAL_DOCS.map((d, i) => (
              <span key={d.key}>
                {i > 0 ? ' and ' : ''}
                <span className="text-ink2">{d.title}</span>
              </span>
            ))}
            , then agree to continue.
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-paper-dim px-4 py-5">
          <div ref={contentRef}>
            <TermsPdfStack width={width} onReady={() => setReady(true)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <span className="text-xs text-ink3">
            {!ready
              ? 'Loading the documents…'
              : canAgree
                ? 'Thanks for reviewing.'
                : 'Scroll to the end of both documents to agree.'}
          </span>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-terra-deep">{error}</span>}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-ink3 hover:text-ink"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={!canAgree || busy}
              onClick={agree}
              className="rounded-md bg-action px-5 py-2 text-sm font-semibold text-action-ink transition-colors hover:bg-ink2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Saving…' : agreeLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
