'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

import {
  ArrowUp, BookOpen, ChevronDown, GripVertical, Layers, MessageCircle, Pencil, Play, TrendingDown, TrendingUp, X,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, Pie, PieChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  loadGroups, loadLibrary, loadWidgets, removeFromLibrary, removeWidget, reorderWidgets, saveGroup,
  saveWidget, seedDefaultWidgets, updateWidget, WEVENT, type LibraryItem, type Widget, type WidgetSource,
} from '@/lib/insight/widgets';

const INK3 = '#4a4539';
const LINE = '#c9c0ab';
const PALETTE = ['#D55E00', '#0072B2', '#009E73', '#E69F00', '#CC79A7', '#56B4E9']; // Okabe–Ito: colorblind-safe, vivid on the warm paper theme
const shortDate = (d: string) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(5).replace('-', '/') : d);

export function useWidgetData(source: WidgetSource) {
  const [data, setData] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const lastFetch = useRef(0);
  const sig = JSON.stringify(source);
  /* Widgets are live queries, and the dashboard stays MOUNTED across view
   * switches (for background builds) — so a mount-only fetch would go stale.
   * Refresh every 2 min while open, plus on window focus (throttled). */
  useEffect(() => {
    const bump = () => { if (Date.now() - lastFetch.current > 30_000) setTick((t) => t + 1); };
    // hidden tabs do NOT refresh — a dashboard left open overnight generated
    // constant DB traffic (2026-07-28 prod connection exhaustion); catch-up
    // happens the moment the tab becomes visible again
    const iv = setInterval(() => { if (!document.hidden) setTick((t) => t + 1); }, 120_000);
    window.addEventListener('focus', bump);
    document.addEventListener('visibilitychange', bump);
    return () => { clearInterval(iv); window.removeEventListener('focus', bump); document.removeEventListener('visibilitychange', bump); };
  }, []);
  // clear only when the QUERY changes — periodic refreshes keep the old chart
  // on screen instead of flashing "loading…"
  useEffect(() => { setData(null); }, [sig]);
  useEffect(() => {
    let alive = true;
    lastFetch.current = Date.now();
    // GET so Vercel's edge cache can absorb refreshes (POST is uncacheable)
    fetch(`/api/insight/widget-data?s=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData((p: any) => p ?? { error: 'failed' }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, tick]);
  return data;
}

function combineRows(rows: Record<string, any>[], terms: string[], label: string) {
  return rows.map((r) => ({
    bucket: r.bucket,
    [label]: terms.reduce((s, t) => s + (Number(r[t]) || 0), 0),
  }));
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev && !cur) return null;
  const pct = prev > 0 ? Math.round((100 * (cur - prev)) / prev) : cur > 0 ? 100 : 0;
  if (pct === 0) return <span className="text-[11px] text-ink4">flat vs prior</span>;
  return (
    <span className={`flex items-center gap-0.5 text-[11px] ${pct > 0 ? 'text-terra' : 'text-sage'}`}>
      {pct > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(pct)}% vs prior {`period`}
    </span>
  );
}

/* dow × hour heatmap with a REAL tooltip — native `title` has a ~1s delay and
 * no touch support, which reads as "hover does nothing". This one follows the
 * cursor instantly; clicking a cell pins the readout. */
function HeatmapGrid({ data }: { data: any }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ lbl: string; h: number; n: number } | null>(null);
  const [pinned, setPinned] = useState<{ lbl: string; h: number; n: number } | null>(null);
  const max = Math.max(1, ...data.cells.map((c: any) => c.n));
  const cell = (dow: number, h: number) => data.cells.find((c: any) => c.dow === dow && c.h === h)?.n ?? 0;
  const shown = hover ?? pinned;
  const fmt = (c: { lbl: string; h: number; n: number }) =>
    `${c.lbl} ${String(c.h).padStart(2, '0')}:00–${String((c.h + 1) % 24).padStart(2, '0')}:00 · ${c.n} event${c.n === 1 ? '' : 's'}`;
  return (
    <div>
      <div
        ref={wrapRef}
        className="relative"
        onMouseMove={(e) => {
          const r = wrapRef.current?.getBoundingClientRect();
          if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        onMouseLeave={() => { setHover(null); setPos(null); }}
      >
        <div className="grid" style={{ gridTemplateColumns: 'auto repeat(24, 1fr)', gap: 2 }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center text-[8px] text-ink4">{h % 6 === 0 ? h : ''}</div>
          ))}
          {data.dows.map((lbl: string, di: number) => (
            <Fragment key={lbl}>
              <div className="pr-1 text-right text-[9.5px] leading-4 text-ink4">{lbl}</div>
              {Array.from({ length: 24 }, (_, h) => {
                const n = cell(di + 1, h);
                const isPinned = pinned?.lbl === lbl && pinned?.h === h;
                return (
                  <div key={`${lbl}${h}`} data-hm={`${lbl}-${h}`}
                       onMouseEnter={() => setHover({ lbl, h, n })}
                       onClick={() => setPinned(isPinned ? null : { lbl, h, n })}
                       className={`aspect-square cursor-pointer rounded-[2px] hover:ring-1 hover:ring-terra ${isPinned ? 'ring-1 ring-terra' : ''}`}
                       style={{ background: n ? `rgba(160,67,49,${0.15 + 0.85 * (n / max)})` : 'rgba(201,192,171,0.25)' }} />
                );
              })}
            </Fragment>
          ))}
        </div>
        {hover && pos && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line bg-paper px-2 py-1 text-[11px] text-ink shadow-md"
            style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, calc(-100% - 10px))' }}
          >
            {fmt(hover)}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[10.5px] text-ink4" data-hm-readout>
        {shown ? (
          <span className="font-medium text-ink">{fmt(shown)}{pinned && !hover ? ' (pinned — click again to clear)' : ''}</span>
        ) : (
          'darker = more events · hover for the count, click to pin · each cell = that weekday+hour totaled across the window'
        )}
      </p>
    </div>
  );
}

export function WidgetBody({ source, viz, expanded }: { source: WidgetSource; viz: Widget['viz']; expanded: boolean }) {
  const data = useWidgetData(source);
  const [showList, setShowList] = useState(false);
  const [openEv, setOpenEv] = useState<number | null>(null);
  if (!data) return <div className="flex h-24 items-center justify-center text-[12px] text-ink4">loading…</div>;
  if (data.error) return <div className="flex h-24 items-center justify-center text-[12px] text-terra">couldn’t load</div>;

  const unavailable = (msg?: string) => (
    <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-warning/60 bg-warning/5 px-3 text-center">
      <span className="text-[12.5px] font-medium text-ink2">this data doesn’t seem to be available</span>
      <span className="text-[11px] leading-relaxed text-ink4">{msg ?? 'it may not be collected, or the filters are too narrow'} — use 💬 to adjust what this looks for</span>
    </div>
  );
  if (data.unavailable) return unavailable(data.unavailable);

  /* stat — big number + delta + subtitle (any data kind that supplies statValue) */
  if (viz.type === 'stat' || data.kind === 'offline') {
    if (data.statValue == null) return unavailable();
    const cur = Number(String(data.statValue).replace('%', ''));
    return (
      <div>
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif text-3xl font-semibold text-ink">{data.statValue}</span>
          {data.prevValue != null && <Delta cur={cur} prev={Number(data.prevValue)} />}
        </div>
        {data.subtitle && <div className="mt-0.5 text-[11px] text-ink4">{data.subtitle}</div>}
        {data.kind === 'offline' && data.cameras?.length > 0 && (
          <>
            <button onClick={() => setShowList((v) => !v)} className="mt-1 flex items-center gap-1 text-[11px] font-medium text-terra">
              {showList ? 'hide cameras' : 'see which cameras'} <ChevronDown size={11} className={showList ? 'rotate-180' : ''} />
            </button>
            {showList && (
              <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                {data.cameras.map((c: any, i: number) => (
                  <div key={i} className="flex justify-between border-b border-line/40 pb-0.5 text-[11.5px]">
                    <span className="truncate text-ink2">{c.room} <span className="text-ink4">· {c.patient}</span></span>
                    <span className="shrink-0 text-ink4">{c.last_seen}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (data.kind === 'cameras') {
    if (!data.cameras?.length) return unavailable('no cameras found for this selection');
    return (
      <div>
        <div className="grid grid-cols-2 gap-2">
          {data.cameras.map((c: any) => (
            <div key={c.camera} className="rounded-xl border border-line bg-card-alt/60 p-2.5">
              <div className="truncate text-[12px] text-ink2">{c.camera}</div>
              <div className="font-serif text-lg font-semibold text-ink">{c.uptimePct}%</div>
            </div>
          ))}
        </div>
        {data.subtitle && <p className="mt-1.5 text-[11px] text-ink4">{data.subtitle}</p>}
      </div>
    );
  }

  if (data.kind === 'leaderboard') {
    if (!data.ranking?.length) return unavailable('no events in this window');
    const max = Math.max(1, ...data.ranking.map((r: any) => r.events));
    return (
      <div className="space-y-2">
        {data.ranking.map((r: any) => (
          <div key={r.id}>
            <div className="mb-0.5 flex justify-between text-[12.5px]"><span className="text-ink2">{r.patient}</span><span className="tabular-nums text-ink3">{r.events}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line/40">
              <div className="h-full rounded-full bg-terra" style={{ width: `${(100 * r.events) / max}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.kind === 'events') {
    if (!data.events?.length) return unavailable('no matching events in this window');
    return (
      <ul className="max-h-72 divide-y divide-line/40 overflow-y-auto">
        {data.events.map((e: any, i: number) => (
          <li key={i}>
            <button
              onClick={() => (e.detail || e.clipKey) && setOpenEv(openEv === i ? null : i)}
              className={`flex w-full items-center gap-2 py-1.5 text-left ${e.detail || e.clipKey ? 'cursor-pointer hover:bg-card-alt/50' : 'cursor-default'}`}
            >
              <span className="flex-1 truncate text-[12.5px] text-ink2">
                {e.title} {e.who && <span className="text-ink4">· {e.who}</span>}
              </span>
              {e.clipKey && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-terra-soft px-2 py-0.5 text-[10px] font-medium text-terra-deep">
                  <Play size={9} /> clip
                </span>
              )}
              <span className="shrink-0 text-[11px] tabular-nums text-ink4">{e.ts.slice(5, 16)}</span>
            </button>
            {openEv === i && (
              <div className="mb-1.5">
                {e.detail && <p className="rounded-lg bg-card-alt/60 p-2 text-[12px] leading-relaxed text-ink3">{e.detail}</p>}
                {e.clipKey && (
                  <video controls preload="metadata" className="mt-1.5 w-full max-w-sm rounded-lg border border-line bg-ink"
                         src={`/api/clip?key=${encodeURIComponent(e.clipKey)}`} />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }

  /* clip gallery */
  if (data.kind === 'clips') {
    if (!data.items?.length) return unavailable('no clips match this selection');
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {data.items.map((it: any, i: number) => (
          <div key={i} className="overflow-hidden rounded-xl border border-line bg-card-alt/40">
            <video controls preload="metadata" className="aspect-video w-full bg-ink"
                   src={`/api/clip?key=${encodeURIComponent(it.clipKey)}`} />
            <div className="px-2 py-1.5">
              <div className="truncate text-[11.5px] font-medium text-ink2">{it.title}</div>
              <div className="text-[10.5px] text-ink4">{it.who} · {it.ts}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* patients × types matrix */
  if (data.kind === 'matrix') {
    if (!data.rowsM?.length) return unavailable('no events in this window');
    const maxCell = Math.max(1, ...data.rowsM.flatMap((r: any) => r.cells));
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead><tr>
            <th className="pb-1 pr-2 text-left font-medium text-ink4">patient</th>
            {data.cols.map((t: string) => <th key={t} className="pb-1 px-1 text-right font-medium text-ink4">{t}</th>)}
          </tr></thead>
          <tbody>
            {data.rowsM.map((r: any) => (
              <tr key={r.patient} className="border-t border-line/40">
                <td className="py-1 pr-2 text-ink2">{r.patient}</td>
                {r.cells.map((n: number, j: number) => (
                  <td key={j} className="px-1 py-1 text-right tabular-nums"
                      style={{ background: n ? `rgba(160,67,49,${0.08 + 0.5 * (n / maxCell)})` : undefined, color: n / maxCell > 0.55 ? '#fbf8f0' : '#2e2a20' }}>
                    {n || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* dow × hour heatmap */
  if (data.kind === 'heatmap') {
    if (!data.cells?.length) return unavailable('no matching events in this window');
    return <HeatmapGrid data={data} />;
  }

  /* calendar (daily counts as a month-style grid) */
  if (viz.type === 'calendar') {
    const byDate = new Map<string, number>();
    for (const r of data.rows ?? []) byDate.set(String(r.bucket), (data.terms ?? []).reduce((s: number, t: string) => s + (Number(r[t]) || 0), 0));
    const days = Math.min(source.days, 119);
    const cells: { date: string; n: number; dow: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 86_400_000);
      const key = dt.toISOString().slice(0, 10);
      cells.push({ date: key, n: byDate.get(key) ?? 0, dow: (dt.getDay() + 6) % 7 });
    }
    const max = Math.max(1, ...cells.map((c) => c.n));
    const weeks: (typeof cells)[] = [];
    let wk: typeof cells = [];
    for (const cl of cells) { wk.push(cl); if (cl.dow === 6) { weeks.push(wk); wk = []; } }
    if (wk.length) weeks.push(wk);
    return (
      <div>
        <div className="flex gap-[3px]">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, di) => {
                const cl = w.find((x) => x.dow === di);
                if (!cl) return <div key={di} className="h-3.5 w-3.5" />;
                return (
                  <div key={di} title={`${cl.date} — ${cl.n} event${cl.n === 1 ? '' : 's'}`}
                       className="h-3.5 w-3.5 rounded-[3px]"
                       style={{ background: cl.n ? `rgba(160,67,49,${0.2 + 0.8 * (cl.n / max)})` : 'rgba(201,192,171,0.3)' }} />
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[10.5px] text-ink4">each square = a day · darker = more events{source.days > 119 ? ' · showing last 119 days' : ''}</p>
      </div>
    );
  }

  /* series (bar / line / pie) */
  const seriesTotal = (data.rows ?? []).reduce(
    (s: number, r: any) => s + (data.terms ?? []).reduce((x: number, t: string) => x + (Number(r[t]) || 0), 0), 0);
  if (!data.rows?.length || seriesTotal === 0) {
    if ((data.rows ?? []).length === 0 && data.statValue == null) return unavailable('no matching data in this window');
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 text-center">
        <span className="text-[12.5px] text-ink3">no matching events in this window</span>
        <span className="text-[11px] text-ink4">try a longer window, or different detection types — 💬 to adjust</span>
      </div>
    );
  }

  if (viz.type === 'pie' && data.categorical) {
    const pieData = data.rows.map((r: any) => ({ name: r.bucket, value: (data.terms ?? []).reduce((s: number, t: string) => s + (Number(r[t]) || 0), 0) }));
    return (
      <div className="flex items-center gap-3">
        <div className="h-40 w-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={70} paddingAngle={2}>
                {pieData.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#fbf8f0', border: `1px solid ${LINE}`, borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {pieData.map((p: any, i: number) => (
            <div key={p.name} className="flex items-center gap-1.5 text-[11.5px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate text-ink2">{p.name}</span>
              <span className="ml-auto tabular-nums text-ink3">{Math.round((100 * p.value) / seriesTotal)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const grouped = (data.terms?.length ?? 0) > 1;
  const label = source.groupLabel || 'combined';
  const terms: string[] = grouped && !expanded ? [label] : data.terms;
  const rows = grouped && !expanded ? combineRows(data.rows, data.terms, label) : data.rows;
  const axis = { tick: { fill: INK3, fontSize: 10 }, stroke: LINE, tickLine: false as const };
  const asLine = viz.type === 'line';
  const latest = rows.length ? (data.terms ?? []).reduce((s: number, t: string) => s + (Number(rows[rows.length - 1][t]) || 0), 0) : 0;
  const overThreshold = data.threshold != null && latest >= data.threshold;
  return (
    <div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: data.hasOverlay ? 2 : 8, bottom: 0, left: -10 }}>
            <CartesianGrid stroke={LINE} strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="bucket" tickFormatter={shortDate} {...axis} />
            <YAxis yAxisId="l" allowDecimals={false} {...axis} width={34} />
            {data.hasOverlay && <YAxis yAxisId="r" orientation="right" {...axis} width={30} unit="%" />}
            <Tooltip contentStyle={{ background: '#fbf8f0', border: `1px solid ${LINE}`, borderRadius: 12, fontSize: 12 }} labelFormatter={shortDate} />
            {data.baseline && (
              <ReferenceArea yAxisId="l" y1={data.baseline.lo} y2={data.baseline.hi} fill="#6f7f5c" fillOpacity={0.09}
                             label={{ value: 'typical', position: 'insideTopRight', fontSize: 9, fill: '#6f7f5c' }} />
            )}
            {terms.map((t, i) =>
              asLine ? (
                <Line key={t} yAxisId="l" type="monotone" dataKey={t} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={false} />
              ) : (
                <Bar key={t} yAxisId="l" dataKey={t} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={[3, 3, 0, 0]}>
                  {data.categorical && terms.length === 1
                    ? rows.map((_: any, j: number) => <Cell key={j} fill={PALETTE[j % PALETTE.length]} />)
                    : null}
                  {data.categorical && terms.length === 1 && (
                    <LabelList dataKey={t} position="top" style={{ fontSize: 10.5, fill: INK3, fontWeight: 600 }} />
                  )}
                </Bar>
              ),
            )}
            {rows.some((r: any) => r.trend != null) && (
              <Line yAxisId="l" type="monotone" dataKey="trend" stroke={INK3} strokeWidth={1.8} strokeDasharray="5 4" dot={false} name="trend" />
            )}
            {data.hasOverlay && (
              <Line yAxisId="r" type="monotone" dataKey="activityPct" stroke="#6b8aa0" strokeWidth={1.8} dot={false} name="activity %" connectNulls />
            )}
            {data.threshold != null && (
              <ReferenceLine yAxisId="l" y={data.threshold} stroke={overThreshold ? '#a04331' : '#c68a3d'} strokeDasharray="6 4"
                             label={{ value: `limit ${data.threshold}`, position: 'insideTopLeft', fontSize: 9, fill: overThreshold ? '#a04331' : '#c68a3d' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {overThreshold && (
        <p className="mt-1 rounded-lg bg-terra-soft px-2 py-1 text-[11px] font-medium text-terra-deep">above the limit you set ({latest} ≥ {data.threshold})</p>
      )}
      {(data.terms?.length ?? 0) > 0 && data.terms[0] !== 'events' && (
        <div className="mt-1.5 flex flex-wrap gap-2.5">
          {(grouped && !expanded ? [label] : data.terms).map((t: string, i: number) => (
            <span key={t} className="flex items-center gap-1.5 text-[11px] text-ink3">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
              {t}
            </span>
          ))}
          {data.hasOverlay && (
            <span className="flex items-center gap-1.5 text-[11px] text-ink3"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#6b8aa0' }} />activity %</span>
          )}
        </div>
      )}
    </div>
  );
}

const SIZE_CLASS: Record<Widget['size'], string> = {
  s: 'col-span-1',
  m: 'col-span-2',
  l: 'col-span-2 xl:col-span-4',
};
/* some visualizations physically can't fit a quarter-width card (a 24-column
 * heatmap, calendar weeks, the patients×types matrix, a clip gallery) — those
 * only cycle between the sizes that actually render. */
const ALLOWED_SIZES: Partial<Record<Widget['viz']['type'], Widget['size'][]>> = {
  heatmap: ['m', 'l'],
  calendar: ['m', 'l'],
  matrix: ['m', 'l'],
  clips: ['m', 'l'],
};
const sizesFor = (t: Widget['viz']['type']): Widget['size'][] => ALLOWED_SIZES[t] ?? ['s', 'm', 'l'];
const clampSize = (t: Widget['viz']['type'], s: Widget['size']): Widget['size'] => {
  const a = sizesFor(t);
  return a.includes(s) ? s : a[0];
};
const nextSize = (t: Widget['viz']['type'], s: Widget['size']): Widget['size'] => {
  const a = sizesFor(t);
  return a[(a.indexOf(clampSize(t, s)) + 1) % a.length];
};

/* tiny sketch previews so the palette LOOKS like what you'll get */
function ShapeThumb({ type }: { type: Widget['viz']['type'] }) {
  const ink = '#4a4539';
  const terra = '#a04331';
  const line = '#c9c0ab';
  if (type === 'line')
    return (
      <svg viewBox="0 0 84 44" className="h-full w-full">
        {[10, 22, 34].map((y) => <line key={y} x1="4" x2="80" y1={y} y2={y} stroke={line} strokeWidth="0.6" />)}
        <polyline points="6,32 20,18 34,26 48,24 62,10 78,14" fill="none" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
        {[[6,32],[20,18],[34,26],[48,24],[62,10],[78,14]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="2.4" fill={ink} />)}
      </svg>
    );
  if (type === 'bar')
    return (
      <svg viewBox="0 0 84 44" className="h-full w-full">
        {[[8,22,16],[26,12,26],[44,26,12],[62,6,32]].map(([x, y, h], i) => (
          <rect key={x} x={x} y={y} width="13" height={h} rx="1.5" fill={i === 3 ? terra : ink} opacity={i === 3 ? 1 : 0.75} />
        ))}
        <line x1="4" x2="80" y1="39" y2="39" stroke={line} strokeWidth="1" />
      </svg>
    );
  if (type === 'stat')
    return (
      <svg viewBox="0 0 84 44" className="h-full w-full">
        <text x="8" y="27" fontSize="21" fontWeight="700" fill={ink} fontFamily="serif">42</text>
        <path d="M52 22 l7 -8 l7 8" fill="none" stroke={terra} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="8" x2="76" y1="36" y2="36" stroke={line} strokeWidth="1" />
      </svg>
    );
  if (type === 'pie')
    return (
      <svg viewBox="0 0 84 44" className="h-full w-full">
        <circle cx="42" cy="22" r="17" fill={ink} opacity="0.25" />
        <path d="M42 22 L42 5 A17 17 0 0 1 58.5 26 Z" fill={terra} />
        <path d="M42 22 L58.5 26 A17 17 0 0 1 34 38.5 Z" fill={ink} opacity="0.65" />
      </svg>
    );
  if (type === 'heatmap')
    return (
      <svg viewBox="0 0 84 44" className="h-full w-full">
        {Array.from({ length: 4 }, (_, r) =>
          Array.from({ length: 8 }, (_, cc) => (
            <rect key={`${r}${cc}`} x={6 + cc * 9.4} y={4 + r * 9.4} width="7.6" height="7.6" rx="1.5"
                  fill={(r * 3 + cc) % 5 === 0 ? terra : ink} opacity={0.15 + 0.75 * (((r * 7 + cc * 3) % 10) / 10)} />
          )),
        )}
      </svg>
    );
  if (type === 'calendar')
    return (
      <svg viewBox="0 0 84 44" className="h-full w-full">
        {Array.from({ length: 3 }, (_, r) =>
          Array.from({ length: 10 }, (_, cc) => (
            <rect key={`${r}${cc}`} x={4 + cc * 7.8} y={6 + r * 11.5} width="6.2" height="9" rx="1.5"
                  fill={(r + cc) % 4 === 0 ? terra : line} opacity={(r + cc) % 4 === 0 ? 0.85 : 0.7} />
          )),
        )}
      </svg>
    );
  if (type === 'clips')
    return (
      <svg viewBox="0 0 84 44" className="h-full w-full">
        {[[6, 4], [44, 4], [6, 24], [44, 24]].map(([x, y], i) => (
          <g key={i}>
            <rect x={x} y={y} width="34" height="16" rx="3" fill={ink} opacity={i === 0 ? 0.85 : 0.45} />
            <path d={`M${x + 14} ${y + 4.5} l7 3.5 l-7 3.5 Z`} fill="#fbf8f0" />
          </g>
        ))}
      </svg>
    );
  if (type === 'timeline')
    return (
      <svg viewBox="0 0 84 44" className="h-full w-full">
        {[9, 21, 33].map((y, i) => (
          <g key={y}>
            <circle cx="10" cy={y} r="3" fill={i === 0 ? terra : ink} opacity={i === 0 ? 1 : 0.7} />
            <rect x="18" y={y - 2.5} width={i === 1 ? 40 : 52} height="5" rx="2.5" fill={line} />
            <rect x="62" y={y - 2.5} width="14" height="5" rx="2.5" fill={ink} opacity="0.35" />
          </g>
        ))}
      </svg>
    );
  if (type === 'leaderboard')
    return (
      <svg viewBox="0 0 84 44" className="h-full w-full">
        {[[8, 62], [20, 44], [32, 28]].map(([y, w], i) => (
          <g key={y}>
            <rect x="8" y={y} width={w} height="6" rx="3" fill={i === 0 ? terra : ink} opacity={i === 0 ? 1 : 0.6} />
          </g>
        ))}
        <line x1="8" x2="8" y1="4" y2="40" stroke={line} strokeWidth="1" />
      </svg>
    );
  return (
    <svg viewBox="0 0 84 44" className="h-full w-full">
      {[[8, 6], [46, 6], [8, 26], [46, 26]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="30" height="14" rx="3" fill={i === 1 ? terra : ink} opacity={i === 1 ? 0.9 : 0.55} />
      ))}
    </svg>
  );
}

const SHAPES: { type: Widget['viz']['type']; label: string; hint: string }[] = [
  { type: 'line', label: 'Line graph', hint: 'trends over time' },
  { type: 'bar', label: 'Bar chart', hint: 'counts by day/week' },
  { type: 'stat', label: 'Big number', hint: 'a single stat + change' },
  { type: 'pie', label: 'Pie', hint: 'share by type' },
  { type: 'heatmap', label: 'Heatmap', hint: 'weekday × hour pattern' },
  { type: 'calendar', label: 'Calendar', hint: 'which days had events' },
  { type: 'timeline', label: 'Event list', hint: 'events with clips' },
  { type: 'clips', label: 'Clips', hint: 'latest incident footage' },
  { type: 'leaderboard', label: 'By patient', hint: 'ranked patients' },
  { type: 'cameras', label: 'Cameras', hint: 'coverage tiles' },
];

function placeholderFor(type: Widget['viz']['type']): Omit<Widget, 'id' | 'ts'> {
  const metric =
    type === 'timeline' ? 'timeline' : type === 'leaderboard' ? 'leaderboard' : type === 'cameras' ? 'coverage'
    : type === 'clips' ? 'clips' : 'events';
  const extras: Partial<WidgetSource> =
    type === 'pie' ? { breakdown: true } : type === 'heatmap' ? { heatmap: true } as any : {};
  const label = SHAPES.find((s) => s.type === type)?.label ?? type;
  return {
    title: `New ${label.toLowerCase()}`,
    source: { metric, patient: null, patientLabel: 'All patients', days: 14, granularity: 'day', ...extras },
    viz: { type }, expanded: false, size: type === 'stat' ? 's' : 'm', unconfigured: true,
  };
}

export function WidgetCard({ w, onEdit, onShapeDrop, onLibraryDrop, dragKind, onDragKind }: { w: Widget; onEdit: (w: Widget) => void; onShapeDrop?: (shape: Widget['viz']['type']) => void; onLibraryDrop?: (libId: string) => void; dragKind?: 'shape' | 'library' | 'widget' | null; onDragKind?: (k: 'shape' | 'library' | 'widget' | null) => void }) {
  const grouped = (w.source.terms?.length ?? 0) > 1;
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(w.title);
  const commitTitle = () => {
    setEditingTitle(false);
    const t = titleDraft.trim();
    if (t && t !== w.title) updateWidget(w.id, { title: t });
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onDragKind?.(null);
        const shape = e.dataTransfer.getData('text/widget-shape');
        if (shape && onShapeDrop) return onShapeDrop(shape as Widget['viz']['type']);
        const lib = e.dataTransfer.getData('text/widget-library');
        if (lib && onLibraryDrop) return onLibraryDrop(lib);
        const id = e.dataTransfer.getData('text/widget-id');
        if (id && id !== w.id) reorderWidgets(id, w.id);
      }}
      className={`anim-up rounded-2xl border bg-card p-4 transition-all ${dragging ? 'opacity-40' : ''} ${
        over && dragKind ? 'border-terra outline-dashed outline-2 outline-terra/60 outline-offset-2' : 'border-line'
      } ${SIZE_CLASS[clampSize(w.viz.type, w.size)]}`}
    >
      <div className="mb-1.5 flex items-center gap-1">
        <span
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('text/widget-id', w.id); setDragging(true); onDragKind?.('widget'); }}
          onDragEnd={() => { setDragging(false); onDragKind?.(null); }}
          title="drag to move this widget"
          className="-m-1 shrink-0 cursor-grab rounded p-1 hover:bg-card-alt active:cursor-grabbing"
        >
          <GripVertical size={14} className="text-ink4/70" />
        </span>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
            className="min-w-0 flex-1 rounded-lg border border-terra bg-paper px-2 py-0.5 font-serif text-[14px] font-semibold text-ink outline-none"
          />
        ) : (
          <>
            {/* rename lives right next to the words it renames */}
            <h3 className="min-w-0 truncate font-serif text-[14px] font-semibold text-ink2">{w.title}</h3>
            <button
              onClick={() => { setTitleDraft(w.title); setEditingTitle(true); }}
              title="Rename this widget"
              className="shrink-0 rounded-md p-1 text-ink4/80 hover:bg-card-alt hover:text-terra"
            >
              <Pencil size={13} />
            </button>
          </>
        )}
        <div className="min-w-2 flex-1" />
        {/* action cluster: roomier hit targets so resize/remove aren't misclicks */}
        {grouped && (
          <button
            onClick={() => updateWidget(w.id, { expanded: !w.expanded })}
            title={w.expanded ? 'Combine into one series' : 'Break down by type'}
            className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10.5px] transition-colors ${
              w.expanded ? 'border-terra bg-terra-soft text-terra-deep' : 'border-line text-ink3 hover:border-terra'
            }`}
          >
            <Layers size={12} />
          </button>
        )}
        <button onClick={() => onEdit(w)} title="Edit this widget in chat" className="shrink-0 rounded-md p-1.5 text-ink4 hover:bg-card-alt hover:text-terra">
          <MessageCircle size={15} />
        </button>
        <button
          onClick={() => updateWidget(w.id, { size: nextSize(w.viz.type, w.size) })}
          title={`Resize (${sizesFor(w.viz.type).join(' → ')})`}
          className="shrink-0 rounded-md border border-line px-2 py-1 text-[10.5px] font-semibold uppercase leading-none text-ink4 hover:border-terra hover:text-ink2"
        >
          {clampSize(w.viz.type, w.size)}
        </button>
        <button onClick={() => removeWidget(w.id)} title="Remove widget" className="shrink-0 rounded-md p-1.5 text-ink4 hover:bg-card-alt hover:text-terra">
          <X size={15} />
        </button>
      </div>
      {w.unconfigured ? (
        <button
          onClick={() => onEdit(w)}
          className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-terra/40 bg-terra-soft/20 text-terra-deep transition-colors hover:bg-terra-soft/50"
        >
          <MessageCircle size={18} />
          <span className="text-[12.5px] font-medium">Describe it in the chat on the right</span>
          <span className="text-[11px] text-ink4">e.g. “Maggie’s activity, weekly”</span>
        </button>
      ) : (
        <>
          <p className="mb-2 text-[10.5px] text-ink4">
            {w.source.patientLabel || 'All patients'} · {w.source.days >= 3650 ? 'all time' : `${w.source.days}d`}{w.source.night ? ' · nights' : ''} · {w.source.granularity}
          </p>
          <WidgetBody source={w.source} viz={w.viz} expanded={w.expanded} />
        </>
      )}
    </div>
  );
}

/* ── manual builder ────────────────────────────────────────────────────── */
export function WidgetBuilder({
  patients, onClose,
}: {
  patients: { id: string; name: string; preferred: string }[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<WidgetSource['metric']>('events');
  const [patient, setPatient] = useState('');
  const [terms, setTerms] = useState('');
  const [groupLabel, setGroupLabel] = useState('');
  const [days, setDays] = useState(30);
  const [gran, setGran] = useState<'day' | 'week'>('day');
  const [type, setType] = useState<'bar' | 'line' | 'stat'>('bar');
  const groups = loadGroups();

  const submit = () => {
    const termList = terms.split(',').map((t) => t.trim()).filter(Boolean);
    const pl = patient ? patients.find((p) => p.id === patient) : null;
    if (groupLabel && termList.length > 1) saveGroup({ name: groupLabel, terms: termList });
    const vizType =
      metric === 'timeline' ? 'timeline' : metric === 'leaderboard' ? 'leaderboard' : metric === 'coverage' ? 'cameras' : metric === 'offline' ? 'stat' : type;
    saveWidget({
      title: title || `${groupLabel || metric} — ${pl?.preferred ?? 'All patients'}`,
      source: {
        metric, patient: patient || null, patientLabel: pl?.preferred || pl?.name || 'All patients',
        terms: termList, groupLabel: groupLabel || undefined, days, granularity: gran,
      },
      viz: { type: vizType as Widget['viz']['type'] }, expanded: false, size: metric === 'offline' ? 's' : 'm',
    });
    onClose();
  };

  const field = 'w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-terra';
  return (
    <div className="col-span-2 xl:col-span-4 rounded-2xl border border-terra/50 bg-card p-4">
      <h3 className="mb-3 font-serif text-[15px] font-semibold text-ink">New widget</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-[12px] text-ink3">Title<input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Serious events — Maggie" /></label>
        <label className="text-[12px] text-ink3">Data
          <select className={field} value={metric} onChange={(e) => setMetric(e.target.value as any)}>
            <option value="events">Events (detections)</option>
            <option value="activity">Activity index</option>
            <option value="timeline">Event timeline (list)</option>
            <option value="leaderboard">Events by patient</option>
            <option value="coverage">Camera coverage</option>
            <option value="offline">Cameras offline</option>
          </select>
        </label>
        <label className="text-[12px] text-ink3">Patient
          <select className={field} value={patient} onChange={(e) => setPatient(e.target.value)}>
            <option value="">All patients</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.preferred || p.name}</option>)}
          </select>
        </label>
        {(metric === 'events' || metric === 'activity') && (
          <label className="text-[12px] text-ink3">Chart
            <select className={field} value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="bar">Bars</option><option value="line">Line</option><option value="stat">Big number</option>
            </select>
          </label>
        )}
        {metric === 'events' && (
          <>
            <label className="text-[12px] text-ink3">Detection types (comma-separated)
              <input className={field} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="e.g. stroke, heart attack" />
              {groups.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {groups.map((g) => (
                    <button key={g.name} type="button" onClick={() => { setTerms(g.terms.join(', ')); setGroupLabel(g.name); }}
                      className="rounded-full border border-line bg-card-alt px-2 py-0.5 text-[10.5px] text-ink3 hover:border-terra">
                      {g.name}
                    </button>
                  ))}
                </span>
              )}
            </label>
            <label className="text-[12px] text-ink3">Group name (combines the types)
              <input className={field} value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} placeholder="e.g. Serious" />
            </label>
          </>
        )}
        <label className="text-[12px] text-ink3">Window
          <select className={field} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
          </select>
        </label>
        <label className="text-[12px] text-ink3">Granularity
          <select className={field} value={gran} onChange={(e) => setGran(e.target.value as any)}>
            <option value="day">Daily</option><option value="week">Weekly</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={submit} className="rounded-full bg-action px-4 py-1.5 text-[12.5px] font-medium text-terra-ink hover:opacity-85">Add widget</button>
        <button onClick={onClose} className="rounded-full border border-line px-4 py-1.5 text-[12.5px] text-ink3 hover:border-terra">Cancel</button>
      </div>
    </div>
  );
}

/* ── the whole dashboard body: one unified draggable grid ──────────────── */
export function WidgetsSection({
  patients, onEdit, scope,
}: {
  patients: { id: string; name: string; preferred: string }[];
  onEdit: (w: Widget) => void;
  scope?: string; // person chip: only this patient's widgets (fresh ones stay visible while being configured)
}) {
  const [allWidgets, setWidgets] = useState<Widget[]>([]);
  const widgets = scope ? allWidgets.filter((w) => w.unconfigured || w.source.patient === scope) : allWidgets;
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libOpen, setLibOpen] = useState(false);
  // what's being dragged right now → drives the drop-zone outlines
  const [dragKind, setDragKind] = useState<'shape' | 'library' | 'widget' | null>(null);
  useEffect(() => {
    seedDefaultWidgets();
    setWidgets(loadWidgets());
    setLibrary(loadLibrary());
    const f = () => { setWidgets(loadWidgets()); setLibrary(loadLibrary()); };
    window.addEventListener(WEVENT, f);
    return () => window.removeEventListener(WEVENT, f);
  }, []);

  const createFromShape = (type: Widget['viz']['type'], atWidgetId?: string) => {
    const idx = atWidgetId ? loadWidgets().findIndex((x) => x.id === atWidgetId) : undefined;
    const created = saveWidget(placeholderFor(type), idx); // lands exactly where dropped; default = end
    onEdit(created);
  };

  const createFromScratch = () => {
    const created = saveWidget({
      title: 'New widget',
      source: { metric: 'events', patient: null, patientLabel: 'All patients', days: 14, granularity: 'day' },
      viz: { type: 'bar' }, expanded: false, size: 'm', unconfigured: true,
    });
    onEdit(created);
  };

  const addFromLibrary = (libId: string, atWidgetId?: string) => {
    const it = loadLibrary().find((x) => x.id === libId);
    if (!it) return;
    const idx = atWidgetId ? loadWidgets().findIndex((x) => x.id === atWidgetId) : undefined;
    saveWidget({ title: it.title, source: it.source, viz: it.viz, expanded: false, size: 'm' }, idx);
  };

  return (
    <div>
      {/* shape palette — visual templates you DRAG onto the grid */}
      <div className="mb-2 flex flex-wrap items-end gap-2.5">
        {/* create from scratch — describe it, the AI picks the right shape */}
        <div onClick={() => createFromScratch()} title="Describe any widget — the AI builds it" className="group cursor-pointer select-none">
          <div className="flex h-14 w-24 items-center justify-center rounded-xl border-2 border-dashed border-terra/50 bg-terra-soft/20 text-terra transition-all group-hover:-translate-y-0.5 group-hover:bg-terra-soft/50">
            <span className="font-serif text-2xl font-semibold leading-none">+</span>
          </div>
          <div className="mt-1 text-center text-[10.5px] font-medium text-terra-deep">Ask AI</div>
        </div>
        {SHAPES.map((s) => (
          <div
            key={s.type}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData('text/widget-shape', s.type); setDragKind('shape'); }}
            onDragEnd={() => setDragKind(null)}
            onClick={() => createFromShape(s.type)}
            title={`${s.hint} — click to add, or drag it where you want it`}
            className="group cursor-pointer select-none active:cursor-grabbing"
          >
            <div className="h-14 w-24 rounded-xl border border-line bg-card p-1.5 shadow-[0_1px_2px_rgba(28,26,20,0.05)] transition-all group-hover:-translate-y-0.5 group-hover:border-terra group-hover:shadow-[0_3px_8px_rgba(28,26,20,0.1)]">
              <ShapeThumb type={s.type} />
            </div>
            <div className="mt-1 text-center text-[10.5px] text-ink3">{s.label}</div>
          </div>
        ))}
        <span className="flex-1" />
        <button
          onClick={() => setLibOpen((v) => !v)}
          className={`mb-1 flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] transition-colors ${
            libOpen ? 'border-terra bg-terra-soft text-terra-deep' : 'border-line bg-card text-ink3 hover:border-terra'
          }`}
        >
          <BookOpen size={12} /> Library
        </button>
      </div>
      {libOpen && (
        <div className="mb-3 rounded-2xl border border-line bg-card p-3">
          <p className="mb-2 text-[11px] text-ink4">every widget you’ve made — drag one back onto the grid (or click)</p>
          <div className="flex flex-wrap gap-2">
            {library.map((it) => (
              <div
                key={it.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/widget-library', it.id); setDragKind('library'); }}
                onDragEnd={() => setDragKind(null)}
                onClick={() => addFromLibrary(it.id)}
                title="drag onto the grid, or click to add"
                className="group relative cursor-grab rounded-xl border border-line bg-paper py-2 pl-3 pr-7 transition-colors hover:border-terra hover:bg-terra-soft/40 active:cursor-grabbing"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Permanently delete “${it.title}” from your library?\n\nWidgets already on the dashboard are not affected.`)) {
                      removeFromLibrary(it.id);
                    }
                  }}
                  title="Delete from library (permanent)"
                  className="absolute right-1.5 top-1.5 rounded-full p-0.5 text-ink4 opacity-0 transition-opacity hover:bg-terra-soft hover:text-terra group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
                <div className="max-w-44 truncate text-[12px] font-medium text-ink2">{it.title}</div>
                <div className="text-[10.5px] text-ink4">{it.source.patientLabel || 'All patients'} · {it.source.days >= 3650 ? 'all time' : `${it.source.days}d`} · {it.viz.type}</div>
              </div>
            ))}
            {library.length === 0 && <p className="text-[12px] text-ink4">nothing here yet</p>}
          </div>
        </div>
      )}
      <p className="mb-3 text-[11px] text-ink4">
        click a template to add it, or drag it exactly where you want it · drag cards to rearrange
      </p>
      {/* the WHOLE canvas is the drop zone — not just the grid box */}
      <div
        className={`min-h-[55vh] rounded-2xl transition-all ${
          dragKind === 'shape' || dragKind === 'library'
            ? 'outline-dashed outline-2 outline-offset-4 outline-terra/50 bg-terra-soft/10'
            : ''
        }`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('text/widget-shape') || e.dataTransfer.types.includes('text/widget-library')) e.preventDefault();
        }}
        onDrop={(e) => {
          const shape = e.dataTransfer.getData('text/widget-shape');
          const lib = e.dataTransfer.getData('text/widget-library');
          if (shape) { e.preventDefault(); createFromShape(shape as Widget['viz']['type']); }
          else if (lib) { e.preventDefault(); addFromLibrary(lib); }
          setDragKind(null);
        }}
      >
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {widgets.map((w) => (
            <WidgetCard
              key={w.id} w={w} onEdit={onEdit}
              dragKind={dragKind}
              onDragKind={setDragKind}
              onShapeDrop={(shape) => createFromShape(shape, w.id)}
              onLibraryDrop={(libId) => addFromLibrary(libId, w.id)}
            />
          ))}
          {/* explicit landing slot while dragging (drops before/after cards work too) */}
          {(dragKind === 'shape' || dragKind === 'library') && (
            <div className="col-span-1 flex min-h-28 items-center justify-center rounded-2xl border-2 border-dashed border-terra/60 bg-terra-soft/30 text-[12px] font-medium text-terra-deep">
              drop here
            </div>
          )}
        </div>
        {widgets.length === 0 && dragKind === null && (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-line bg-card/40 px-4 py-8 text-center text-[13px] text-ink4">
            Click or drag a template above to get started
          </p>
        )}
      </div>
    </div>
  );
}


/* ── the side chat drawer: configure/edit a widget in plain language ──────
 * Pops out on the RIGHT of the dashboard when a shape is dropped or a
 * widget's chat icon is pressed. Own mini-conversation; every completed
 * designWidget spec applies to the widget IN PLACE — the grid is the preview. */
export function WidgetConfigChat({
  widget, onClose, hidden = false, finishWhenClosed = false, onFinished, scope, scopeLabel,
}: {
  widget: Widget;
  onClose: () => void;
  hidden?: boolean;          // visually hidden but MOUNTED — builds keep running
  finishWhenClosed?: boolean; // user pressed done: unmount once idle
  onFinished?: () => void;
  scope?: string;            // person chip: hard-scopes the build to this patient
  scopeLabel?: string;
}) {
  const specRef = useRef<any>({ title: widget.title, source: widget.source, viz: widget.viz, fresh: widget.unconfigured === true });
  const [title, setTitle] = useState(widget.title);
  const { messages, sendMessage, status } = useChat({ id: `cfg-${widget.id}`, transport: new DefaultChatTransport({ api: '/api/insight/chat' }) });
  const [input, setInput] = useState('');
  const appliedRef = useRef<Set<string>>(new Set());
  const busy = status === 'submitted' || status === 'streaming';
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  // apply each completed spec the moment it exists — the widget on the grid
  // updates live, which IS the preview
  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return;
    const dws = (last.parts as any[]).filter(
      (p: any) => p.type === 'tool-designWidget' && p.state === 'output-available',
    );
    if (!dws.length) return;
    const key = `${last.id}:${dws.length - 1}`;
    if (appliedRef.current.has(key)) return;
    const spec = dws[dws.length - 1]?.input;
    if (!spec?.source) return;
    appliedRef.current.add(key);
    // chip-scoped Explore: a spec without an explicit patient belongs to the
    // selected person — otherwise the finished widget would be filtered away
    const src = scope && !spec.source?.patient
      ? { ...spec.source, patient: scope, patientLabel: scopeLabel ?? spec.source?.patientLabel }
      : spec.source;
    specRef.current = { title: spec.title, source: src, viz: spec.viz, fresh: false };
    setTitle(spec.title);
    // a shape change can invalidate the current size (e.g. bar→heatmap on a small card)
    updateWidget(widget.id, { ...specRef.current, size: clampSize(spec.viz.type, widget.size), unconfigured: false });
  }, [messages, widget.id]);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const autoResize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const line = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    const max = line * 5; // 5 lines, then scroll
    ta.style.height = `${Math.min(ta.scrollHeight, max)}px`;
    ta.style.overflowY = ta.scrollHeight > max ? 'auto' : 'hidden';
  };

  // user closed the drawer: stay alive until the in-flight build finishes,
  // then let the page unmount us
  useEffect(() => {
    if (!finishWhenClosed || busy) return;
    const t = setTimeout(() => onFinished?.(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishWhenClosed, busy]);

  const send = () => {
    if (!input.trim() || busy) return;
    sendMessage({ text: input }, { body: { patient: scope ?? null, editingWidget: specRef.current } });
    setInput('');
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) { ta.style.height = 'auto'; ta.style.overflowY = 'hidden'; }
    });
  };

  return (
    <aside className={`h-full w-[360px] shrink-0 flex-col border-l border-line bg-card ${hidden ? 'hidden' : 'flex'}`}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <MessageCircle size={14} className="shrink-0 text-terra" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-[14px] font-semibold text-ink">{title}</div>
          <div className="text-[10.5px] text-ink4">changes apply to the widget live</div>
        </div>
        <button onClick={onClose} title="Done" className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink3 hover:border-terra">
          done
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="rounded-xl bg-card-alt/60 p-3 text-[12.5px] leading-relaxed text-ink3">
            Describe what this should show, in plain language.
            <div className="mt-1.5 text-[11.5px] text-ink4">
              e.g. “Maggie’s activity, weekly” · “wandering and falls as ‘Safety’ for Aryaman” · “how many times Joe left the room this month”
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
            {m.role === 'user' ? (
              <div className="max-w-[90%] rounded-2xl rounded-br-md bg-action px-3 py-1.5 text-[12.5px] text-terra-ink">
                {(m.parts as any[]).map((p: any, i: number) => (p.type === 'text' ? <span key={i}>{p.text}</span> : null))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {(m.parts as any[]).map((p: any, i: number) => {
                  if (p.type === 'text' && p.text.trim())
                    return <p key={i} className="text-[12.5px] leading-relaxed text-ink2">{p.text}</p>;
                  if (p.type === 'tool-designWidget' && p.state === 'output-available')
                    return (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-[10.5px] font-medium text-sage">
                        ✓ widget updated
                      </span>
                    );
                  if (p.type === 'tool-askUser' && (p.state === 'input-available' || p.state === 'output-available'))
                    return (
                      <div key={i} className="rounded-xl border border-line bg-paper p-2.5">
                        <p className="mb-2 text-[12.5px] text-ink2">{p.input?.question}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(p.input?.options ?? []).map((opt: string) => (
                            <button
                              key={opt}
                              onClick={() => {
                                if (busy) return;
                                sendMessage({ text: opt }, { body: { patient: scope ?? null, editingWidget: specRef.current } });
                              }}
                              className="rounded-full border border-line bg-card px-2.5 py-1 text-[12px] text-ink2 transition-colors hover:border-terra hover:bg-terra-soft"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  if (String(p.type).startsWith('tool-') && (p.state === 'input-available' || p.state === 'input-streaming'))
                    return (
                      <span key={i} className="flex items-center gap-1.5 text-[11px] text-ink4">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terra" /> working…
                      </span>
                    );
                  return null;
                })}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <span className="flex items-center gap-1.5 text-[11px] text-ink4">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terra" /> building…
          </span>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-paper p-1.5 pl-3">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={1}
            placeholder="what should this show?"
            className="flex-1 resize-none overflow-y-hidden bg-transparent text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink4"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-action text-terra-ink disabled:opacity-30"
            aria-label="Send"
          >
            <ArrowUp size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
