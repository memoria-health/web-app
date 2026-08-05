'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/// The explainer behind the ⓘ on EvaluationModeSettings.
///
/// Rendered through a PORTAL to document.body. Without it the dialog is a
/// child of the settings card, which sits inside an ancestor stacking
/// context, so `fixed inset-0 z-50` positioned against that ancestor
/// instead of the viewport: the panel rendered through the cards behind
/// it and its footer fell off the bottom of the screen. Observed
/// 2026-08-05. A portal is the fix, not a bigger z-index.
///
/// Copy is deliberately plain. The reader is a family member, not an
/// engineer, and the honest opening is that the AI gets things wrong.
/// The image comes FIRST because it is the whole argument: someone
/// decides whether this is acceptable by looking, not by reading. Keep
/// the wording identical to the iOS and Android sheets.
export function EvaluationModeInfoModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on Escape, and stop the page behind from scrolling under the
  // dialog while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="About evaluation mode"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-lg overflow-hidden rounded-xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src="/evaluation-mode-mask.jpg"
          alt="A camera view of a room with the person covered by a solid green shape"
          className="block w-full"
        />

        <div className="flex flex-col gap-4 p-6">
          <h2 className="font-serif text-2xl text-ink">Evaluation mode</h2>

          <p className="text-sm leading-relaxed text-ink3">
            Video data is not always perfect, and sometimes our AI gets things wrong.
          </p>
          <p className="text-sm leading-relaxed text-ink3">
            Evaluation mode adds a second pair of eyes. Before an alert reaches you, a trained member of our team takes a quick look and stops the false alarms, so you only get notified about the things that matter.
          </p>
          <p className="text-sm leading-relaxed text-ink3">
            The picture above is all they see. Faces, bodies and clothing are covered by a solid shape, so they can tell what happened without seeing who it is. They can hear the clip as well, because a call for help is often the clearest sign that something is wrong.
          </p>
          <p className="text-sm leading-relaxed text-ink3">
            You can turn this off at any time.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-1 w-full rounded-md bg-action px-4 py-2.5 text-sm font-medium text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
