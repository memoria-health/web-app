'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatLocalTime, timeAgo } from '@/lib/utils/time';
import type { DetectionEvent } from '@/lib/api/types';
import { escalates } from '@/lib/categoryPalette';

// Custom sonner toast for a live event alert. Mirrors an EventsFeed row so the
// alert feels like the app's own event cards — category accent (terra=safety /
// sky=routine), serif title, narrative, and a mono "location · time" line.
// Rendered via `toast.custom(..., { unstyled: true })` so only this card shows.
//
// The card itself is intentionally NOT clickable: the web dashboard has no
// event-detail page to open, so a whole-card click would just dismiss and imply
// a destination that doesn't exist. Dismissal is the × only — given a generous
// hit area so it's easy to click.
export function AlertToast({
  event,
  who,
  onClose,
}: {
  event: DetectionEvent;
  who: string;
  onClose: () => void;
}) {
  const isSafety = escalates(event.category);
  return (
    <div
      className={cn(
        'w-[360px] select-none rounded-lg border bg-card p-4 shadow-lg',
        isSafety ? 'border-terra/40' : 'border-line',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider',
            isSafety
              ? 'border-terra/40 bg-terra-soft text-terra-deep'
              : 'border-sky/40 bg-sky-soft text-sky',
          )}
        >
          {event.category}
        </span>
        <span className="font-mono text-xs tracking-wide text-ink4">
          {timeAgo(event.occurred_at)}
        </span>
        {/* Dismiss — the ONLY interactive element. Negative margins pull it into
            the card's corner without pushing the header layout; p-2 gives a
            ~36px tap target around the 20px glyph. */}
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onClose}
          className="-mr-2 -mt-2 ml-auto rounded-md p-2 text-ink3 transition-colors hover:bg-paper-dim hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <p className="mt-2 font-serif text-lg leading-snug text-ink">
        {who}: {event.title}
      </p>

      {event.narrative && (
        <p className="mt-1 text-sm leading-relaxed text-ink2">
          {event.narrative}
        </p>
      )}

      <p className="mt-2 font-mono text-xs tracking-wide text-ink4">
        {event.location} · <code>{formatLocalTime(event.occurred_at)}</code>
      </p>
    </div>
  );
}
