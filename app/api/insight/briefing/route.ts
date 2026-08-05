import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { scopedPatients } from '@/lib/insight/scope';
import { BRIEFING_RATE_LIMIT, enforceRateLimit } from '@/lib/rateLimit';

export const maxDuration = 30;

/* Writes the Home briefing from facts the /api/home?fast=1 call already
 * computed — the page paints instantly and this prose fades in after.
 * Model rides the Vercel AI Gateway (billed to the Vercel account). */
export async function POST(req: Request) {
  /* Check auth HERE, not only in proxy.ts. This handler goes straight
   * from the request body to a paid model call, so if a future edit
   * adds a path to PUBLIC_PATHS or widens the proxy matcher, the route
   * silently becomes an open LLM proxy billed to us. The sibling chat
   * route already checks for itself; this one now matches. */
  const allowed = await scopedPatients();
  if (!allowed) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  /* Every call is a paid generation, so cap it per caregiver. */
  const limited = await enforceRateLimit(req, BRIEFING_RATE_LIMIT);
  if (limited) return limited;

  const { facts } = await req.json();
  const name = facts?.name ?? 'her';
  const PROMPT = (p: string) => p;
  const t0 = Date.now();
  let served = 'openai/gpt-5.4-mini';
  try {
    let text: string;
    const prompt = PROMPT(`You write a 2–3 sentence check-in for the adult child of ${name}, an aging parent with in-home monitoring. Sound like a thoughtful human, not a report: warm, calm, plain English. Lead with the most reassuring true thing. STRICT RULES: use ONLY these facts — never invent numbers or moments; pick the 2–3 facts most worth saying and SKIP the rest (never enumerate everything, never mention zeros, nulls, or anything missing); NEVER use the words "status", "data", "recorded", "logged", or color levels; NEVER give health advice, clinical interpretation, or speculation about causes — describe only; no exclamation marks; refer to her as "${name}". Facts: ${JSON.stringify(facts)}`);
    // gpt-5.4-mini on the company OpenAI key (same model the prod VLM backend
    // uses) — direct, no gateway. flash-lite only if OpenAI itself is down.
    try {
      const r = await generateText({ model: openai('gpt-5.4-mini'), prompt, maxRetries: 1, abortSignal: AbortSignal.timeout(8000) });
      text = r.text;
      served = 'gpt-5.4-mini';
    } catch {
      const r = await generateText({ model: google('gemini-3.1-flash-lite'), prompt, maxRetries: 1 });
      text = r.text;
      served = 'gemini-3.1-flash-lite';
    }
    return NextResponse.json({ briefing: text.trim(), served, ms: Date.now() - t0 });
  } catch (e: any) {
    if (process.env.NODE_ENV === 'development') console.error('briefing model error:', e?.message);
    const err = process.env.NODE_ENV === 'development' ? String(e?.message ?? e) : undefined;
    const lastFall = facts?.daysSinceLastFall;
    const quiet = facts?.quietNightsInARow ?? 0;
    return NextResponse.json({
      err,
      briefing: `${name} ${facts?.wokeToday ? `was up at ${facts.wokeToday}${facts.wakeNote ? ` — ${facts.wakeNote}` : ''}` : 'has had a quiet day so far'}. ${lastFall != null ? `It’s been ${lastFall} days since her last fall` : 'No falls have ever been recorded'}, and she’s had ${quiet} quiet night${quiet === 1 ? '' : 's'} in a row.`,
    });
  }
}
