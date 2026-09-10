/* Insight data layer — same exports and shapes as the direct-Postgres
 * version it replaces, now backed by the backend's /v1/insights API
 * (2026-08-11). The UI and the chat tools can't tell.
 *
 * WHY: the old file connected to prod Postgres as `nemara_readonly`
 * (SELECT-only WITH BYPASSRLS) and re-implemented tenant isolation as
 * a WHERE clause in every query. One forgotten clause = a silent
 * cross-tenant read. Now the caregiver's own token rides every call
 * and the backend derives their patient set — the `tenant` parameters
 * below are kept for signature compatibility but deliberately unused:
 * nothing client-side decides scope anymore.
 *
 * Pure post-processing that used to live beside the SQL (patient-name
 * ranking, uptime gap math) stays here — it is presentation, and it
 * runs on rows the backend already scoped. */

import 'server-only';
import { insightFetch } from '@/lib/insight/backend';

type Cam = { room: string | null; online: boolean };
type InsightPatient = { id: string; name: string; preferred: string | null; cams: Cam[] };

async function fetchPatients(): Promise<InsightPatient[]> {
  return insightFetch<InsightPatient[]>('/v1/insights/patients');
}

export async function listPatients(_tenant: string[]) {
  const rows = await fetchPatients();
  return rows.map((r) => ({
    id: r.id, // names are NOT unique (prod has two patients with identical names)
    name: r.name,
    preferred: r.preferred,
    room: [...new Set(r.cams.map((c) => c.room).filter(Boolean))].join(' + ') || '—',
    cameras: r.cams.map((c) => `${c.room ?? 'Camera'}${c.online ? '' : ' (offline)'}`),
  }));
}

/* Deterministic ranking: exact name beats prefix beats substring, shorter name
 * beats longer — so "Joey" resolves to the patient named Joey, never an
 * arbitrary "Joey Banms". Ported from the SQL ORDER BY verbatim. */
export async function resolvePatientMatches(nameOrId: string, _tenant: string[], limit = 4) {
  const q = nameOrId.trim().toLowerCase();
  const rows = await fetchPatients();
  const matches = rows
    .filter((p) =>
      (p.preferred ?? '').toLowerCase() === q ||
      (p.preferred ?? '').toLowerCase().startsWith(q) ||
      p.name.toLowerCase().includes(q) ||
      p.id === nameOrId.trim())
    .map((p) => ({
      id: p.id,
      full_name: p.name,
      preferred_name: p.preferred,
      exact: p.name.toLowerCase() === q || (p.preferred ?? '').toLowerCase() === q,
      rooms: [...new Set(p.cams.map((c) => c.room).filter(Boolean))].join(' + '),
      _prefix: p.name.toLowerCase().startsWith(q),
    }))
    .sort((a, b) =>
      Number(b.exact) - Number(a.exact) ||
      Number(b._prefix) - Number(a._prefix) ||
      a.full_name.length - b.full_name.length)
    .slice(0, limit);
  return matches.map(({ _prefix, ...rest }) => rest);
}

export async function resolvePatient(nameOrId: string, tenant: string[]) {
  const m = await resolvePatientMatches(nameOrId, tenant, 1);
  return m[0] ?? null;
}

export async function knownPatientNames(_tenant: string[]): Promise<string> {
  const rows = await fetchPatients();
  return rows.map((r) => r.name).sort().join(', ');
}

/* Activity index: % of analysis windows that day with motion while someone was
 * present — a simple, defensible per-day activity proxy from the detector data. */
export async function getActivityTrend(patientId: string, days: number) {
  const rows = await insightFetch<{ date: string; activity: number; windows: number }[]>(
    `/v1/insights/activity-trend?patient_id=${patientId}&days=${days}`);
  return rows.map((r) => ({ date: r.date, activity: Number(r.activity), windows: Number(r.windows) }));
}

export async function getDetectionCounts(patientId: string, days: number, type?: string) {
  const qs = new URLSearchParams({ patient_id: patientId, days: String(days) });
  if (type) qs.set('type', type);
  return insightFetch<{ types: string[]; rows: Record<string, string | number>[] }>(
    `/v1/insights/detection-counts?${qs}`);
}

/* "Uptime" = monitoring coverage: fraction of hours in the window where the
 * camera produced at least one analysis. Gaps ⇒ offline stretches. */
export async function getUptime(patientId: string, days: number) {
  const rows = await insightFetch<{ camera: string; online: boolean; hours: string[] }[]>(
    `/v1/insights/uptime?patient_id=${patientId}&days=${days}`);
  const totalHours = days * 24;
  return rows.map((r) => {
    const hours = r.hours.map((h) => new Date(h));
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
export async function getEventLeaderboard(days: number, _tenant: string[], patientId?: string) {
  const qs = new URLSearchParams({ days: String(days) });
  if (patientId) qs.set('patient_id', patientId);
  return insightFetch<{ id: string; patient: string; events: number; byCategory: Record<string, number> }[]>(
    `/v1/insights/event-leaderboard?${qs}`);
}

export async function getEventTimeline(patientId: string, days: number, filter?: string) {
  const qs = new URLSearchParams({ patient_id: patientId, days: String(days) });
  if (filter) qs.set('filter', filter);
  return insightFetch<any[]>(`/v1/insights/event-timeline?${qs}`);
}

/* ── Dashboard: deterministic trend facts (no LLM — computed by the backend,
 * narrated by fixed templates; the grounding rule applied to the dashboard) ── */
export async function getTrendFacts(_tenant: string[], patientId?: string) {
  const qs = patientId ? `?patient_id=${patientId}` : '';
  return insightFetch<{
    events: { cur: number; prev: number };
    nightEvents: { cur: number; prev: number };
    activity: { cur: number; prev: number };
    offlineCameras: number;
  }>(`/v1/insights/trend-facts${qs}`);
}

/* busiest patient (most events, 30d) — the default dashboard subject when no
 * patient is scoped */
export async function busiestPatient(_tenant: string[]) {
  return insightFetch<{ id: string; full_name: string; preferred_name: string | null; n: number } | null>(
    '/v1/insights/busiest-patient');
}

/* which cameras are offline right now (dashboard drill-down) */
export async function offlineCameraList(_tenant: string[], patientId?: string) {
  const qs = patientId ? `?patient_id=${patientId}` : '';
  return insightFetch<{ room: string; patient: string; last_seen: string }[]>(
    `/v1/insights/offline-cameras${qs}`);
}
