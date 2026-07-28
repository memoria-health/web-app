/* Real data layer — reads whichever DB `DATABASE_URL` points at, ALWAYS through
 * a read-only role (writes fail at the Postgres level):
 *   - worktree v2 Supabase (127.0.0.1:54362) via `insight_readonly`
 *     (SELECT-only + default_transaction_read_only=on), or
 *   - PROD Supabase via `nemara_readonly` (SELECT-only + BYPASSRLS — the same
 *     role nemara-cost uses; verified: UPDATE/DELETE → permission denied).
 * Swap targets by flipping the commented DATABASE_URL lines in .env.local.
 *
 * Tool shapes match lib/demo-data.ts exactly — the UI can't tell them apart.
 * In a production build these become caregiver-scoped queries behind RLS. */

import { Pool } from 'pg';

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
      // remote (Supabase pooler) needs SSL; local supabase does not
      ssl: /127\.0\.0\.1|localhost/.test(url) ? undefined : { rejectUnauthorized: false },
    });
  }
  return _pool;
}

export async function listPatients(tenant: string[]) {
  const { rows } = await pool().query(`
    select p.id, p.full_name as name, p.preferred_name as preferred,
           coalesce(json_agg(json_build_object('room', c.room, 'online', c.online)
                    ) filter (where c.id is not null), '[]') as cams
    from patients p
    left join cameras c on c.patient_id = p.id and not c.disabled
    where p.id = any($1::uuid[])
    group by p.id order by p.full_name`, [tenant]);
  return rows.map((r) => ({
    id: r.id, // names are NOT unique (prod has two patients with identical names)
    name: r.name,
    preferred: r.preferred,
    room: [...new Set(r.cams.map((c: any) => c.room).filter(Boolean))].join(' + ') || '—',
    cameras: r.cams.map((c: any) => `${c.room ?? 'Camera'}${c.online ? '' : ' (offline)'}`),
  }));
}

/* Deterministic ranking: exact name beats prefix beats substring, shorter name
 * beats longer — so "Joey" resolves to the patient named Joey, never an
 * arbitrary "Joey Banms" (the old LIMIT 1 had NO ordering: Postgres picked
 * whichever row it liked, silently ignoring the caregiver's choice). */
export async function resolvePatientMatches(nameOrId: string, tenant: string[], limit = 4) {
  const q = nameOrId.trim();
  const { rows } = await pool().query(
    `select p.id, p.full_name, p.preferred_name,
            (lower(p.full_name) = lower($1) or lower(coalesce(p.preferred_name, '')) = lower($1)) as exact,
            coalesce((select string_agg(distinct c.room, ' + ') from cameras c
                      where c.patient_id = p.id and not c.disabled), '') as rooms
     from patients p
     where (p.preferred_name ilike $1 or p.full_name ilike '%' || $1 || '%' or p.id::text = $1)
       and p.id = any($3::uuid[])
     order by (lower(p.full_name) = lower($1) or lower(coalesce(p.preferred_name, '')) = lower($1)) desc,
              (p.full_name ilike $1 || '%') desc,
              length(p.full_name) asc
     limit $2`,
    [q, limit, tenant],
  );
  return rows;
}

export async function resolvePatient(nameOrId: string, tenant: string[]) {
  const m = await resolvePatientMatches(nameOrId, tenant, 1);
  return m[0] ?? null;
}

export async function knownPatientNames(tenant: string[]): Promise<string> {
  const { rows } = await pool().query('select full_name from patients where id = any($1::uuid[]) order by full_name', [tenant]);
  return rows.map((r) => r.full_name).join(', ');
}

/* Activity index: % of analysis windows that day with motion while someone was
 * present — a simple, defensible per-day activity proxy from the detector data. */
export async function getActivityTrend(patientId: string, days: number) {
  const { rows } = await pool().query(
    `select to_char(captured_at::date, 'YYYY-MM-DD') as date,
            round(100.0 * avg((motion_in_clip and people_present)::int)) as activity,
            count(*) as windows
     from analyses
     where patient_id = $1 and captured_at >= now() - ($2 || ' days')::interval
     group by 1 order by 1`,
    [patientId, days],
  );
  return rows.map((r) => ({ date: r.date, activity: Number(r.activity), windows: Number(r.windows) }));
}

export async function getDetectionCounts(patientId: string, days: number, type?: string) {
  const { rows } = await pool().query(
    `select to_char(occurred_at::date, 'YYYY-MM-DD') as date, category, count(*) as n
     from events
     where patient_id = $1 and occurred_at >= now() - ($2 || ' days')::interval
       and ($3::text is null or category::text = $3)
     group by 1, 2 order by 1`,
    [patientId, days, type ?? null],
  );
  const types: string[] = [...new Set(rows.map((r) => String(r.category)))];
  const byDate = new Map<string, Record<string, string | number>>();
  for (const r of rows) {
    const row = byDate.get(r.date) ?? { date: r.date as string };
    row[String(r.category)] = Number(r.n);
    byDate.set(r.date, row);
  }
  return { types, rows: [...byDate.values()] };
}

/* "Uptime" = monitoring coverage: fraction of hours in the window where the
 * camera produced at least one analysis. Gaps ⇒ offline stretches. */
export async function getUptime(patientId: string, days: number) {
  const { rows } = await pool().query(
    `select c.id, coalesce(c.room, 'Camera ' || left(c.id::text, 4)) as camera, c.online,
            (select array_agg(distinct date_trunc('hour', a.captured_at) order by date_trunc('hour', a.captured_at))
             from analyses a
             where a.camera_id = c.id and a.captured_at >= now() - ($2 || ' days')::interval) as hours
     from cameras c where c.patient_id = $1 and not c.disabled`,
    [patientId, days],
  );
  const totalHours = days * 24;
  return rows.map((r) => {
    const hours: Date[] = (r.hours ?? []).map((h: string) => new Date(h));
    let gaps = 0;
    let longestGapH = 0;
    for (let i = 1; i < hours.length; i++) {
      const dh = (hours[i].getTime() - hours[i - 1].getTime()) / 3_600_000;
      if (dh > 1.5) {
        gaps++;
        longestGapH = Math.max(longestGapH, dh);
      }
    }
    return {
      camera: r.camera + (r.online ? '' : ' (offline now)'),
      uptimePct: Math.round((1000 * hours.length) / totalHours) / 10,
      offlineEvents: gaps,
      longestOfflineMin: Math.round(longestGapH * 60),
    };
  });
}

/* Cross-patient ranking in ONE query — without this, "which patient had the
 * most events?" makes the model fan out N per-patient calls. */
export async function getEventLeaderboard(days: number, tenant: string[], patientId?: string) {
  const { rows } = await pool().query(
    `select p.id, p.full_name as patient, count(e.id)::int as events,
            coalesce(json_object_agg(e.category, cnt.n) filter (where e.category is not null), '{}') as by_category
     from patients p
     left join events e on e.patient_id = p.id
       and e.occurred_at >= now() - ($1 || ' days')::interval
     left join lateral (
       select count(*)::int n from events e2
       where e2.patient_id = p.id and e2.category = e.category
         and e2.occurred_at >= now() - ($1 || ' days')::interval
     ) cnt on true
     where ($2::uuid is null or p.id = $2) and p.id = any($3::uuid[])
     group by p.id order by events desc
     limit 12`,
    [days, patientId ?? null, tenant],
  );
  return rows.map((r) => ({
    id: r.id,
    patient: r.patient,
    events: r.events,
    byCategory: r.by_category as Record<string, number>,
  }));
}

export async function getEventTimeline(patientId: string, days: number, filter?: string) {
  // `filter` matches the event KIND wherever it lives (title/narrative/category)
  // — prod's `category` is only safety|routine, the kind is in the title.
  const { rows } = await pool().query(
    `select to_char(occurred_at, 'YYYY-MM-DD HH24:MI') as ts,
            to_char(occurred_at::date, 'YYYY-MM-DD') as date,
            category as type,
            title,
            nullif(narrative, '') as detail,
            case when has_clip then clip_storage_key end as "clipKey"
     from events
     where patient_id = $1 and occurred_at >= now() - ($2 || ' days')::interval
       and ($3::text is null or title ilike '%'||$3||'%' or narrative ilike '%'||$3||'%' or category::text ilike '%'||$3||'%')
     order by occurred_at desc limit 40`,
    [patientId, days, filter ?? null],
  );
  return rows;
}

/* ── Dashboard: deterministic trend facts (no LLM — computed SQL, narrated by
 * fixed templates; the grounding rule applied to the dashboard) ─────────── */
export async function getTrendFacts(tenant: string[], patientId?: string) {
  const p = patientId ?? null;
  const [events, nights, activity, offline] = await Promise.all([
    pool().query(
      `select count(*) filter (where occurred_at >= now() - interval '7 days')::int as cur,
              count(*) filter (where occurred_at >= now() - interval '14 days'
                           and occurred_at <  now() - interval '7 days')::int as prev
       from events where ($1::uuid is null or patient_id = $1) and patient_id = any($2::uuid[])`, [p, tenant]),
    pool().query(
      `select count(*) filter (where occurred_at >= now() - interval '7 days')::int as cur,
              count(*) filter (where occurred_at >= now() - interval '14 days'
                           and occurred_at <  now() - interval '7 days')::int as prev
       from events
       where ($1::uuid is null or patient_id = $1) and patient_id = any($2::uuid[])
         and (extract(hour from occurred_at) >= 22 or extract(hour from occurred_at) < 6)`, [p, tenant]),
    pool().query(
      `select round(100.0 * avg((motion_in_clip and people_present)::int)
                filter (where captured_at >= now() - interval '7 days')) as cur,
              round(100.0 * avg((motion_in_clip and people_present)::int)
                filter (where captured_at >= now() - interval '14 days'
                    and captured_at <  now() - interval '7 days')) as prev
       from analyses where ($1::uuid is null or patient_id = $1) and patient_id = any($2::uuid[])`, [p, tenant]),
    pool().query(
      `select count(*)::int as n from cameras
       where not disabled and not online and ($1::uuid is null or patient_id = $1) and patient_id = any($2::uuid[])`, [p, tenant]),
  ]);
  return {
    events: { cur: events.rows[0].cur, prev: events.rows[0].prev },
    nightEvents: { cur: nights.rows[0].cur, prev: nights.rows[0].prev },
    activity: { cur: Number(activity.rows[0].cur ?? 0), prev: Number(activity.rows[0].prev ?? 0) },
    offlineCameras: offline.rows[0].n,
  };
}

/* busiest patient (most events, 30d) — the default dashboard subject when no
 * patient is scoped */
export async function busiestPatient(tenant: string[]) {
  const { rows } = await pool().query(
    `select p.id, p.full_name, p.preferred_name, count(e.id) as n
     from patients p join events e on e.patient_id = p.id
     where e.occurred_at >= now() - interval '30 days' and p.id = any($1::uuid[])
     group by p.id order by n desc limit 1`, [tenant]);
  return rows[0] ?? null;
}

/* which cameras are offline right now (dashboard drill-down) */
export async function offlineCameraList(tenant: string[], patientId?: string) {
  const { rows } = await pool().query(
    `select coalesce(c.room, 'Camera') as room, p.full_name as patient,
            to_char(coalesce(c.last_seen_at, c.created_at), 'Mon DD HH24:MI') as last_seen
     from cameras c join patients p on p.id = c.patient_id
     where not c.disabled and not c.online and ($1::uuid is null or c.patient_id = $1) and c.patient_id = any($2::uuid[])
     order by c.last_seen_at desc nulls last limit 40`, [patientId ?? null, tenant]);
  return rows;
}
