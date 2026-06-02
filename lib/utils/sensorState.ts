// First-connect "preparing to start" tracking — the web mirror of the
// iOS `NemaraAPIClient.isPreparing` logic.
//
// A sensor that has NEVER come online (never reported `online === true`)
// is in a "preparing to start" state on its first connect — distinct
// from an established sensor that's merely offline right now. We persist
// the set of sensor ids that have ever been online in localStorage so the
// distinction survives a page reload: an established-but-currently-offline
// sensor must NOT regress to "preparing" after a refresh.
//
// SSR-safe: every accessor no-ops / returns false when `window` is
// undefined, so server render treats an unknown sensor as "not preparing"
// (plain offline). Components gate the preparing UI behind a post-mount
// flag to avoid a hydration mismatch.

const KEY = 'memoria.sensorsEverStarted';

type SensorLike = {
  id: string;
  paired: boolean;
  online: boolean;
  disabled: boolean;
  // Loosely typed so any `Camera` (whose field may be the wider `string`)
  // is assignable without a cast; we compare against the literal below.
  desired_state: string;
};

function load(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function hasSensorStarted(id: string): boolean {
  return load().has(id);
}

/** Record that a sensor has come online at least once (idempotent, persisted). */
export function markSensorStarted(id: string): void {
  if (typeof window === 'undefined') return;
  const set = load();
  if (set.has(id)) return;
  set.add(id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* quota / private-mode — preparing just won't persist, no crash */
  }
}

/**
 * True while a freshly-connected sensor is still coming up for the FIRST
 * time: paired, the caregiver wants it on, not hidden, but it has never
 * reported `online` yet on this browser. Drives the "Preparing to start"
 * treatment. An established sensor that's merely offline now (has been
 * online before) returns false → it reads as plain "offline".
 */
export function isSensorPreparing(cam: SensorLike): boolean {
  return (
    cam.paired &&
    cam.desired_state === 'connected' &&
    !cam.disabled &&
    !cam.online &&
    !hasSensorStarted(cam.id)
  );
}
