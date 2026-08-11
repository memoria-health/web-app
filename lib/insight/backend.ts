import 'server-only';
import { getServerSession } from '@/lib/supabase/server';
import { env } from '@/lib/env';

/* Authenticated fetch against the backend's /v1/insights API.
 *
 * This file is the whole replacement for the old direct-Postgres pool:
 * the caregiver's own session token rides every request, and the
 * backend derives which patients that token may see — the same
 * authority the mobile app trusts. No DATABASE_URL, no readonly role,
 * no client-assembled tenant arrays. */

export class InsightAuthError extends Error {
  constructor() { super('no caregiver session'); }
}

export async function insightFetch<T>(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) throw new InsightAuthError();
  const r = await fetch(`${env.BACKEND_URL}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    cache: 'no-store',
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    const err = new Error(`insights ${path} -> ${r.status} ${detail.slice(0, 120)}`);
    (err as any).status = r.status;
    throw err;
  }
  return r.json() as Promise<T>;
}
