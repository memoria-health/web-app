'use client';

// Hard, non-skippable acceptance gate for the Terms of Service + Privacy
// Notice. Rendered by the (app) layout whenever the caregiver's
// `tos_accepted_at` is null or their accepted `tos_version` is stale. There is
// NO close/skip affordance by design — "you cannot complete signup unless you
// agree." The Agree button unlocks only after the user scrolls past the end of
// every document (a bottom sentinel becomes visible). Enforcement is also
// server-side: the backend records tos_accepted_at, and the gate re-renders on
// every load until it's set for the current version.

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import { CURRENT_TOS_VERSION, LEGAL_DOCS } from '@/lib/legal';

// react-pdf/pdfjs are DOM-only — never import them on the server.
const TermsPdfStack = dynamic(() => import('./TermsPdfStack'), {
  ssr: false,
  loading: () => (
    <div className="py-16 text-center text-sm text-ink3">Loading documents…</div>
  ),
});

export function TermsGate() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(560);

  // Size the pages to the scroll container (re-measures on resize).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.min(el.clientWidth - 32, 760)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Unlock Agree only when the bottom sentinel (below every doc) is fully
  // visible. Robust against async page rendering — the sentinel is only
  // reachable after all pages have laid out AND the user scrolled to the end.
  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setAtBottom(true);
      },
      { root, threshold: 1.0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  async function agree() {
    setBusy(true);
    setError(null);
    try {
      await getBrowserNemara().acceptTerms(CURRENT_TOS_VERSION);
      // Server has stamped tos_accepted_at; re-render the layout so the gate
      // clears and the dashboard (or onboarding) shows.
      router.refresh();
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
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-card shadow-2xl">
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

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-paper-dim px-4 py-5"
        >
          <TermsPdfStack width={width} />
          {/* Bottom sentinel — visible only when scrolled past both docs. */}
          <div ref={sentinelRef} className="h-2 w-full" aria-hidden />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <span className="text-xs text-ink3">
            {atBottom
              ? 'Thanks for reviewing.'
              : 'Scroll to the end to enable Agree.'}
          </span>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-terra-deep">{error}</span>}
            <button
              type="button"
              disabled={!atBottom || busy}
              onClick={agree}
              className="rounded-md bg-action px-5 py-2 text-sm font-semibold text-action-ink transition-colors hover:bg-ink2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'I agree'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
