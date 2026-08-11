import { NextResponse } from 'next/server';
import { insightFetch, InsightAuthError } from '@/lib/insight/backend';

/* Live data engine for widgets — now a thin authenticated proxy.
 *
 * The engine itself (time series · breakdowns · heatmap · previous-period
 * overlay · patient vs patient · rolling trend · baseline band · ratios ·
 * days-since-last · presence · routine · reviews · matrix · clips) lives in
 * the backend at POST /v1/insights/widget-data, ported query-for-query. The
 * caregiver's own session token rides the request and the backend derives
 * which patients it may touch — this file no longer holds SQL, a database
 * connection, or a tenant list. Widget SOURCE stays query-params-never-data.
 * days=3650 ⇒ "all time". */

async function run(source: unknown) {
  try {
    const data = await insightFetch<Record<string, unknown>>(
      '/v1/insights/widget-data',
      { method: 'POST', body: { source } },
    );
    return NextResponse.json(data);
  } catch (e: any) {
    if (e instanceof InsightAuthError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const status = Number(e?.status);
    if (status === 404) {
      // foreign / unknown patient — the backend does not disclose which
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const s = new URL(req.url).searchParams.get('s');
    const res = await run(s ? JSON.parse(s) : null);
    // PRIVATE cache only: responses are tenant-scoped — a shared (CDN)
    // cache would leak one caregiver's data into another's dashboard. The
    // browser still absorbs the 2-min auto-refresh per user.
    res.headers.set('Cache-Control', 'private, max-age=60');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const { source } = await req.json();
  return run(source);
}
