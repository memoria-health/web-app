'use client';

import { Bell, BellOff } from 'lucide-react';
import { useAlerts } from './AlertsProvider';

// Per-device on/off for browser alerts, shown in the top nav (so it's visible
// on every page, matching the global nature of the alerts). Enabling MUST be a
// click: browsers only allow Notification permission + audio priming inside a
// user gesture — that's why this is a button, never an auto-enable on load.
//
// State is per-device (localStorage) — see AlertsProvider. The bell reflects
// THIS browser's state only; enabling here does nothing to your other devices.
export function AlertsBell() {
  const { enabled, permission, enable, disable } = useAlerts();
  const blocked = permission === 'denied';

  return (
    <button
      type="button"
      onClick={() => (enabled ? disable() : void enable())}
      title={
        blocked
          ? 'Desktop notifications are blocked in your browser settings — sound + in-app toasts still work when on.'
          : enabled
            ? 'Browser alerts on (this device). Click to turn off.'
            : 'Get a sound + desktop alert when an event occurs (this device).'
      }
      aria-pressed={enabled}
      aria-label={enabled ? 'Turn off browser alerts' : 'Turn on browser alerts'}
      className="inline-flex items-center justify-center rounded-md p-1.5 text-ink3 transition-colors hover:text-ink"
    >
      {enabled ? (
        <Bell className="h-5 w-5" />
      ) : (
        <BellOff className="h-5 w-5" />
      )}
    </button>
  );
}
