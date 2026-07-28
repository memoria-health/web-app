import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { scopeIds, scopedPatients } from '@/lib/insight/scope';

/* Live data engine for widgets. Takes a widget SOURCE (query params, never
 * data) over the read-only connection.
 * Capabilities: time series (day/week) · breakdown by type · by room · by
 * hour-of-day · by weekday · heatmap (dow×hour) · previous-period overlay ·
 * patient vs patient · rolling trend · activity overlay · baseline band ·
 * ratios · days-since-last · presence · wake/bed routine · review status ·
 * patients×types matrix · clip gallery. days=3650 ⇒ "all time". */

let _pool: Pool | null = null;
function pool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL ?? '';
    _pool = new Pool({
      connectionString: url,
      // prod DB has max_connections=60 shared with Realtime + the backend —
      // transaction-mode pooler (:6543) + tiny pool + fast idle shed keep this
      // dashboard from ever pinning backends (it froze mobile sign-in once)
      max: 2,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
      ssl: /127\.0\.0\.1|localhost/.test(url) ? undefined : { rejectUnauthorized: false },
    });
  }
  return _pool;
}

const NIGHT = `(extract(hour from occurred_at) >= 22 or extract(hour from occurred_at) < 6)`;
const KIND = `initcap(trim(replace(replace(title, 'Possible ', ''), 'possible ', '')))`;
const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function termClause(n: number) {
  return `($${n}::text is null or title ilike '%'||$${n}||'%' or narrative ilike '%'||$${n}||'%' or category::text ilike '%'||$${n}||'%')`;
}
function termsFilter(terms: string[], alias = '') {
  if (!terms.length) return 'true';
  const a = alias ? alias + '.' : '';
  const esc = (t: string) => String(t).replace(/[^\w\s-]/g, '');
  return '(' + terms.map((t) => `(${a}title ilike '%${esc(t)}%' or ${a}narrative ilike '%${esc(t)}%' or ${a}category::text ilike '%${esc(t)}%')`).join(' or ') + ')';
}

async function termSeries(patient: string[], term: string | null, days: number, gran: string, night: boolean, offsetDays = 0) {
  const { rows } = await pool().query(
    `select to_char(date_trunc($4, occurred_at)::date, 'YYYY-MM-DD') as bucket, count(*)::int as n
     from events
     where patient_id = any($1::uuid[])
       and occurred_at >= now() - (($2::int + $5::int) || ' days')::interval
       and occurred_at <  now() - ($5::int || ' days')::interval
       and ${termClause(3)}
       ${night ? `and ${NIGHT}` : ''}
     group by 1 order by 1`,
    [patient, days, term, gran, offsetDays],
  );
  return rows as { bucket: string; n: number }[];
}

async function combinedSeries(patient: string[], terms: string[], days: number, gran: string, night: boolean, offsetDays = 0) {
  const { rows } = await pool().query(
    `select to_char(date_trunc($3, occurred_at)::date, 'YYYY-MM-DD') as bucket, count(*)::int as n
     from events
     where patient_id = any($1::uuid[])
       and occurred_at >= now() - (($2::int + $4::int) || ' days')::interval
       and occurred_at <  now() - ($4::int || ' days')::interval
       and ${termsFilter(terms)}
       ${night ? `and ${NIGHT}` : ''}
     group by 1 order by 1`,
    [patient, days, gran, offsetDays],
  );
  return rows as { bucket: string; n: number }[];
}

async function categorical(patient: string[], terms: string[], days: number, night: boolean, bucketExpr: string, joinCameras = false) {
  const { rows } = await pool().query(
    `select ${bucketExpr} as t, count(*)::int as n
     from events e ${joinCameras ? 'left join cameras c on c.id = e.camera_id' : ''}
     where e.patient_id = any($1::uuid[])
       and occurred_at >= now() - ($2 || ' days')::interval
       and ${termsFilter(terms, 'e')}
       ${night ? `and ${NIGHT}` : ''}
     group by 1 order by n desc limit 24`,
    [patient, days],
  );
  return rows as { t: string; n: number }[];
}

const seriesRows = (rows: { t: string; n: number }[]) => rows.map((r) => ({ bucket: r.t, events: r.n }));

/* Fill EVERY bucket in the window so the temporal axis is honest:
 * counts get 0 (no events IS zero); measurements (activity/presence) get null
 * (no monitoring is a gap, not a zero). For all-time windows (>=365d) we fill
 * from the first data point instead of 10 years of emptiness. */
function fillBuckets(rows: any[], terms: string[], days: number, gran: 'day' | 'week', mode: 'zero' | 'null', offsetDays = 0) {
  const DAY = 86_400_000;
  const step = gran === 'week' ? 7 * DAY : DAY;
  const trunc = (d: Date) => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    if (gran === 'week') {
      const dow = (x.getUTCDay() + 6) % 7; // Monday-start, matches PG date_trunc
      x.setUTCDate(x.getUTCDate() - dow);
    }
    return x;
  };
  const key = (t: number) => new Date(t).toISOString().slice(0, 10);
  const have = new Map(rows.map((r) => [String(r.bucket), r]));
  let startMs: number;
  if (days >= 365 && offsetDays === 0) {
    if (!rows.length) return rows;
    startMs = new Date(String(rows[0].bucket) + 'T00:00:00Z').getTime();
  } else {
    startMs = trunc(new Date(Date.now() - (offsetDays + days - 1) * DAY)).getTime();
  }
  const endMs = trunc(new Date(Date.now() - offsetDays * DAY)).getTime();
  const out: any[] = [];
  for (let t = startMs; t <= endMs; t += step) {
    const k = key(t);
    out.push(have.get(k) ?? { bucket: k, ...Object.fromEntries(terms.map((tm) => [tm, mode === 'zero' ? 0 : null])) });
  }
  return out;
}

function addRolling(rows: any[], key: string, win: number) {
  return rows.map((r, i) => {
    const slice = rows.slice(Math.max(0, i - win + 1), i + 1);
    const avg = slice.reduce((s, x) => s + (Number(x[key]) || 0), 0) / slice.length;
    return { ...r, trend: Math.round(avg * 10) / 10 };
  });
}
function bandOf(vals: number[]) {
  if (!vals.length) return null;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length);
  return { avg: Math.round(avg * 10) / 10, lo: Math.max(0, Math.round((avg - sd) * 10) / 10), hi: Math.round((avg + sd) * 10) / 10 };
}

/* GET with the source encoded in the query string → CDN-cacheable. Widget
 * data is shared analytics (same answer for every viewer), so the edge cache
 * absorbs the 2-minute auto-refresh: most refreshes never reach a lambda or
 * the database. 60s fresh + 4min stale-while-revalidate. */
export async function GET(req: Request) {
  try {
    const s = new URL(req.url).searchParams.get('s');
    const res = await run(s ? JSON.parse(s) : null);
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=240');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const { source } = await req.json();
  return run(source);
}

async function run(source: any) {
  try {
    /* TENANT SCOPING — before any SQL. The read role sees every patient, so
     * the caregiver's session decides what this request may touch: explicit
     * patient must be theirs; "all patients" = THEIR patients only. */
    const allowed = await scopedPatients();
    if (!allowed) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const {
      metric, patient: rawPatient = null, terms: rawTerms = [], days = 14, granularity = 'day', night = false,
    } = source ?? {};
    let patient: string[];
    try { patient = scopeIds(allowed, rawPatient); } catch { return NextResponse.json({ error: 'forbidden' }, { status: 403 }); }
    const terms: string[] = (rawTerms ?? []).filter(Boolean).slice(0, 8);
    const gran = granularity === 'week' ? 'week' : 'day';
    const d = Math.min(3650, Math.max(1, Number(days) || 14)); // 3650 = all time

    /* ── activity ─────────────────────────────────────────────────────── */
    if (metric === 'activity') {
      if (source?.byHour) {
        const { rows } = await pool().query(
          `select extract(hour from captured_at)::int as h,
                  round(100.0 * avg((motion_in_clip and people_present)::int))::int as n
           from analyses
           where patient_id = any($1::uuid[])
             and captured_at >= now() - ($2 || ' days')::interval
           group by 1 order by 1`,
          [patient, d],
        );
        const by = new Map(rows.map((r) => [Number(r.h), r.n]));
        return NextResponse.json({
          kind: 'series', categorical: true, unit: '%', terms: ['activity'],
          rows: Array.from({ length: 24 }, (_, h) => ({ bucket: `${String(h).padStart(2, '0')}:00`, activity: by.get(h) ?? 0 })),
        });
      }
      const q = (offset: number) =>
        pool().query(
          `select to_char(date_trunc($3, captured_at)::date, 'YYYY-MM-DD') as bucket,
                  round(100.0 * avg((motion_in_clip and people_present)::int))::int as n
           from analyses
           where patient_id = any($1::uuid[])
             and captured_at >= now() - (($2::int + $4::int) || ' days')::interval
             and captured_at <  now() - ($4::int || ' days')::interval
           group by 1 order by 1`,
          [patient, d, gran, offset],
        );
      const [cur, prev] = await Promise.all([q(0), q(d)]);
      const avg = (rs: any[]) => (rs.length ? Math.round(rs.reduce((s, r) => s + r.n, 0) / rs.length) : 0);
      let rows = fillBuckets(cur.rows.map((r) => ({ bucket: r.bucket, activity: r.n })), ['activity'], d, gran as any, 'null') as any[];
      if (Number(source?.rolling) > 1) rows = addRolling(rows.filter((x) => x.activity != null), 'activity', Number(source.rolling));
      return NextResponse.json({
        kind: 'series', unit: '%', terms: ['activity'], rows,
        statValue: `${avg(cur.rows)}%`, prevValue: avg(prev.rows),
        ...(source?.baseline ? { baseline: bandOf(prev.rows.map((r: any) => r.n)) } : {}),
        ...(source?.threshold != null ? { threshold: Number(source.threshold) } : {}),
      });
    }

    if (metric === 'coverage') {
      const { rows } = await pool().query(
        `select coalesce(c.room, 'Camera') as camera, c.online,
                (select count(distinct date_trunc('hour', a.captured_at))::int from analyses a
                 where a.camera_id = c.id and a.captured_at >= now() - ($2 || ' days')::interval) as hours
         from cameras c where not c.disabled and c.patient_id = any($1::uuid[])
         order by hours desc limit 12`,
        [patient, d],
      );
      const total = d * 24;
      const cams = rows.map((r) => ({ camera: r.camera + (r.online ? '' : ' (offline)'), uptimePct: Math.round((1000 * r.hours) / total) / 10 }));
      const avgPct = cams.length ? Math.round((cams.reduce((s, c) => s + c.uptimePct, 0) / cams.length) * 10) / 10 : null;
      return NextResponse.json({
        kind: 'cameras', cameras: cams,
        statValue: avgPct != null ? `${avgPct}%` : undefined,
        subtitle: avgPct != null ? `average coverage across ${cams.length} cameras` : undefined,
      });
    }

    if (metric === 'offline') {
      const { rows } = await pool().query(
        `select coalesce(c.room, 'Camera') as room, p.full_name as patient,
                to_char(coalesce(c.last_seen_at, c.created_at), 'Mon DD HH24:MI') as last_seen
         from cameras c join patients p on p.id = c.patient_id
         where not c.disabled and not c.online and c.patient_id = any($1::uuid[])
         order by c.last_seen_at desc nulls last limit 40`,
        [patient],
      );
      return NextResponse.json({ kind: 'offline', statValue: String(rows.length), cameras: rows });
    }

    if (metric === 'timeline') {
      const { rows } = await pool().query(
        `select to_char(occurred_at, 'YYYY-MM-DD HH24:MI') as ts,
                to_char(occurred_at::date, 'YYYY-MM-DD') as date,
                category::text as type, title, nullif(narrative,'') as detail,
                case when has_clip then clip_storage_key end as "clipKey",
                p.preferred_name as who
         from events e join patients p on p.id = e.patient_id
         where e.patient_id = any($1::uuid[])
           and occurred_at >= now() - ($2 || ' days')::interval
           and ${termsFilter(terms, 'e')}
           ${night ? `and ${NIGHT}` : ''}
         order by occurred_at desc limit 40`,
        [patient, d],
      );
      return NextResponse.json({ kind: 'events', events: rows });
    }

    if (metric === 'leaderboard') {
      const { rows } = await pool().query(
        `select p.id, p.full_name as patient, count(e.id)::int as events
         from patients p left join events e on e.patient_id = p.id
           and e.occurred_at >= now() - ($1 || ' days')::interval
           ${night ? `and ${NIGHT}` : ''}
         where p.id = any($2::uuid[])
         group by p.id order by events desc limit 10`,
        [d, patient],
      );
      const ranking = rows.filter((r) => r.events > 0).map((r) => ({ ...r, byCategory: {} }));
      return NextResponse.json({ kind: 'leaderboard', ranking, statValue: String(ranking.reduce((s, r) => s + r.events, 0)) });
    }

    if (metric === 'daysSince') {
      const { rows } = await pool().query(
        `select occurred_at, ${KIND} as t from events
         where patient_id = any($1::uuid[]) and ${termsFilter(terms)}
           ${night ? `and ${NIGHT}` : ''}
         order by occurred_at desc limit 500`,
        [patient],
      );
      if (!rows.length)
        return NextResponse.json({ kind: 'series', rows: [], statValue: null, unavailable: 'no matching events have ever been recorded' });
      const last = new Date(rows[0].occurred_at);
      const daysSince = Math.floor((Date.now() - last.getTime()) / 86_400_000);
      let longest = 0;
      for (let i = 0; i < rows.length - 1; i++) {
        const gap = (new Date(rows[i].occurred_at).getTime() - new Date(rows[i + 1].occurred_at).getTime()) / 86_400_000;
        if (gap > longest) longest = gap;
      }
      return NextResponse.json({
        kind: 'series', rows: [], statValue: String(daysSince),
        subtitle: `days since the last ${rows[0].t} (${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}) · longest gap ${Math.round(longest)}d`,
      });
    }

    if (metric === 'presence') {
      const { rows } = await pool().query(
        `select to_char(date_trunc($3, captured_at)::date, 'YYYY-MM-DD') as bucket,
                round(100.0 * avg(people_present::int))::int as n
         from analyses
         where patient_id = any($1::uuid[])
           and captured_at >= now() - ($2 || ' days')::interval
         group by 1 order by 1`,
        [patient, d, gran],
      );
      return NextResponse.json({
        kind: 'series', unit: '%', terms: ['presence'],
        rows: fillBuckets(rows.map((r) => ({ bucket: r.bucket, presence: r.n })), ['presence'], d, gran as any, 'null'),
        statValue: rows.length ? `${Math.round(rows.reduce((s, r) => s + r.n, 0) / rows.length)}%` : null,
        subtitle: 'share of monitored windows with someone visible',
      });
    }

    if (metric === 'routine') {
      const { rows } = await pool().query(
        `select to_char(captured_at::date, 'YYYY-MM-DD') as bucket,
                min(extract(hour from captured_at) + extract(minute from captured_at)/60.0) filter (where people_present) as wake,
                max(extract(hour from captured_at) + extract(minute from captured_at)/60.0) filter (where people_present) as bed
         from analyses
         where patient_id = any($1::uuid[])
           and captured_at >= now() - ($2 || ' days')::interval
         group by 1 order by 1`,
        [patient, d],
      );
      const rs = rows.filter((r) => r.wake != null).map((r) => ({ bucket: r.bucket, wake: Math.round(r.wake * 10) / 10, bed: Math.round(r.bed * 10) / 10 }));
      return NextResponse.json({ kind: 'series', terms: ['wake', 'bed'], unit: 'h', rows: rs });
    }

    if (metric === 'reviews') {
      const { rows } = await pool().query(
        `select case when not reviewed then 'Unreviewed' else initcap(coalesce(nullif(review_choice::text,''), 'reviewed')) end as t,
                count(*)::int as n
         from events
         where patient_id = any($1::uuid[])
           and occurred_at >= now() - ($2 || ' days')::interval
           and ${termsFilter(terms)}
         group by 1 order by n desc`,
        [patient, d],
      );
      const unrev = rows.find((r) => r.t === 'Unreviewed')?.n ?? 0;
      return NextResponse.json({
        kind: 'series', categorical: true, terms: ['events'], rows: seriesRows(rows),
        statValue: String(unrev), subtitle: 'alerts not yet reviewed',
      });
    }

    if (metric === 'matrix') {
      const { rows } = await pool().query(
        `select p.preferred_name as patient, ${KIND} as t, count(*)::int as n
         from events e join patients p on p.id = e.patient_id
         where occurred_at >= now() - ($1 || ' days')::interval
           and p.id = any($2::uuid[])
         group by 1, 2`,
        [d, patient],
      );
      const typeTotals = new Map<string, number>();
      const patTotals = new Map<string, number>();
      rows.forEach((r) => {
        typeTotals.set(r.t, (typeTotals.get(r.t) ?? 0) + r.n);
        patTotals.set(r.patient, (patTotals.get(r.patient) ?? 0) + r.n);
      });
      const cols = [...typeTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
      const pats = [...patTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p]) => p);
      return NextResponse.json({
        kind: 'matrix', cols,
        rowsM: pats.map((pt) => ({ patient: pt, cells: cols.map((t) => rows.find((r) => r.patient === pt && r.t === t)?.n ?? 0) })),
      });
    }

    if (metric === 'clips') {
      const { rows } = await pool().query(
        `select title, to_char(occurred_at, 'Mon DD HH24:MI') as ts, clip_storage_key as "clipKey",
                p.preferred_name as who
         from events e join patients p on p.id = e.patient_id
         where has_clip and clip_storage_key is not null
           and e.patient_id = any($1::uuid[])
           and occurred_at >= now() - ($2 || ' days')::interval
           and ${termsFilter(terms, 'e')}
           ${night ? `and ${NIGHT}` : ''}
         order by occurred_at desc limit 8`,
        [patient, d],
      );
      return NextResponse.json({ kind: 'clips', items: rows });
    }

    /* ── events (workhorse) ───────────────────────────────────────────── */
    if (source?.ratio === 'nightsWith' || source?.ratio === 'daysWith') {
      const isNight = source.ratio === 'nightsWith';
      const q = (offset: number) =>
        pool().query(
          `select count(distinct occurred_at::date)::int as n from events
           where patient_id = any($1::uuid[])
             and occurred_at >= now() - (($2::int + $3::int) || ' days')::interval
             and occurred_at <  now() - ($3::int || ' days')::interval
             and ${termsFilter(terms)} ${isNight ? `and ${NIGHT}` : ''}`,
          [patient, d, offset],
        );
      const [cur, prev] = await Promise.all([q(0), q(d)]);
      const pct = (n: number) => Math.round((100 * n) / d);
      return NextResponse.json({
        kind: 'series', rows: [],
        statValue: `${pct(cur.rows[0].n)}%`, prevValue: pct(prev.rows[0].n),
        subtitle: `${isNight ? 'nights' : 'days'} with a matching event (${cur.rows[0].n} of ${d})`,
      });
    }
    if (source?.breakdown) {
      const rows = await categorical(patient, terms, d, night, KIND);
      return NextResponse.json({ kind: 'series', categorical: true, terms: ['events'], rows: seriesRows(rows), statValue: String(rows.reduce((s, r) => s + r.n, 0)) });
    }
    if (source?.byRoom) {
      const rows = await categorical(patient, terms, d, night, `coalesce(c.room, 'Unknown room')`, true);
      return NextResponse.json({ kind: 'series', categorical: true, terms: ['events'], rows: seriesRows(rows), statValue: String(rows.reduce((s, r) => s + r.n, 0)) });
    }
    if (source?.byHour) {
      const rows = await categorical(patient, terms, d, night, `to_char(occurred_at, 'HH24":00"')`);
      const by = new Map(rows.map((r) => [r.t, r.n]));
      return NextResponse.json({
        kind: 'series', categorical: true, terms: ['events'],
        rows: Array.from({ length: 24 }, (_, h) => {
          const k = `${String(h).padStart(2, '0')}:00`;
          return { bucket: k, events: by.get(k) ?? 0 };
        }),
        statValue: String(rows.reduce((s, r) => s + r.n, 0)),
      });
    }
    if (source?.byDow) {
      const rows = await categorical(patient, terms, d, night, `extract(isodow from occurred_at)::int::text`);
      const by = new Map(rows.map((r) => [Number(r.t), r.n]));
      return NextResponse.json({
        kind: 'series', categorical: true, terms: ['events'],
        rows: DOWS.map((lbl, i) => ({ bucket: lbl, events: by.get(i + 1) ?? 0 })),
        statValue: String(rows.reduce((s, r) => s + r.n, 0)),
      });
    }
    if (source?.heatmap) {
      const { rows } = await pool().query(
        `select extract(isodow from occurred_at)::int as dow, extract(hour from occurred_at)::int as h, count(*)::int as n
         from events
         where patient_id = any($1::uuid[])
           and occurred_at >= now() - ($2 || ' days')::interval
           and ${termsFilter(terms)}
         group by 1, 2`,
        [patient, d],
      );
      return NextResponse.json({ kind: 'heatmap', dows: DOWS, cells: rows, statValue: String(rows.reduce((s, r) => s + r.n, 0)) });
    }
    if (source?.compareWith) {
      const [a, b2] = await Promise.all([
        combinedSeries(patient, terms, d, gran, night),
        combinedSeries(scopeIds(allowed, source.compareWith), terms, d, gran, night),
      ]);
      const la = source.patientLabel || 'A';
      const lb = source.compareWithLabel || 'B';
      const af = fillBuckets(a.map((r) => ({ bucket: r.bucket, [la]: r.n })), [la], d, gran as any, 'zero');
      const bf = new Map(fillBuckets(b2.map((r) => ({ bucket: r.bucket, [lb]: r.n })), [lb], d, gran as any, 'zero').map((r: any) => [r.bucket, r[lb]]));
      const rows = af.map((r: any) => ({ ...r, [lb]: bf.get(r.bucket) ?? 0 }));
      return NextResponse.json({ kind: 'series', terms: [la, lb], rows });
    }
    if (source?.comparePrev) {
      const [cur, prev] = await Promise.all([
        combinedSeries(patient, terms, d, gran, night, 0),
        combinedSeries(patient, terms, d, gran, night, d),
      ]);
      const cf = fillBuckets(cur.map((r) => ({ bucket: r.bucket, current: r.n })), ['current'], d, gran as any, 'zero');
      const pf = fillBuckets(prev.map((r) => ({ bucket: r.bucket, previous: r.n })), ['previous'], d, gran as any, 'zero', d);
      const rows = cf.map((r, i) => ({ ...r, previous: pf[i]?.previous ?? 0 }));
      return NextResponse.json({ kind: 'series', terms: ['current', 'previous'], rows });
    }

    const activeTerms = terms.length ? terms : [null];
    const [curAll, prevAll] = await Promise.all([
      Promise.all(activeTerms.map((t) => termSeries(patient, t, d, gran, night, 0))),
      Promise.all(activeTerms.map((t) => termSeries(patient, t, d, gran, night, d))),
    ]);
    const names = terms.length ? terms : ['events'];
    const byBucket = new Map<string, Record<string, string | number>>();
    names.forEach((t, i) => {
      for (const r of curAll[i]) {
        const row = byBucket.get(r.bucket) ?? { bucket: r.bucket };
        row[t] = r.n;
        byBucket.set(r.bucket, row);
      }
    });
    let rows = [...byBucket.values()].sort((a, b) => String(a.bucket).localeCompare(String(b.bucket))) as any[];
    rows = fillBuckets(rows, names, d, gran as any, 'zero');
    if (Number(source?.rolling) > 1 && names.length === 1) rows = addRolling(rows, names[0], Number(source.rolling));
    if (source?.overlay === 'activity') {
      const { rows: act } = await pool().query(
        `select to_char(date_trunc($3, captured_at)::date, 'YYYY-MM-DD') as bucket,
                round(100.0 * avg((motion_in_clip and people_present)::int))::int as n
         from analyses
         where patient_id = any($1::uuid[])
           and captured_at >= now() - ($2 || ' days')::interval
         group by 1`,
        [patient, d, gran],
      );
      const am = new Map(act.map((r) => [r.bucket, r.n]));
      rows = rows.map((r) => ({ ...r, activityPct: am.get(String(r.bucket)) ?? null }));
    }
    const sum = (arr: { n: number }[][]) => arr.flat().reduce((s, r) => s + r.n, 0);
    return NextResponse.json({
      kind: 'series', terms: names, rows,
      statValue: String(sum(curAll)), prevValue: sum(prevAll),
      ...(source?.baseline ? { baseline: bandOf(prevAll.flat().map((r) => r.n)) } : {}),
      ...(source?.threshold != null ? { threshold: Number(source.threshold) } : {}),
      ...(source?.overlay === 'activity' ? { hasOverlay: true } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
