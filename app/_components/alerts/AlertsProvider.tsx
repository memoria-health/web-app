'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { formatLocalTime } from '@/lib/utils/time';
import type { DetectionEvent, Patient } from '@/lib/api/types';
import { AlertToast } from './AlertToast';
import { escalates } from '@/lib/categoryPalette';

// ---------------------------------------------------------------------------
// Browser alerts (Tier 1 + 2) — the web analog of iOS push notifications.
//
// WHAT: when a NEW detection event arrives over Realtime, play a sound, raise a
// desktop Notification, and pop an in-app toast — so a caregiver watching the
// dashboard on a computer is alerted the moment something happens, on ANY page.
//
// SCOPE / LIMITS (read before extending):
//   • Works ONLY while a dashboard tab is OPEN (even backgrounded). This is NOT
//     true web-push: nothing fires when the browser is closed. The service-
//     worker / Push API path ("Tier 3") is intentionally out of scope — see
//     WEB_BROWSER_ALERTS_PLAN.md.
//   • Enablement + OS notification permission are PER-DEVICE/BROWSER
//     (`Notification.permission` is a browser concept), so the on/off flag
//     lives in localStorage, NOT the DB. localStorage never syncs across
//     devices, so each browser keeps its own honest state. There is
//     deliberately NO per-patient mute — same as iOS push: it fires for ALL of
//     the caregiver's patients.
//   • Only LIVE inserts alert. Realtime has no replay, so we never flood with a
//     backlog of missed events. EventsFeed's catch-up refetch does NOT route
//     through here.
//   • Mounted ONCE, in the signed-in (app) layout, which already has the full
//     patient list — that's what makes alerts fire globally, unlike EventsFeed
//     (which only subscribes while you're on one patient's page).
// ---------------------------------------------------------------------------

const LS_KEY = 'memoria.browserAlerts.enabled'; // per-device persisted flag

type Permission = 'default' | 'granted' | 'denied' | 'unsupported';

interface AlertsContextValue {
  enabled: boolean;
  permission: Permission;
  /**
   * Turn alerts on. MUST be called from a user gesture (a click): browsers
   * only allow `Notification.requestPermission()` and the audio "prime" inside
   * a gesture. See AlertsBell.
   */
  enable: () => Promise<void>;
  disable: () => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({
  patients,
  children,
}: {
  patients: Patient[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  // Render-safe defaults (SSR has no `window`/`Notification`). The real values
  // are read from the browser in the mount effect below.
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<Permission>('default');

  // A single primed <audio>. Browsers block programmatic `.play()` until the
  // element has been played once inside a user gesture (see enable()). We keep
  // one instance and reuse it for every alert.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Patient id → display name, for notification / toast copy.
  const nameById = useMemo(
    () => new Map(patients.map((p) => [p.id, p.preferred_name || p.full_name])),
    [patients],
  );

  // Hydrate persisted state on mount (client only — never touch window/
  // Notification/localStorage during render, or SSR throws). setState here is
  // the standard SSR-hydration pattern: the values only exist in the browser,
  // so they can't be initial state. The `set-state-in-effect` rule is a false
  // positive for this case (it warns about cascading renders; this runs once).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setEnabled(localStorage.getItem(LS_KEY) === '1');
    setPermission(
      typeof Notification === 'undefined'
        ? 'unsupported'
        : (Notification.permission as Permission),
    );
    const audio = new Audio('/sounds/alert.mp3');
    audio.preload = 'auto';
    audio.volume = 1.0;
    // Surface a LOAD failure (404 / wrong path / decode) distinctly from an
    // autoplay block — the two have completely different fixes.
    audio.onerror = () =>
      console.warn(
        '[alerts] sound file failed to load (/sounds/alert.mp3). Check it is served.',
      );
    audioRef.current = audio;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Re-prime audio on the FIRST user gesture of each page load. enable() primes
  // within its own click, but a caregiver who enabled on a PRIOR visit (the
  // flag is persisted in localStorage) never clicks enable again — their fresh
  // <audio> element would be autoplay-blocked on the first event and stay
  // silent. Priming on any first pointer/key gesture unlocks it. One-shot, and
  // only while alerts are enabled. THIS is what makes the sound reliable across
  // reloads — without it, sound only worked in the exact session you clicked
  // Enable.
  useEffect(() => {
    if (!enabled) return;
    const prime = () => {
      const a = audioRef.current;
      if (a) {
        a.muted = true;
        a.play()
          .then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = false;
          })
          .catch(() => {
            a.muted = false;
          });
      }
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
    window.addEventListener('pointerdown', prime);
    window.addEventListener('keydown', prime);
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, [enabled]);

  const enable = useCallback(async () => {
    // 1) Notification permission — must be requested inside the click gesture.
    if (typeof Notification !== 'undefined') {
      const p = await Notification.requestPermission();
      setPermission(p as Permission);
    }
    // 2) Play the chime AUDIBLY, right here inside the click gesture. Two jobs:
    //    (a) confirmation — the caregiver immediately hears what an alert sounds
    //        like, so "no sound" is obvious at enable time, not at 3am; and
    //    (b) unlock — a real gesture-driven play() satisfies the browser
    //        autoplay policy, so the later Realtime-driven plays are allowed for
    //        the rest of this page's lifetime.
    //    A persisted-enabled caregiver who never re-clicks Enable is covered by
    //    the first-gesture prime effect above instead.
    const a = audioRef.current;
    if (a) {
      a.muted = false;
      a.volume = 1.0;
      try {
        a.currentTime = 0;
      } catch {
        /* element not loaded yet — play() below still starts it */
      }
      try {
        await a.play();
      } catch (err) {
        console.warn('[alerts] confirmation sound blocked/failed:', err);
      }
    }
    localStorage.setItem(LS_KEY, '1');
    setEnabled(true);
  }, []);

  const disable = useCallback(() => {
    localStorage.setItem(LS_KEY, '0');
    setEnabled(false);
  }, []);

  // The actual alert, fired once per live INSERT.
  const fire = useCallback(
    (e: DetectionEvent) => {
      const who = nameById.get(e.patient_id) ?? 'A loved one';
      const title = `${who}: ${e.title}`;
      const isSafety = escalates(e.category);
      // Desktop Notification bodies are plain text only: the narrative plus a
      // "location · time" meta line (the same details the app shows for the
      // event). The in-app toast renders these richly via <AlertToast>.
      const notifBody = [
        e.narrative,
        `${e.location} · ${formatLocalTime(e.occurred_at)}`,
      ]
        .filter(Boolean)
        .join('\n');

      // Sound. Reset to the start so back-to-back events each replay the full
      // chime. We prime audio on enable AND on the first gesture of each page
      // load, so this should be unlocked — but if the tab got zero gestures this
      // session the browser still blocks it; log which failure it is rather than
      // swallowing it, so "no sound" is diagnosable from the console.
      const a = audioRef.current;
      if (a) {
        a.muted = false;
        a.volume = 1.0;
        try {
          a.currentTime = 0;
        } catch {
          /* not loaded yet — play() still starts it */
        }
        void a.play().catch((err: DOMException) =>
          console.warn(
            `[alerts] sound not played (${err?.name ?? 'error'}). ` +
              'If NotAllowedError: click anywhere on the dashboard once to unlock audio.',
          ),
        );
      }

      // Desktop notification (only if the user granted OS permission).
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        // `tag` coalesces repeats of the same event into one OS notification.
        // `requireInteraction` keeps a SAFETY alert on screen until dismissed
        // (Chrome desktop) instead of auto-hiding after a few seconds.
        const n = new Notification(title, {
          body: notifBody,
          tag: e.id,
          requireInteraction: isSafety,
        });
        n.onclick = () => {
          // Focus the dashboard window and deep-link to the patient — the web
          // parallel of the iOS notification-tap deep link.
          window.focus();
          router.push(`/patients/${e.patient_id}`);
          n.close();
        };
      }

      // In-app toast (Tier 2) — a custom, on-theme card (see AlertToast) that
      // mirrors the app's event rows: category accent, serif title, narrative,
      // and a "location · time" line. Click it to open the patient; × to
      // dismiss. SAFETY stays until dismissed; routine lingers ~12s. `unstyled`
      // strips sonner's default chrome so only our card renders.
      toast.custom(
        (id) => (
          <AlertToast event={e} who={who} onClose={() => toast.dismiss(id)} />
        ),
        { duration: isSafety ? Infinity : 12000, unstyled: true },
      );
    },
    [nameById, router],
  );

  // Global Realtime subscription. Rebuilds when enablement or the patient set
  // changes. Mirrors EventsFeed's `await getAuthedBrowserSupabase()` →
  // subscribe → `cancelled`-flag cleanup, which handles BOTH the dev Strict-
  // Mode double-mount AND the anon-role race (subscribing before the JWT is
  // pushed to Realtime silently drops every broadcast — see lib/supabase/client).
  useEffect(() => {
    if (!enabled || patients.length === 0) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void (async () => {
      const supa = await getAuthedBrowserSupabase();
      if (cancelled) return;
      // One channel, one INSERT handler per patient (small N), reusing the
      // proven per-patient filter. Each handler fires an alert.
      let ch = supa.channel('alerts:global');
      for (const p of patients) {
        ch = ch.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'events',
            filter: `patient_id=eq.${p.id}`,
          },
          (payload: RealtimePostgresInsertPayload<DetectionEvent>) =>
            fire(payload.new),
        );
      }
      const channel = ch.subscribe();
      cleanup = () => {
        void supa.removeChannel(channel);
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
    // `patients.map(...).join(',')` is a stable string key so we only
    // re-subscribe when the actual patient set changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, patients.map((p) => p.id).join(','), fire]);

  const value = useMemo(
    () => ({ enabled, permission, enable, disable }),
    [enabled, permission, enable, disable],
  );

  return (
    <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
  );
}

/// Read the alerts state + controls. Used by AlertsBell (the top-nav toggle).
export function useAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider');
  return ctx;
}
