/* Custom dashboard widgets — LIVE views, not snapshots.
 *
 * A widget stores a QUERY (source) + a viz choice; it re-fetches fresh data on
 * every dashboard load via /api/widget-data. Custom "groups" (e.g. serious =
 * stroke + heart attack) are just multi-term sources with a label — collapsed
 * they render as one combined series, expanded as stacked per-term series.
 *
 * Prototype persistence = localStorage (the DB is deliberately read-only);
 * production swaps this for an app-owned table keyed by caregiver. */

export type WidgetSource = {
  metric:
    | 'events' | 'activity' | 'coverage' | 'timeline' | 'leaderboard' | 'offline'
    | 'daysSince'   // days since the last matching event (stat)
    | 'presence'    // daily % of monitored windows with someone visible
    | 'reviews'     // alert review status (unreviewed / confirmed / dismissed)
    | 'routine'     // daily first/last presence hour (wake & bed proxies)
    | 'matrix'      // patients × event types grid
    | 'clips';      // latest incident clips gallery
  patient: string | null; // patient id, or null = all patients
  patientLabel?: string;  // display name ("Maggie", "All patients")
  terms?: string[];       // detection keywords to match (title/narrative/category)
  groupLabel?: string;    // name for the combined group ("Serious")
  night?: boolean;        // only events between 22:00-06:00
  breakdown?: boolean;    // categorical: one bar per event TYPE (not over time)
  byRoom?: boolean;       // categorical: one bar per room
  byHour?: boolean;       // hour-of-day histogram (00-23)
  byDow?: boolean;        // day-of-week pattern (Mon-Sun)
  comparePrev?: boolean;  // overlay the previous period as a second series
  compareWith?: string | null;   // second patient id → side-by-side series
  compareWithLabel?: string;
  rolling?: number;       // rolling-average window (e.g. 7) → smooth trend line
  ratio?: 'nightsWith' | 'daysWith'; // % of nights/days having a matching event
  overlay?: 'activity' | null;        // add the activity % line on a 2nd axis
  baseline?: boolean;     // typical-range band from the preceding period
  threshold?: number;     // goal line; series exceeding it flags the widget
  days: number;
  granularity: 'day' | 'week';
};

export type Widget = {
  id: string;
  title: string;
  source: WidgetSource;
  viz: { type: 'bar' | 'line' | 'stat' | 'timeline' | 'cameras' | 'leaderboard' | 'pie' | 'heatmap' | 'calendar' | 'matrix' | 'clips' };
  expanded: boolean; // group drill-down: false = combined, true = per-term stacked
  size: 's' | 'm' | 'l'; // s = quarter, m = half, l = full row
  unconfigured?: boolean; // dropped from the palette, awaiting chat configuration
  ts: number;
};

export type Group = { name: string; terms: string[] };

const WKEY = 'insight-widgets';
const GKEY = 'insight-groups';
const LKEY = 'insight-widget-library';
export const WEVENT = 'insight-widgets-changed';

const emit = () => window.dispatchEvent(new Event(WEVENT));

export function loadWidgets(): Widget[] {
  try { return JSON.parse(localStorage.getItem(WKEY) ?? '[]'); } catch { return []; }
}
export function saveWidget(w: Omit<Widget, 'id' | 'ts'>, atIndex?: number): Widget {
  const all = loadWidgets();
  const created: Widget = { ...w, id: `w${Date.now()}`, ts: Date.now() };
  if (atIndex != null && atIndex >= 0 && atIndex <= all.length) all.splice(atIndex, 0, created);
  else all.push(created); // default: END of the grid — never displaces the layout
  localStorage.setItem(WKEY, JSON.stringify(all.slice(0, 30)));
  if (!created.unconfigured) upsertLibrary(created);
  emit();
  return created;
}
export function updateWidget(id: string, patch: Partial<Widget>) {
  const next = loadWidgets().map((w) => (w.id === id ? { ...w, ...patch } : w));
  localStorage.setItem(WKEY, JSON.stringify(next));
  const w = next.find((x) => x.id === id);
  if (w && !w.unconfigured) upsertLibrary(w); // every configured widget is reusable
  emit();
}

/* ── the widget LIBRARY: every widget ever configured, re-addable later ── */
export type LibraryItem = { id: string; title: string; source: WidgetSource; viz: Widget['viz']; ts: number };
export function loadLibrary(): LibraryItem[] {
  try { return JSON.parse(localStorage.getItem(LKEY) ?? '[]'); } catch { return []; }
}
export function removeFromLibrary(id: string) {
  localStorage.setItem(LKEY, JSON.stringify(loadLibrary().filter((x) => x.id !== id)));
  emit();
}
export function upsertLibrary(w: { id: string; title: string; source: WidgetSource; viz: Widget['viz'] }) {
  const all = loadLibrary().filter((x) => x.id !== w.id && x.title !== w.title);
  all.unshift({ id: w.id, title: w.title, source: w.source, viz: w.viz, ts: Date.now() });
  localStorage.setItem(LKEY, JSON.stringify(all.slice(0, 30)));
}
export function removeWidget(id: string) {
  localStorage.setItem(WKEY, JSON.stringify(loadWidgets().filter((w) => w.id !== id)));
  emit();
}

/* drag-and-drop: move dragged widget to the target's position */
export function reorderWidgets(dragId: string, targetId: string) {
  const all = loadWidgets();
  const from = all.findIndex((w) => w.id === dragId);
  const to = all.findIndex((w) => w.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = all.splice(from, 1);
  all.splice(to, 0, moved);
  localStorage.setItem(WKEY, JSON.stringify(all));
  emit();
}

/* First run: the old fixed dashboard, reborn as ordinary widgets — every card
 * is editable/movable/deletable like anything the caregiver creates. */
export function seedDefaultWidgets() {
  if (localStorage.getItem('insight-seeded-v2')) return;
  localStorage.setItem('insight-seeded-v2', '1');
  if (loadWidgets().length > 0) return;
  const mk = (w: Omit<Widget, 'id' | 'ts'>, i: number): Widget => ({ ...w, id: `seed${i}`, ts: Date.now() });
  const seeds: Widget[] = [
    mk({ title: 'Safety events (7d)', source: { metric: 'events', patient: null, patientLabel: 'All patients', days: 7, granularity: 'day' }, viz: { type: 'stat' }, expanded: false, size: 's' }, 1),
    mk({ title: 'Night events (7d)', source: { metric: 'events', patient: null, patientLabel: 'All patients', night: true, days: 7, granularity: 'day' }, viz: { type: 'stat' }, expanded: false, size: 's' }, 2),
    mk({ title: 'Activity index (7d)', source: { metric: 'activity', patient: null, patientLabel: 'All patients', days: 7, granularity: 'day' }, viz: { type: 'stat' }, expanded: false, size: 's' }, 3),
    mk({ title: 'Cameras offline', source: { metric: 'offline', patient: null, patientLabel: 'All patients', days: 7, granularity: 'day' }, viz: { type: 'stat' }, expanded: false, size: 's' }, 4),
    mk({ title: 'Events by patient (30d)', source: { metric: 'leaderboard', patient: null, patientLabel: 'All patients', days: 30, granularity: 'day' }, viz: { type: 'leaderboard' }, expanded: false, size: 'm' }, 5),
    mk({ title: 'Events timeline (14d)', source: { metric: 'timeline', patient: null, patientLabel: 'All patients', days: 14, granularity: 'day' }, viz: { type: 'timeline' }, expanded: false, size: 'm' }, 6),
  ];
  localStorage.setItem(WKEY, JSON.stringify(seeds));
  seeds.forEach((w) => upsertLibrary(w));
  emit();
}

export function loadGroups(): Group[] {
  try { return JSON.parse(localStorage.getItem(GKEY) ?? '[]'); } catch { return []; }
}
export function saveGroup(g: Group) {
  const all = loadGroups().filter((x) => x.name.toLowerCase() !== g.name.toLowerCase());
  all.unshift(g);
  localStorage.setItem(GKEY, JSON.stringify(all.slice(0, 20)));
  emit();
}
