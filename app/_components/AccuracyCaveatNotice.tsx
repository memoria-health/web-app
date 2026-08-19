// Expectations notice for fine-detail detectors (small motion like
// seizure/choking, small objects like medication/stove). Mirrors the iOS
// AccuracyCaveatNotice: info styling, not alarm — it sets expectations, it
// is not an error. Driven by `Detector.accuracy_caveat` (server-computed;
// absent → hidden). `compact` is the one-line caption for dense lists; the
// full notice is the default (create review + detail page).
export function AccuracyCaveatNotice({ compact = false }: { compact?: boolean }) {
  // Kept BYTE-IDENTICAL to iOS AccuracyCaveatNotice.swift. This wording was
  // reworded there on 2026-08-17 and the web copy was missed, so the two
  // surfaces spent a month making different accuracy claims about the same
  // detector. Leading with the mechanism ("reads small, fine details") also
  // misdescribed whole-person detectors like choking, which carry this
  // notice too. If you change one, change both.
  const full =
    '100% accuracy is not guaranteed. How well this detector works ' +
    'depends on camera distance, lighting, and angle, and it can miss ' +
    'events or misread them. Treat any alert as a reason to check in, ' +
    'not as proof that something did or did not happen.';
  const short =
    '100% accuracy not guaranteed. Depends on camera distance, lighting, and angle.';
  return (
    <div
      className={
        compact
          ? 'inline-flex max-w-full items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-xs text-ink'
          : 'flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-ink2'
      }
    >
      {/* Inline SVG (not the ⓘ glyph, whose metrics don't line up with the
          text). h-4/w-4 + mt-px keeps it aligned with the first line. */}
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        fill="currentColor"
        className="mt-px h-4 w-4 shrink-0 text-warning"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 6a1 1 0 112 0 1 1 0 01-2 0zm0 3a1 1 0 012 0v5a1 1 0 11-2 0V9z"
          clipRule="evenodd"
        />
      </svg>
      <span>{compact ? short : full}</span>
    </div>
  );
}
