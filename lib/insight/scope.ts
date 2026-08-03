import 'server-only';
import { getServerSession } from '@/lib/supabase/server';
import { env } from '@/lib/env';

/* Tenant scoping for every insight API route.
 *
 * The insight data layer reads Postgres through `nemara_readonly`, which can
 * see EVERY patient — so scoping must happen here, before any SQL runs. The
 * caregiver's patient set comes from the backend's /v1/patients using their
 * own session token: the backend is the single authority on patient access
 * (the mobile app uses the same endpoint), so there is no RLS assumption and
 * no second source of truth. No session → null → routes return 401. */

export type ScopedPatient = { id: string; name: string; preferred: string };

export async function scopedPatients(): Promise<ScopedPatient[] | null> {
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) return null;
  const r = await fetch(`${env.BACKEND_URL}/v1/patients`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!r.ok) return null;
  const list: any[] = await r.json();
  return list.map((p) => ({
    id: String(p.id),
    name: p.full_name ?? '',
    preferred: p.preferred_name ?? p.full_name ?? '',
  }));
}

/* Resolve the effective patient-id array for a query: an explicit patient must
 * be one of the caregiver's own; "all patients" means THEIR patients, never
 * the whole table. Throws on foreign ids so routes fail closed. */
export function scopeIds(allowed: ScopedPatient[], explicit?: string | null): string[] {
  if (explicit) {
    if (!allowed.some((p) => p.id === explicit)) throw new ScopeError();
    return [explicit];
  }
  return allowed.map((p) => p.id);
}

export class ScopeError extends Error {
  constructor() { super('patient not in caregiver scope'); }
}
