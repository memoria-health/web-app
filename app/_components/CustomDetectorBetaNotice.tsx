// Beta marker for CUSTOM detectors — the ones a caregiver wrote
// themselves, as opposed to the presets we tuned and tested. Mirrors the
// iOS `CustomDetectorBetaNotice` and the Android one.
//
// Deliberately separate from `AccuracyCaveatNotice`, which answers a
// different question. That one is about the SUBJECT being hard to see
// (fine detail, small motion) and is server-computed per detector. This
// one is about the DETECTOR being newly generated from a sentence the
// caregiver typed, which we have never evaluated. A detector can be both,
// so the two are allowed to appear together.
export function CustomDetectorBetaNotice() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-terra/40 bg-terra-soft p-3 text-sm text-ink2">
      {/* Triangle, not the circle its sibling notice uses, so the two are
          distinguishable at a glance when a detector is both custom and
          fine-detail. h-4/w-4 + mt-px aligns it with the first line. */}
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        fill="currentColor"
        className="mt-px h-4 w-4 shrink-0 text-terra"
      >
        <path fillRule="evenodd" clipRule="evenodd" d="M8.26 2.6a2 2 0 0 1 3.48 0l6 10.5A2 2 0 0 1 16 16H4a2 2 0 0 1-1.74-2.9l6-10.5zM10 6a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1zm0 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
      </svg>
      <span>Custom detectors are in beta. Built from your description, so accuracy can vary.</span>
    </div>
  );
}

/// The small BETA chip that sits beside a custom detector's name.
export function BetaChip() {
  return (
    <span
      title="Custom detector, in beta. Accuracy can vary."
      className="inline-flex shrink-0 items-center rounded-sm bg-terra-soft px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-terra"
    >
      Beta
    </span>
  );
}

/// Larger BETA badge for sticking onto a button. `BetaChip` is a 10px mono
/// label, which disappears at that size against a real control, so this is
/// its own thing rather than the chip with a bigger font.
export function BetaBadge() {
  return (
    <span
      title="Custom detectors are in beta. Accuracy can vary."
      className="inline-flex items-center rounded-full bg-terra px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-terra-ink"
    >
      Beta
    </span>
  );
}
