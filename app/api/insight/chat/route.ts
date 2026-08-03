import { google } from '@ai-sdk/google';
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { z } from 'zod';
import * as db from '@/lib/insight/db';
import { scopedPatients } from '@/lib/insight/scope';

export const maxDuration = 60;

/* The curated-tools pattern: the model NEVER writes SQL — it picks one of these
 * fixed, typed functions and fills the args. Data comes from the LOCAL v2
 * worktree Supabase through a SELECT-only, transaction-read-only Postgres role
 * (see lib/db.ts) — writes are impossible at the DB level. In a production
 * build these become caregiver-scoped queries with RLS as the hard backstop.
 *
 * Patient scoping: when the UI's dropdown selects a patient, every tool is
 * HARD-scoped to them server-side (the model's `patient` arg is overridden) —
 * the same enforcement shape real caregiver auth will use. No selection =
 * cross-patient questions work freely. */

const patientArg = z.string().describe('Patient name (full or preferred), e.g. "Maggie"');
const daysArg = z.number().int().min(1).max(90).default(14).describe('How many days back to look');

async function resolveOrError(name: string, tenant: string[]) {
  const matches = await db.resolvePatientMatches(name, tenant);
  if (!matches.length)
    return { error: `Unknown patient "${name}". Patients: ${await db.knownPatientNames(tenant)}` } as const;
  if (matches.length === 1) return matches[0];
  // MULTIPLE matches: never auto-pick — even an exact "Joey" may not be who the
  // caregiver meant when a "Joey Banms" or "Joe" also exists. Names are for
  // humans; resolution retries must use the ID (ids can never be ambiguous —
  // this also breaks the clarification loop and handles identical-name twins).
  const listing = matches
    .map((m) => `${m.full_name}${m.rooms ? ` (${m.rooms})` : ''} [id:${m.id}]`)
    .join('; ');
  return {
    error:
      `AMBIGUOUS: "${name}" matches: ${listing}. Do NOT guess and do NOT render data. ` +
      `Ask the caregiver (askUser) using the human labels (name + room, NEVER the ids), ` +
      `then retry the tool passing the chosen patient's id as the patient argument.`,
  } as const;
}

function makeTools(scopedPatient: string | null, tenant: string[]) {
  const effective = (modelArg: string) => scopedPatient ?? modelArg;
  return {
    listPatients: tool({
      description: 'List the patients this caregiver can see, with their cameras.',
      inputSchema: z.object({}),
      execute: async () => db.listPatients(tenant),
    }),

    getActivityTrend: tool({
      description:
        'Daily activity index (0-100, % of monitored windows with motion while someone is present) for a patient over N days. Use for questions about activity, movement, energy, changes/trends.',
      inputSchema: z.object({ patient: patientArg, days: daysArg }),
      execute: async ({ patient, days }) => {
        const p = await resolveOrError(effective(patient), tenant);
        if ('error' in p) return p;
        return { patient: p.full_name, days, series: await db.getActivityTrend(p.id, days) };
      },
    }),

    getDetectionCounts: tool({
      description:
        'Daily counts of safety events by category (fall, medication, agitation, wandering, …) for a patient over N days. Optionally filter to one category.',
      inputSchema: z.object({ patient: patientArg, days: daysArg, type: z.string().optional() }),
      execute: async ({ patient, days, type }) => {
        const p = await resolveOrError(effective(patient), tenant);
        if ('error' in p) return p;
        return { patient: p.full_name, days, ...(await db.getDetectionCounts(p.id, days, type)) };
      },
    }),

    getUptime: tool({
      description:
        'Camera monitoring coverage/health for a patient over N days: % of hours covered, offline stretches, longest outage.',
      inputSchema: z.object({ patient: patientArg, days: daysArg }),
      execute: async ({ patient, days }) => {
        const p = await resolveOrError(effective(patient), tenant);
        if ('error' in p) return p;
        return { patient: p.full_name, days, cameras: await db.getUptime(p.id, days) };
      },
    }),

    getEventTimeline: tool({
      description:
        'Recent notable events for a patient as a timeline. VIEW CUSTOMIZATION: when the caregiver asks about a SPECIFIC kind of event (wandering, fall, seizure, medication…), set `filter` to show ONLY those events, or `highlight` to show ALL events with that kind visually emphasized (highlighted days + split chart). Prefer highlight when context matters, filter when they only want that kind. Leave both empty for a plain timeline.',
      inputSchema: z.object({
        patient: patientArg,
        days: daysArg,
        filter: z.string().optional().describe('show only events matching this term, e.g. "wandering"'),
        highlight: z.string().optional().describe('show all events but emphasize ones matching this term'),
      }),
      execute: async ({ patient, days, filter, highlight }) => {
        const p = await resolveOrError(effective(patient), tenant);
        if ('error' in p) return p;
        const events = await db.getEventTimeline(p.id, days, filter);
        return { patient: p.full_name, days, filter: filter ?? null, highlight: highlight ?? null, events };
      },
    }),

    askUser: tool({
      // No execute — the UI renders the options as tappable chips and the
      // conversation waits for the caregiver's choice (generative-UI clarification).
      description:
        'Ask the caregiver ONE short clarifying question with 2-5 tappable options. Use ONLY when the question is genuinely ambiguous — e.g. multiple patients match a name, or the metric/timeframe materially changes the answer. Never use it when a sensible default exists.',
      inputSchema: z.object({
        question: z.string().describe('the short clarifying question'),
        options: z.array(z.string()).min(2).max(5).describe('concrete answer choices'),
      }),
    }),

    designWidget: tool({
      description:
        'DESIGN A PERMANENT DASHBOARD WIDGET with the caregiver. Unlike renderView (a one-off answer), this is a LIVE, reusable tracker: you output only the QUERY (metric, patient, detection terms, window) — never data — and the UI renders a live preview the caregiver can iterate on ("make it weekly", "add falls", "call the group Serious"). Each call REPLACES the previous preview, so always output the complete spec. Use when they say track/widget/monitor/always see. Custom groups: multiple terms + a groupLabel combine into one series, expandable to per-term breakdown.',
      inputSchema: z.object({
        title: z.string().describe('widget title, e.g. "Serious events — Maggie"'),
        source: z.object({
          metric: z.enum(['events', 'activity', 'coverage', 'offline', 'timeline', 'leaderboard', 'daysSince', 'presence', 'reviews', 'routine', 'matrix', 'clips']),
          patient: z.string().nullable().describe('patient ID (from resolution) or null for all patients'),
          patientLabel: z.string().describe('display name, e.g. "Maggie" or "All patients"'),
          terms: z.array(z.string()).max(8).optional().describe('detection keywords, e.g. ["stroke","heart attack"]'),
          breakdown: z.boolean().optional().describe('events: one bar per EVENT TYPE ("by type", proportion, distribution)'),
          byRoom: z.boolean().optional().describe('events: one bar per ROOM ("where do falls happen")'),
          byHour: z.boolean().optional().describe('hour-of-day pattern 00-23 ("what time of day…", sundowning); also works for activity (typical-day profile)'),
          byDow: z.boolean().optional().describe('day-of-week pattern Mon-Sun ("are weekends worse")'),
          heatmap: z.boolean().optional().describe('events: weekday × hour grid — use with viz heatmap'),
          night: z.boolean().optional().describe('only 22:00-06:00 events'),
          comparePrev: z.boolean().optional().describe('overlay the previous period as a second series ("vs last week/month")'),
          compareWith: z.string().nullable().optional().describe('second patient ID for side-by-side comparison'),
          compareWithLabel: z.string().optional(),
          rolling: z.number().int().min(2).max(30).optional().describe('rolling-average window, e.g. 7 → adds a smooth trend line'),
          ratio: z.enum(['nightsWith', 'daysWith']).optional().describe('"% of nights/days with X" → use viz stat'),
          overlay: z.enum(['activity']).optional().describe('add the activity % line behind an events series ("do events spike when activity drops")'),
          baseline: z.boolean().optional().describe('typical-range band from the preceding period behind the series'),
          threshold: z.number().optional().describe('goal/alert line, e.g. 3 → "flag if above 3"'),
          groupLabel: z.string().optional().describe('name for the combined group, e.g. "Serious"'),
          days: z.number().int().min(1).max(3650).default(30).describe('3650 = all time'),
          granularity: z.enum(['day', 'week']).default('day'),
        }),
        viz: z.object({ type: z.enum(['bar', 'line', 'stat', 'pie', 'heatmap', 'calendar', 'timeline', 'leaderboard', 'cameras', 'matrix', 'clips']) }),
      }),
      // executes trivially so the model continues to a short confirmation text
      execute: async (spec) => ({ ok: true, title: spec.title }),
    }),

    renderView: tool({
      description:
        'COMPOSE A CUSTOM VIEW: after fetching data with the other tools, design the view that best answers the question — you choose the blocks, chart kind, series, grouping, and what to highlight. Data in the spec must come ONLY from tool results in this conversation (transform/derive it yourself; never invent). Use this whenever the question implies a specific lens (e.g. only wandering events; all events with wandering days highlighted; a day-vs-night comparison) instead of the generic cards. ALWAYS include a chart block when the data has a time dimension — even sparse data: a bar chart spanning the FULL window (include zero days via the series x values you choose, or use highlightX on the matching days) shows WHEN at a glance. Do not waste stats tiles on things the title already says (e.g. the timeframe).',
      inputSchema: z.object({
        title: z.string().describe('view title, e.g. "Wandering — Aryaman, last 30 days"'),
        blocks: z.array(
          z.object({
            type: z.enum(['chart', 'events', 'stats', 'text']),
            title: z.string().optional(),
            kind: z.enum(['bar', 'line']).optional().describe('chart only'),
            stacked: z.boolean().optional(),
            series: z
              .array(z.object({
                name: z.string(),
                color: z.string().optional().describe('hex; omit for defaults'),
                data: z.array(z.object({ x: z.string().describe('e.g. date YYYY-MM-DD'), y: z.number() })),
              }))
              .optional()
              .describe('chart only'),
            highlightX: z.array(z.string()).optional().describe('chart, single series: x values to emphasize (others muted)'),
            groups: z
              .array(z.object({
                date: z.string(),
                highlighted: z.boolean().optional().describe('tint + auto-expand this day'),
                events: z.array(z.object({ time: z.string().optional(), label: z.string(), detail: z.string().optional(), clipKey: z.string().optional().describe('pass through from the tool result so the caregiver can watch the incident clip') })),
              }))
              .optional()
              .describe('events block: day groups, collapsed unless highlighted'),
            items: z
              .array(z.object({ label: z.string(), value: z.string(), sub: z.string().optional() }))
              .optional()
              .describe('stats block'),
            text: z.string().optional(),
          }),
        ),
      }),
      // executes trivially so generation CONTINUES to the written summary
      execute: async (spec) => ({ rendered: true, blocks: spec.blocks.length }),
    }),

    getEventLeaderboard: tool({
      description:
        'CROSS-PATIENT ranking: total safety events per patient over N days, with per-category breakdown. Use for "which patient(s) had the most events / compare patients" — ONE call, never loop per patient.',
      inputSchema: z.object({ days: daysArg }),
      execute: async ({ days }) => {
        let scopeId: string | undefined;
        if (scopedPatient) {
          const p = await resolveOrError(scopedPatient, tenant);
          if ('error' in p) return p;
          scopeId = p.id;
        }
        return { days, ranking: await db.getEventLeaderboard(days, tenant, scopeId) };
      },
    }),
  };
}

const SYSTEM_BASE = `You are Memoria Insight, a warm, plain-spoken assistant for family
caregivers monitoring an elderly loved one at home.

HARD RULE — NO HEALTH OR CLINICAL CONTENT (never break this, even if asked):
- NEVER give health, medical, clinical, or wellness advice, suggestions, or
  recommendations of any kind.
- NEVER interpret data medically: no speculating what a pattern "could mean",
  "often points to", or "may indicate" about health, conditions, symptoms,
  cognition, sleep quality, or wellbeing. Do not name or allude to conditions.
- NEVER advise care actions (checking on someone, adjusting routines or
  medication, calling a doctor) — with ONE exception: purely technical/system
  suggestions are fine (e.g. "the camera has been offline — it may need to be
  reconnected").
- If asked for health interpretation or advice, say plainly that you can only
  report what the monitoring data shows, and that health questions belong with
  a qualified healthcare professional.
- You DESCRIBE data; you never interpret it medically.

Rules:
- ALWAYS answer data questions by calling a tool first. Never invent numbers —
  every figure you state must come from a tool result in this conversation.
- Call the FEWEST tools that answer the question — usually ONE data tool (plus
  renderView when composing). Do not explore unrelated metrics.
- After a tool returns, write a SHORT summary (2-4 sentences): what the data
  factually shows — levels, changes, timing, patterns. Descriptive only, per
  the hard rule above.
- The chart is rendered from the tool result automatically; do NOT describe the
  chart axes or repeat every number. Summarize the data, don't recite it.
- PREFER VISUAL ANSWERS: humans read graphs better than lists of numbers. When a
  question is about change, patterns, comparisons, or "over time", pick the tool
  whose card shows a chart (activity trend, detection counts, events timeline,
  leaderboard) rather than answering in prose.
- A BULLETED LIST OF NUMBERS IS A MISSED CHART: if your answer would contain
  several counts/categories/rankings (e.g. "1 fall, 7 choking, 7 agitation,
  3 wandering"), compose a renderView (bar chart of those counts + a short
  note) instead of prose bullets — even for follow-up questions reusing data
  already fetched in this conversation.
- If data is sparse or empty, say so plainly — never pad or invent.
- DESIGN THE VIEW TO THE QUESTION: the generic cards are for generic questions.
  When the question implies a specific lens (one kind of event, a comparison, a
  highlight, a custom grouping), fetch the data, REASON about what view answers
  it best, and compose it with renderView on the spot — e.g. "wandering events?"
  → only those events, or all events with wandering days highlighted. Every
  number in your spec must come from tool results — never invented. Time-based
  views MUST lead with a chart (humans read graphs first); lists and stats
  support the chart, not replace it.
- CLARIFY WHEN AMBIGUOUS: if several patients match a name, or the intent is
  genuinely unclear, call askUser with concrete options instead of guessing.
  Use it sparingly — never when a sensible default exists.
- CLARIFY BEFORE RENDERING: when a tool reports AMBIGUOUS, do not show data
  for a guessed patient and do not dump listPatients — go straight to askUser,
  and after the caregiver answers, use their EXACT choice as the patient arg.
  One timeframe per answer — don't render 7-day AND 30-day versions.
- REFINING VIEWS IS FINE — but only your LAST renderView call is shown to the
  caregiver. Each call must therefore be a complete, self-contained view (never
  a partial delta on an earlier one).
- WIDGET DESIGN: when the caregiver wants something PERMANENT/reusable (track,
  monitor, widget, "always see"), use designWidget, not renderView. Resolve the
  patient first (tools) so you can pass their ID. Iterate as they refine; each
  designWidget call replaces the preview. After the tool, confirm in ONE short
  sentence and remind them to press "Add to dashboard" when it looks right. When you
  retry after a clarification, pass the chosen patient's ID (from the AMBIGUOUS
  listing) as the patient argument — the caregiver's tapped label maps to it.
- STAY-IN-THE-LOOP (EVERY response, no exceptions): open your summary with a
  short clause saying exactly what you looked at and the window, e.g. "Looking
  at 14 days of motion data from Maggie's cameras…" or "From the safety events
  recorded this month…" — the caregiver must always know where the answer came
  from. A card also shows the technical provenance underneath; your clause is
  the human version of it.
- Tone: calm, human, reassuring but honest. Plain language, no jargon.`;

export async function POST(req: Request) {
  const {
    messages, patient, editingWidget,
  }: { messages: UIMessage[]; patient?: string | null; editingWidget?: any } = await req.json();
  /* TENANT SCOPING — every tool below can only ever touch the signed-in
   * caregiver's patients; the client-supplied patient id is validated by
   * resolving it WITHIN the tenant set. No session → 401. */
  const allowed = await scopedPatients();
  if (!allowed) return new Response('unauthorized', { status: 401 });
  const tenant = allowed.map((p) => p.id);
  // scope arrives as a patient ID (names are not unique in prod)
  let scoped: string | null = null;
  let scopedName = '';
  if (patient?.trim()) {
    const p = await db.resolvePatient(patient.trim(), tenant);
    if (p) {
      scoped = p.id;
      scopedName = p.full_name;
    }
  }

  const system = scoped
    ? `${SYSTEM_BASE}\n\nSCOPE: the caregiver has scoped this conversation to ${scopedName} using
the patient selector. Every tool call is locked to ${scopedName} server-side — answer all
questions about ${scopedName}. If the caregiver asks about a DIFFERENT patient or a
cross-patient comparison, tell them to switch the selector to "All patients" first.`
    : `${SYSTEM_BASE}\n\nSCOPE: no patient selected — questions may span patients. If no
patient is named in the question, call listPatients or default to the only patient.`;

  const editingBlock = editingWidget
    ? `\n\nEDITING A WIDGET: the caregiver is configuring this dashboard widget right now:\n${JSON.stringify(editingWidget)}\nEvery request in this conversation is about THIS widget. Respond by calling designWidget with the COMPLETE updated spec. RULES: (1) apply EVERY change the caregiver asks for — chart shape, window, granularity, patient, terms — their request always wins over the current values; (2) carry over the fields they did NOT mention exactly as they are; (3) resolve patient names to IDs via tools when needed; (4) CAPABILITY MAP — pick the right shape for the ask: "by type/proportion/distribution"→breakdown (viz bar or pie); "where"→byRoom; "what time of day/sundowning"→byHour; "which weekday"→byDow; "when exactly" both dims→heatmap+viz heatmap; "days since last X"→metric daysSince (viz stat); "% of nights/days with X"→ratio (viz stat); "vs last week/month"→comparePrev; "PatientA vs PatientB"→compareWith; "smooth/trend"→rolling 7; "against her usual"→baseline; "flag if over N"→threshold; "do events follow activity"→overlay activity; "unreviewed/confirmed alerts"→metric reviews; "when does she wake/sleep"→metric routine; "who's around / time with company"→metric presence; "calendar of days with X"→viz calendar; "latest clips of X"→metric clips; "all patients × types table"→metric matrix. If the ask maps to NOTHING here (e.g. meals, actual sleep quality, medication swallowed, visitors count), say plainly the data isn't collected and askUser to offer the nearest supported alternative — never fake it with an unrelated metric. (5) if the widget is FRESH (fresh:true in the spec), choose the chart shape that best fits the request unless the caregiver named one. (6) MANDATORY CLARIFICATION — FRESH widgets only: if the widget is FRESH (fresh:true) and the request does NOT state a time window — explicitly ("30 days") or implicitly ("this week", "last month") — you MUST call askUser FIRST (question: "How far back should this look?", options: ["7 days","30 days","90 days","All time"] (All time → days: 3650)) and WAIT; do not emit a spec until answered. Likewise askUser for the patient when none is set and the request doesn't name one. Only when both are known do you build. (7) EDITING AN ALREADY-CONFIGURED widget (fresh is NOT true): the current spec above already answers everything the caregiver didn't mention — reuse its days, patient, terms and filters VERBATIM and NEVER re-ask for them. Example: an all-time fall heatmap edited to "show the patient with the most falls" stays all-time (days: 3650) with NO time question — resolve the patient with tools and emit the spec directly. Only askUser when the request itself is ambiguous (two possible patients, contradictory asks). The widget is ALREADY on their dashboard and every spec you emit saves automatically — NEVER tell them to add, save, or pin it. After the tool call, confirm what changed in ONE short sentence.`
    : '';

  const result = streamText({
    model: google('gemini-3.6-flash'),
    system: system + editingBlock,
    messages: convertToModelMessages(messages),
    tools: makeTools(scoped, tenant),
    // keep going after tool results so the model writes the grounded summary
    stopWhen: stepCountIs(8),
  });
  return result.toUIMessageStreamResponse();
}
