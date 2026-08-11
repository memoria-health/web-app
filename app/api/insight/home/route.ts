import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { insightFetch, InsightAuthError } from '@/lib/insight/backend';

export const maxDuration = 30;

/* The FAMILY home view: one glanceable status, a written briefing, streaks,
 * and a plain-language feed. Everything here is an ANSWER, not a chart.
 *
 * Data now arrives as ONE authenticated backend call
 * (GET /v1/insights/home-data — raw rows, caregiver-scoped server-side);
 * every line of composition below (status verdict, streaks, wake math,
 * humanizing, the LLM briefing) is unchanged from the direct-SQL version,
 * so the view reads identically.
 *
 * Real data: status, streaks, wake time, the feed.
 * Preview data: sleep / night wakings / active time — feasible to compute
 * (state-machine over presence + the motion pipeline) but not collected yet;
 * returned with preview:true so the UI labels them honestly. */

type HomeData = {
  patient: { id: string; full_name: string; preferred_name: string | null };
  cameras: { total: number; online: number };
  recent: { title: string; occurred_at: string; reviewed: boolean; serious: boolean }[];
  last_fall_at: string | null;
  event_nights: string[];
  feed: { title: string; narrative: string | null; occurred_at: string; room: string | null }[];
  wakes: { day: string; wake: number | null }[];
};

/* "Fall Detection" / "Possible Fall" → a calm human sentence fragment */
function humanize(title: string, room: string | null) {
  const t = title.replace(/possible /i, '').replace(/ detection| detected/i, '').trim().toLowerCase();
  const where = room ? ` in the ${room.toLowerCase()}` : '';
  if (/fall/.test(t)) return `We noticed what looked like a fall${where}`;
  if (/chok/.test(t)) return `We noticed possible choking${where}`;
  if (/wander|door|exit/.test(t)) return `Activity near the door${where}`;
  if (/self recovery|recover/.test(t)) return `She got back up on her own${where}`;
  return `We noticed ${t}${where}`;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}
function fmtHour(h: number) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  const d = new Date(Date.UTC(2000, 0, 1, hh, mm));
  return fmtTime(d);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const patient = url.searchParams.get('patient');

  try {
    let data: HomeData;
    try {
      data = await insightFetch<HomeData>(
        `/v1/insights/home-data${patient ? `?patient_id=${patient}` : ''}`);
    } catch (e: any) {
      if (e instanceof InsightAuthError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      if (Number(e?.status) === 404) {
        // covers both "no patients" and a foreign patient id (non-disclosing)
        return NextResponse.json({ error: patient ? 'forbidden' : 'no patients' }, { status: patient ? 403 : 404 });
      }
      throw e;
    }

    const p = data.patient;
    const name = p.preferred_name || p.full_name;

    /* ── status: three states, ever ── */
    const recent = data.recent;
    const seriousRecent = recent.find((r) => r.serious && Date.now() - new Date(r.occurred_at).getTime() < 3 * 3600_000);
    const unreviewed = recent.filter((r) => !r.reviewed);
    const cams = data.cameras;
    let status: { level: 'green' | 'amber' | 'red'; line: string; sub: string };
    if (seriousRecent) {
      status = { level: 'red', line: `Something needs your attention`, sub: `${humanize(seriousRecent.title, null)} at ${fmtTime(new Date(seriousRecent.occurred_at))} — tap the moment below to review it` };
    } else if (cams.total > 0 && cams.online === 0) {
      // NEVER claim "all quiet" while blind — that's false reassurance
      status = { level: 'amber', line: `The cameras are offline`, sub: `we can’t check in on ${name} right now — the cameras may be unplugged or the internet may be down` };
    } else if (unreviewed.length > 0) {
      status = { level: 'amber', line: `One thing to look at`, sub: `${unreviewed.length === 1 ? 'A moment from the last day hasn’t been reviewed yet' : `${unreviewed.length} moments from the last day haven’t been reviewed yet`} — nothing urgent` };
    } else {
      status = { level: 'green', line: `All quiet at ${name}’s`, sub: recent.length ? `everything from the last day has been reviewed` : `nothing unusual in the last day` };
    }
    const camsSub = cams.total ? `${cams.online} of ${cams.total} camera${cams.total === 1 ? '' : 's'} watching` : 'no cameras set up yet';

    /* ── streaks ── */
    const lastFall = data.last_fall_at ? Math.floor((Date.now() - new Date(data.last_fall_at).getTime()) / 86_400_000) : null;
    const eventNights = new Set(data.event_nights.map((n) => n.slice(0, 10)));
    let quietNights = 0;
    for (let i = 1; i <= 60; i++) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      if (eventNights.has(d)) break;
      quietNights++;
    }
    const streaks = [
      lastFall != null
        ? { value: lastFall, label: lastFall === 1 ? 'day since a fall' : 'days without a fall' }
        : { value: '—', label: 'no falls ever recorded' },
      { value: quietNights >= 60 ? '60+' : quietNights, label: quietNights === 1 ? 'quiet night in a row' : 'quiet nights in a row' },
    ];

    /* ── wake time: today vs her usual ── */
    const wakes = data.wakes.filter((r) => r.wake != null);
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayWake = wakes.find((r) => r.day.slice(0, 10) === todayKey)?.wake ?? null;
    const priorWakes = wakes.filter((r) => r.day.slice(0, 10) !== todayKey).map((r) => Number(r.wake));
    const typicalWake = priorWakes.length ? priorWakes.reduce((s, w) => s + w, 0) / priorWakes.length : null;
    const wake = todayWake != null
      ? {
          time: fmtHour(Number(todayWake)),
          note: typicalWake != null
            ? Math.abs(Number(todayWake) - typicalWake) < 0.75 ? 'typical for her' : Number(todayWake) > typicalWake ? `later than her usual ${fmtHour(typicalWake)}` : `earlier than her usual ${fmtHour(typicalWake)}`
            : null,
        }
      : typicalWake != null
        ? { time: null, note: `she’s usually up around ${fmtHour(typicalWake)}` }
        : null;

    /* ── the feed: newest first, grouped client-side ── */
    const feed = data.feed.map((r) => ({
      at: r.occurred_at,
      time: fmtTime(new Date(r.occurred_at)),
      day: String(new Date(r.occurred_at).toISOString().slice(0, 10)),
      text: humanize(r.title, r.room),
      detail: r.narrative || null,
      night: (() => { const h = new Date(r.occurred_at).getUTCHours(); return h >= 22 || h < 6; })(),
      serious: /fall|chok|stroke|heart|seizure/i.test(r.title),
    }));

    /* ── previews: feasible-but-not-collected, so the family view shows its
     * eventual shape. Values are ILLUSTRATIVE and labeled as such. ── */
    const preview = [
      { label: 'Sleep last night', value: '7h 40m', note: 'in bed 10:42 PM – 7:15 AM' },
      { label: 'Times up last night', value: '1', note: 'brief — back to bed in 4 min' },
      { label: 'Active time today', value: '2h 10m', note: 'moving around the house' },
    ];

    /* ── the briefing: 2–3 warm, factual sentences. Data-descriptive ONLY.
     * ?fast=1 skips the LLM so the verdict/streaks/feed paint instantly;
     * the client fetches the prose separately via /api/briefing. ── */
    const facts = {
      name,
      status: status.level,
      wokeToday: wake?.time ?? null,
      wakeNote: wake?.note ?? null,
      daysSinceLastFall: lastFall,
      quietNightsInARow: quietNights,
      momentsLast24h: recent.length,
      latestMoments: feed.slice(0, 5).map((f) => `${f.day} ${f.time}: ${f.text}`),
    };
    const fast = url.searchParams.get('fast') === '1';
    let briefing: string | null = null;
    if (!fast) try {
      const r = await generateText({
        model: openai('gpt-5.4-mini'),
        prompt: `You write a 2–3 sentence check-in for the adult child of ${name}, an aging parent with in-home monitoring. Sound like a thoughtful human, not a report: warm, calm, plain English. Lead with the most reassuring true thing. STRICT RULES: use ONLY these facts — never invent numbers or moments; pick the 2–3 facts most worth saying and SKIP the rest (never enumerate everything, never mention zeros, nulls, or anything missing); NEVER use the words "status", "data", "recorded", "logged", or color levels; NEVER give health advice, clinical interpretation, or speculation about causes — describe only; no exclamation marks; refer to her as "${name}". Facts: ${JSON.stringify(facts)}`,
      });
      briefing = r.text.trim();
    } catch {
      // template fallback — the view must never depend on the LLM being up
      briefing = `${name} ${wake?.time ? `was up at ${wake.time}${wake.note ? ` — ${wake.note}` : ''}` : 'has had a quiet day so far'}. ${lastFall != null ? `It’s been ${lastFall} days since her last fall` : 'No falls have ever been recorded'}, and she’s had ${quietNights} quiet night${quietNights === 1 ? '' : 's'} in a row.`;
    }

    const res = NextResponse.json({
      patient: { id: p.id, name },
      status: { ...status, camsSub },
      briefing,
      facts, // for /api/briefing — keeps the prose consistent with what's shown
      streaks,
      wake,
      feed,
      preview,
    });
    // fast path is CDN-cacheable: same answer for every viewer of a patient
    if (fast) res.headers.set('Cache-Control', 'private, max-age=30'); // tenant-scoped — never shared-cache
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
