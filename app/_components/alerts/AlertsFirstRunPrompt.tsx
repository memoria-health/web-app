'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAlerts } from './AlertsProvider';

// First-visit pre-prompt for browser alerts. Shown ONCE per device, the first
// time a signed-in caregiver lands with notifications still at the browser
// default (un-decided).
//
// WHY a banner instead of auto-calling the OS prompt: Firefox & Safari BLOCK a
// notification prompt that isn't triggered by a user gesture, and audio can't
// unlock without a gesture either. So the "Enable alerts" click is the gesture
// that fires the real prompt + primes audio (see AlertsProvider.enable). This
// gives the "it offers alerts the first time I enter" feel, cross-browser, and
// without the abuse penalties Chrome applies to on-load prompts.
//
// We deliberately DON'T show this when permission is already:
//   • 'granted'  → alerts are effectively available; no need to nag.
//   • 'denied'   → the browser won't let us re-prompt anyway; the bell's
//                  tooltip points those users to site settings instead.
// Dismissing OR enabling sets the seen-flag, so it never appears twice.
const SEEN_KEY = 'memoria.browserAlerts.prompted';

export function AlertsFirstRunPrompt() {
  const { enabled, permission, enable } = useAlerts();
  const [show, setShow] = useState(false);

  // Decide on mount (client only — localStorage/permission don't exist during
  // SSR). The seen-flag short-circuits returning users, so enabling/dismissing
  // earlier means no flash on later visits. setState-in-effect is the standard
  // hydration pattern here (runs once), hence the scoped suppression.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY) === '1';
    setShow(!seen && !enabled && permission === 'default');
  }, [enabled, permission]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, '1');
    setShow(false);
  };
  const onEnable = async () => {
    localStorage.setItem(SEEN_KEY, '1');
    await enable(); // gesture → OS permission prompt + audio prime
    setShow(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex max-w-xl items-center gap-3 rounded-lg border border-line bg-card px-4 py-3 shadow-lg">
        <Bell className="h-5 w-5 shrink-0 text-ink2" />
        <p className="flex-1 text-sm text-ink2">
          Get a sound and a desktop alert on this device the moment an event
          happens — so you don&rsquo;t have to keep watching the dashboard.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md border border-line bg-transparent px-3 py-1.5 text-sm text-ink2 transition-colors hover:bg-paper-dim hover:text-ink"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => void onEnable()}
          className="rounded-md bg-action px-3 py-1.5 text-sm font-semibold text-action-ink transition-colors hover:bg-ink2"
        >
          Enable alerts
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-ink3 transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
