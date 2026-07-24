// Expectations notice for fine-detail detectors (small motion like
// seizure/choking, small objects like medication/stove). Mirrors the iOS
// AccuracyCaveatNotice: info styling, not alarm — it sets expectations, it
// is not an error. Driven by `Detector.accuracy_caveat` (server-computed;
// absent → hidden). `compact` is the one-line caption for dense lists; the
// full notice is the default (create review + detail page).
export function AccuracyCaveatNotice({ compact = false }: { compact?: boolean }) {
  const full =
    'This detector reads fine visual detail. Accuracy varies with camera ' +
    'distance, lighting, and viewing angle, and events can be missed or ' +
    'misread. Treat alerts as a prompt to check in, not a certainty.';
  const short = 'Accuracy varies with distance and lighting.';
  return (
    <div
      className={
        compact
          ? 'flex items-start gap-1.5 text-xs text-ink4'
          : 'flex items-start gap-2 rounded-md border border-line bg-paper-dim/60 p-3 text-sm text-ink3'
      }
    >
      <span aria-hidden className="shrink-0 leading-5">
        ⓘ
      </span>
      <span>{compact ? short : full}</span>
    </div>
  );
}
