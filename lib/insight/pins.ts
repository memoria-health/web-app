/* Pinned views — chat-composed views promoted to permanent dashboard cards.
 * Prototype persistence = localStorage (per browser; the read-only DB can't
 * hold user state). Cards are SNAPSHOTS of the composed spec, stamped with
 * when they were pinned. */
export type Pin = { id: string; ts: number; spec: any };
const KEY = 'insight-pins';
export const EVENT = 'insight-pins-changed';

export function loadPins(): Pin[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
export function pinView(spec: any) {
  const pins = loadPins();
  pins.unshift({ id: `${Date.now()}-${pins.length}`, ts: Date.now(), spec });
  localStorage.setItem(KEY, JSON.stringify(pins.slice(0, 12)));
  window.dispatchEvent(new Event(EVENT));
}
export function unpin(id: string) {
  localStorage.setItem(KEY, JSON.stringify(loadPins().filter((p) => p.id !== id)));
  window.dispatchEvent(new Event(EVENT));
}
