'use client';

/* The component palette the assistant "builds" views from. Each maps 1:1 to a
 * tool's output shape. Colors come from the Memoria tokens (globals.css). */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlarmClock, Camera, ChevronDown, ChevronRight, CircleAlert, Footprints, Pill, Play, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

const INK3 = '#4a4539';
const LINE = '#c9c0ab';
const TERRA = '#a04331';
const SKY = '#6b8aa0';
const SAGE = '#6f7f5c';
const WARN = '#c68a3d';

const TYPE_COLOR: Record<string, string> = {
  fall: TERRA,
  medication: SKY,
  agitation: WARN,
  wandering: SAGE,
  safety: TERRA,   // prod categories
  routine: SKY,
};
const PALETTE = ['#D55E00', '#0072B2', '#009E73', '#E69F00', '#CC79A7', '#56B4E9']; // Okabe–Ito: colorblind-safe, vivid on the warm paper theme
const MUTED = '#d8d0bd';
const TYPE_ICON: Record<string, React.ReactNode> = {
  fall: <CircleAlert size={14} />,
  medication: <Pill size={14} />,
  agitation: <AlarmClock size={14} />,
  wandering: <Footprints size={14} />,
};

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(28,26,20,0.06)]">
      <div className="mb-3 flex items-center gap-2 text-ink2">
        <span className="text-terra">{icon}</span>
        <h3 className="font-serif text-[15px] font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const shortDate = (d: string) => d.slice(5).replace('-', '/');
/* only shorten values that actually ARE dates — the model may put names or
   categories on the x-axis (slice(5) once turned "Margaret O'Brien" into
   "ret O'Brien") */
const smartTick = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? shortDate(v) : v);

/* Clip URL prefetch: when a card with clips renders, batch-sign ALL its clip
 * URLs immediately (one request). Expanding an event then streams straight
 * from storage — no sign round-trip at click time. Module-level cache so
 * multiple cards share signed URLs. */
const clipUrlCache = new Map<string, string>();
function useClipUrls(keys: (string | null | undefined)[]) {
  const [, bump] = useState(0);
  const want = keys.filter((k): k is string => Boolean(k));
  const sig = want.join('|');
  useEffect(() => {
    const missing = want.filter((k) => !clipUrlCache.has(k));
    if (!missing.length) return;
    fetch('/api/clip/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keys: missing }),
    })
      .then((r) => r.json())
      .then((rows: { key: string; url: string }[]) => {
        rows.forEach((r) => clipUrlCache.set(r.key, r.url));
        if (rows.length) bump((x) => x + 1);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return clipUrlCache;
}

/* Incident clip — mounts on expand with preload=auto (starts buffering right
 * away, before play is pressed); src is the pre-signed URL when prefetched,
 * else the signing redirect as fallback. */
function ClipPlayer({ clipKey, urls }: { clipKey: string; urls?: Map<string, string> }) {
  return (
    <video
      controls
      preload="auto"
      className="mt-2 w-full max-w-md rounded-lg border border-line bg-ink"
      src={urls?.get(clipKey) ?? `/api/clip?key=${encodeURIComponent(clipKey)}`}
    />
  );
}

export function ActivityTrendCard({ data, onDayClick }: { data: { patient: string; days: number; series: { date: string; activity: number }[] }; onDayClick?: (date: string) => void }) {
  return (
    <Card title={`Activity — ${data.patient}, last ${data.days} days`} icon={<Activity size={16} />}>
      <div className={`h-52 ${onDayClick ? 'cursor-pointer' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data.series}
            margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
            onClick={(st: any) => st?.activeLabel && onDayClick?.(String(st.activeLabel))}
          >
            <CartesianGrid stroke={LINE} strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: INK3, fontSize: 11 }} stroke={LINE} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: INK3, fontSize: 11 }} stroke={LINE} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#fbf8f0', border: `1px solid ${LINE}`, borderRadius: 12, fontSize: 12 }}
              labelFormatter={shortDate}
            />
            <Line type="monotone" dataKey="activity" stroke={TERRA} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-ink4">
        Activity index 0–100 · from the activity detector
        {onDayClick && <span className="text-terra"> · click a day to ask about it</span>}
      </p>
    </Card>
  );
}

export function DetectionCountsCard({ data, onDayClick }: { data: { patient: string; days: number; types: string[]; rows: Record<string, unknown>[] }; onDayClick?: (date: string) => void }) {
  return (
    <Card title={`Detections — ${data.patient}, last ${data.days} days`} icon={<CircleAlert size={16} />}>
      <div className={`h-52 ${onDayClick ? 'cursor-pointer' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.rows}
            margin={{ top: 4, right: 8, bottom: 0, left: -22 }}
            onClick={(st: any) => st?.activeLabel && onDayClick?.(String(st.activeLabel))}
          >
            <CartesianGrid stroke={LINE} strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: INK3, fontSize: 11 }} stroke={LINE} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: INK3, fontSize: 11 }} stroke={LINE} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#fbf8f0', border: `1px solid ${LINE}`, borderRadius: 12, fontSize: 12 }}
              labelFormatter={shortDate}
            />
            {data.types.map((t) => (
              <Bar key={t} dataKey={t} stackId="a" fill={TYPE_COLOR[t] ?? INK3} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {data.types.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-[11px] text-ink3">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLOR[t] }} />
            {t}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function UptimeCard({ data }: { data: { patient: string; days: number; cameras: { camera: string; uptimePct: number; offlineEvents: number; longestOfflineMin: number }[] } }) {
  return (
    <Card title={`Camera health — ${data.patient}, last ${data.days} days`} icon={<Camera size={16} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.cameras.map((c) => (
          <div key={c.camera} className="rounded-xl border border-line bg-card-alt/60 p-3">
            <div className="text-[13px] font-medium text-ink2">{c.camera}</div>
            <div className="mt-1 font-serif text-2xl font-semibold text-ink">
              {c.uptimePct}
              <span className="text-sm text-ink4">% uptime</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/60">
              <div
                className="h-full rounded-full"
                style={{ width: `${c.uptimePct}%`, background: c.uptimePct > 98 ? SAGE : c.uptimePct > 95 ? WARN : TERRA }}
              />
            </div>
            <div className="mt-2 text-[11px] text-ink4">
              {c.offlineEvents} offline event{c.offlineEvents === 1 ? '' : 's'} · longest {c.longestOfflineMin} min
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

type TimelineEvent = { ts: string; date?: string; type: string; title?: string; detail?: string | null; summary?: string; clipKey?: string | null };

/* Graph-first timeline, grouped by DAY:
 *   - events-per-day chart on top (click a bar to expand that day)
 *   - compact day rows below ("Jul 24 · 5 events"), click to expand the day
 *   - "Show all events" toggle, OFF by default (the flat list gets long)
 *   - within a day, click an event to expand its full narrative */
export function TimelineCard({ data }: { data: { patient: string; days: number; events: TimelineEvent[] } }) {
  const clipUrls = useClipUrls(data.events.map((e) => e.clipKey));
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<string | null>(null); // legend click filters

  const evDate = (e: TimelineEvent) => e.date ?? e.ts.slice(0, 10);

  // build the per-day, per-category chart series across the whole window
  const types = [...new Set(data.events.map((e) => e.type))];
  const byDay = new Map<string, Record<string, string | number>>();
  const today = new Date();
  for (let i = data.days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    byDay.set(d, { date: d });
  }
  for (const e of data.events) {
    const row = byDay.get(evDate(e));
    if (row) row[e.type] = ((row[e.type] as number) ?? 0) + 1;
  }
  const series = [...byDay.values()];

  // events grouped by day (respecting the category filter), newest first
  const filtered = catFilter ? data.events.filter((e) => e.type === catFilter) : data.events;
  const groups = new Map<string, TimelineEvent[]>();
  for (const e of filtered) {
    const d = evDate(e);
    groups.set(d, [...(groups.get(d) ?? []), e]);
  }
  const dayKeys = [...groups.keys()].sort().reverse();

  const toggleDay = (d: string) =>
    setOpenDays((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  const isDayOpen = (d: string) => showAll || openDays.has(d);

  const prettyDay = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <Card title={`Events timeline — ${data.patient}, last ${data.days} days`} icon={<AlarmClock size={16} />}>
      {data.events.length > 0 && (
        <>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={series}
                margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
                onClick={(st: any) => {
                  const d = st?.activePayload?.[0]?.payload?.date;
                  if (d && groups.has(d)) toggleDay(d);
                }}
              >
                <CartesianGrid stroke={LINE} strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: INK3, fontSize: 10 }} stroke={LINE} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: INK3, fontSize: 10 }} stroke={LINE} tickLine={false} width={26} />
                <Tooltip
                  contentStyle={{ background: '#fbf8f0', border: `1px solid ${LINE}`, borderRadius: 12, fontSize: 12 }}
                  labelFormatter={shortDate}
                  cursor={{ fill: '#c9c0ab', fillOpacity: 0.25 }}
                />
                {types.map((t) => (
                  <Bar key={t} dataKey={t} stackId="a" fill={TYPE_COLOR[t] ?? INK3} radius={[3, 3, 0, 0]} cursor="pointer" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mb-3 mt-1.5 flex flex-wrap items-center gap-2">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setCatFilter(catFilter === t ? null : t)}
                title={catFilter === t ? 'Show all categories' : `Show only ${t} events`}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  catFilter === t
                    ? 'border-terra bg-terra-soft text-terra-deep'
                    : catFilter
                      ? 'border-line bg-card text-ink4 opacity-50 hover:opacity-100'
                      : 'border-line bg-card text-ink3 hover:border-terra'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLOR[t] ?? INK3 }} />
                {t}
                {catFilter === t && <span>✕</span>}
              </button>
            ))}
            <span className="flex-1" />
            <button
              onClick={() => setShowAll((v) => !v)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                showAll ? 'border-terra bg-terra-soft text-terra-deep' : 'border-line bg-card text-ink3 hover:border-terra'
              }`}
            >
              {showAll ? 'Collapse all' : 'Show all events'}
            </button>
          </div>
        </>
      )}
      <ul className="divide-y divide-line/50">
        {dayKeys.map((d) => {
          const evs = groups.get(d)!;
          const open = isDayOpen(d);
          return (
            <li key={d}>
              {/* day row — click to expand that day (chart bars toggle this too) */}
              <button
                onClick={() => toggleDay(d)}
                className="flex w-full items-center gap-2.5 py-2 text-left hover:bg-card-alt/50"
              >
                <ChevronDown size={14} className={`shrink-0 text-ink4 transition-transform ${open ? 'rotate-180' : ''}`} />
                <span className="text-[13px] font-medium text-ink2">{prettyDay(d)}</span>
                <span className="flex items-center gap-1">
                  {[...new Set(evs.map((e) => e.type))].map((t) => (
                    <span key={t} className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[t] ?? INK3 }} />
                  ))}
                </span>
                <span className="flex-1" />
                <span className="text-[11px] tabular-nums text-ink4">
                  {evs.length} event{evs.length === 1 ? '' : 's'}
                </span>
              </button>
              {open && (
                <ul className="mb-1 ml-5 border-l border-line/60 pl-3">
                  {evs.map((e, i) => {
                    const key = `${d}:${i}`;
                    const label = e.title || e.summary || e.type;
                    const detail = e.detail ?? (e.title && e.summary && e.summary !== e.title ? e.summary : null);
                    const expandable = Boolean(detail || e.clipKey);
                    const isOpen = openEvent === key;
                    return (
                      <li key={key}>
                        <button
                          onClick={() => expandable && setOpenEvent(isOpen ? null : key)}
                          className={`flex w-full items-center gap-2.5 py-1.5 text-left ${expandable ? 'cursor-pointer hover:bg-card-alt/50' : 'cursor-default'}`}
                        >
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-terra-ink"
                            style={{ background: TYPE_COLOR[e.type] ?? INK3 }}
                          >
                            {TYPE_ICON[e.type] ?? <CircleAlert size={12} />}
                          </span>
                          <span className="flex-1 truncate text-[12.5px] text-ink2">{label}</span>
                          {e.clipKey && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-terra-soft px-2 py-0.5 text-[10px] font-medium text-terra-deep">
                              <Play size={9} /> clip
                            </span>
                          )}
                          <span className="shrink-0 text-[11px] tabular-nums text-ink4">{e.ts.slice(11, 16)}</span>
                          {expandable && (
                            <ChevronDown size={13} className={`shrink-0 text-ink4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          )}
                        </button>
                        {isOpen && (detail || e.clipKey) && (
                          <div className="mb-1.5 ml-7">
                            {detail && (
                              <p className="rounded-lg bg-card-alt/60 p-2.5 text-[12px] leading-relaxed text-ink3">{detail}</p>
                            )}
                            {e.clipKey && <ClipPlayer clipKey={e.clipKey} urls={clipUrls} />}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
        {data.events.length === 0 && <li className="py-1 text-[13px] text-ink4">No notable events in this window.</li>}
      </ul>
    </Card>
  );
}

export function LeaderboardCard({ data, onSelect }: { data: { days: number; ranking: { id?: string; patient: string; events: number; byCategory: Record<string, number> }[] }; onSelect?: (id: string) => void }) {
  const max = Math.max(1, ...data.ranking.map((r) => r.events));
  const rows = data.ranking.filter((r) => r.events > 0);
  return (
    <Card title={`Safety events by patient — last ${data.days} days`} icon={<CircleAlert size={16} />}>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.id ?? r.patient}
            onClick={() => r.id && onSelect?.(r.id)}
            className={onSelect ? 'group cursor-pointer rounded-lg px-1.5 py-1 -mx-1.5 transition-colors hover:bg-terra-soft/60' : ''}
            title={onSelect ? `Focus the dashboard on ${r.patient}` : undefined}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[13px] font-medium text-ink2">
                {r.patient}
                {onSelect && <ChevronRight size={13} className="text-terra opacity-40 transition-opacity group-hover:opacity-100" />}
              </span>
              <span className="flex items-center gap-2 text-[12px] tabular-nums text-ink3">
                {onSelect && <span className="hidden text-[11px] font-medium text-terra group-hover:inline">focus →</span>}
                {r.events}
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-line/40">
              {Object.entries(r.byCategory).map(([cat, n]) => (
                <div
                  key={cat}
                  title={`${cat}: ${n}`}
                  style={{ width: `${(100 * n) / max}%`, background: TYPE_COLOR[cat] ?? INK3 }}
                />
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-[13px] text-ink4">No safety events in this window.</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {[...new Set(rows.flatMap((r) => Object.keys(r.byCategory)))].map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-[11px] text-ink3">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLOR[t] ?? INK3 }} />
            {t}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function PatientsCard({ data }: { data: { id?: string; name: string; preferred: string; room: string; cameras: string[] }[] }) {
  return (
    <Card title="Your patients" icon={<Activity size={16} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((p) => (
          <div key={p.id ?? p.name} className="rounded-xl border border-line bg-card-alt/60 p-3">
            <div className="font-serif text-[15px] font-semibold text-ink">{p.name}</div>
            <div className="text-[12px] text-ink3">{p.room}</div>
            <div className="mt-1 text-[11px] text-ink4">{p.cameras.join(' · ')}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}


/* ── GenerativeView — the model AUTHORS this view on the spot ─────────────────
 * The assistant fetches data with the curated tools (data stays locked +
 * read-only), then composes a spec: which blocks, chart kind, series, groups,
 * what to highlight. This renderer draws whatever it designed. */

type GVPoint = { x: string; y: number };
type GVBlock = {
  type: 'chart' | 'events' | 'stats' | 'text';
  kind?: 'bar' | 'line';
  title?: string;
  stacked?: boolean;
  series?: { name: string; color?: string; data: GVPoint[] }[];
  highlightX?: string[];
  groups?: { date: string; highlighted?: boolean; events: { time?: string; label: string; detail?: string; clipKey?: string }[] }[];
  items?: { label: string; value: string; sub?: string }[];
  text?: string;
};

function GVChart({ b }: { b: GVBlock }) {
  const series = b.series ?? [];
  if (!series.length) return null;
  const rows = new Map<string, Record<string, string | number>>();
  for (const s of series)
    for (const p of s.data ?? []) {
      const row = rows.get(p.x) ?? { x: p.x };
      row[s.name] = p.y;
      rows.set(p.x, row);
    }
  const data = [...rows.values()];
  const hl = new Set(b.highlightX ?? []);
  const color = (i: number) => series[i].color ?? PALETTE[i % PALETTE.length];
  const axis = { tick: { fill: INK3, fontSize: 10 }, stroke: LINE, tickLine: false as const };
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        {b.kind === 'line' ? (
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke={LINE} strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="x" tickFormatter={smartTick} {...axis} />
            <YAxis {...axis} width={30} />
            <Tooltip contentStyle={{ background: '#fbf8f0', border: `1px solid ${LINE}`, borderRadius: 12, fontSize: 12 }} />
            {series.map((s, i) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={color(i)} strokeWidth={2.5} dot={false} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke={LINE} strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="x" tickFormatter={smartTick} {...axis} />
            <YAxis allowDecimals={false} {...axis} width={30} />
            <Tooltip contentStyle={{ background: '#fbf8f0', border: `1px solid ${LINE}`, borderRadius: 12, fontSize: 12 }} />
            {series.map((s, i) => (
              <Bar key={s.name} dataKey={s.name} stackId={b.stacked ? 'a' : undefined} radius={[3, 3, 0, 0]}
                   fill={color(i)}
                   {...(hl.size && series.length === 1
                     ? { children: data.map((d, j) => (
                         <Cell key={j} fill={hl.has(String(d.x)) ? TERRA : MUTED} />
                       )) }
                     : {})} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function GVEvents({ b }: { b: GVBlock }) {
  const groups = b.groups ?? [];
  const clipUrls = useClipUrls(groups.flatMap((g) => g.events.map((e) => e.clipKey)));
  const [openDays, setOpenDays] = useState<Set<string>>(
    () => new Set(groups.filter((g) => g.highlighted).map((g) => g.date)),
  );
  const [openEv, setOpenEv] = useState<string | null>(null);
  const toggle = (d: string) =>
    setOpenDays((prev) => {
      const n = new Set(prev);
      n.has(d) ? n.delete(d) : n.add(d);
      return n;
    });
  return (
    <ul className="divide-y divide-line/50">
      {groups.map((g) => {
        const open = openDays.has(g.date);
        return (
          <li key={g.date} className={g.highlighted ? 'rounded-lg bg-terra-soft/50' : ''}>
            <button onClick={() => toggle(g.date)} className="flex w-full items-center gap-2.5 px-1 py-2 text-left hover:bg-card-alt/50">
              <ChevronDown size={14} className={`shrink-0 text-ink4 transition-transform ${open ? 'rotate-180' : ''}`} />
              <span className="text-[13px] font-medium text-ink2">{g.date}</span>
              {g.highlighted && <span className="rounded-full bg-terra px-1.5 py-px text-[10px] text-terra-ink">match</span>}
              <span className="flex-1" />
              <span className="text-[11px] tabular-nums text-ink4">{g.events.length} event{g.events.length === 1 ? '' : 's'}</span>
            </button>
            {open && (
              <ul className="mb-1 ml-5 border-l border-line/60 pl-3">
                {g.events.map((e, i) => {
                  const k = `${g.date}:${i}`;
                  const isOpen = openEv === k;
                  return (
                    <li key={k}>
                      <button onClick={() => (e.detail || e.clipKey) && setOpenEv(isOpen ? null : k)}
                              className={`flex w-full items-center gap-2 py-1.5 text-left ${e.detail || e.clipKey ? 'cursor-pointer hover:bg-card-alt/50' : 'cursor-default'}`}>
                        <span className="flex-1 truncate text-[12.5px] text-ink2">{e.label}</span>
                        {e.clipKey && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-terra-soft px-2 py-0.5 text-[10px] font-medium text-terra-deep">
                            <Play size={9} /> clip
                          </span>
                        )}
                        {e.time && <span className="shrink-0 text-[11px] tabular-nums text-ink4">{e.time}</span>}
                        {(e.detail || e.clipKey) && <ChevronDown size={13} className={`shrink-0 text-ink4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                      </button>
                      {isOpen && (
                        <div className="mb-1.5">
                          {e.detail && (
                            <p className="rounded-lg bg-card-alt/60 p-2.5 text-[12px] leading-relaxed text-ink3">{e.detail}</p>
                          )}
                          {e.clipKey && <ClipPlayer clipKey={e.clipKey} urls={clipUrls} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function GenerativeView({ spec }: { spec: any }) {
  if (!spec?.blocks?.length) return null;
  return (
    <Card title={spec.title ?? 'Custom view'} icon={<Sparkles size={16} />}>
      <div className="space-y-4">
        {(spec.blocks as GVBlock[]).map((b, i) => {
          if (b.type === 'chart') return <div key={i}>{b.title && <p className="mb-1 text-[12px] font-medium text-ink3">{b.title}</p>}<GVChart b={b} /></div>;
          if (b.type === 'events') return <div key={i}>{b.title && <p className="mb-1 text-[12px] font-medium text-ink3">{b.title}</p>}<GVEvents b={b} /></div>;
          if (b.type === 'stats')
            return (
              <div key={i} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(b.items ?? []).map((it) => (
                  <div key={it.label} className="rounded-xl border border-line bg-card-alt/60 p-3">
                    <div className="text-[11px] text-ink4">{it.label}</div>
                    <div className="font-serif text-xl font-semibold text-ink">{it.value}</div>
                    {it.sub && <div className="text-[11px] text-ink4">{it.sub}</div>}
                  </div>
                ))}
              </div>
            );
          if (b.type === 'text') return <p key={i} className="text-[13px] leading-relaxed text-ink3">{b.text}</p>;
          return null;
        })}
      </div>
    </Card>
  );
}
