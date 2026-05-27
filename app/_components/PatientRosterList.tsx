'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  RealtimePostgresDeletePayload,
} from '@supabase/supabase-js';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { getBrowserNemara } from '@/lib/api/client';
import type { Patient } from '@/lib/api/types';

/// Roster view at /patients. Mirrors iOS RosterView. Realtime-subscribed
/// to the patients table so iOS-side adds/edits/deletes surface here
/// without a manual refresh.
export function PatientRosterList({ initial }: { initial: Patient[] }) {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>(initial);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setPatients(initial), [initial]);

  // Realtime: mirror iOS-driven changes into the local list.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void (async () => {
      const supa = await getAuthedBrowserSupabase();
      if (cancelled) return;
      const channel = supa
        .channel('roster:patients')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'patients' },
          (payload: RealtimePostgresInsertPayload<Patient>) => {
            const fresh = payload.new;
            setPatients((prev) => {
              if (prev.some((p) => p.id === fresh.id)) return prev;
              return [...prev, fresh].sort((a, b) =>
                a.preferred_name.localeCompare(b.preferred_name),
              );
            });
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'patients' },
          (payload: RealtimePostgresUpdatePayload<Patient>) => {
            const updated = payload.new;
            setPatients((prev) =>
              prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
            );
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'patients' },
          (payload: RealtimePostgresDeletePayload<Patient>) => {
            const removedId = payload.old.id;
            if (!removedId) return;
            setPatients((prev) => prev.filter((p) => p.id !== removedId));
          },
        )
        .subscribe();
      cleanup = () => {
        void supa.removeChannel(channel);
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  async function deletePatient(p: Patient) {
    const label = p.preferred_name || p.full_name;
    if (
      !confirm(
        `Delete patient "${label}"? Their cameras, detectors, and event history will all be removed. This cannot be undone.`,
      )
    )
      return;
    setRemoving(p.id);
    setError(null);
    try {
      await getBrowserNemara().deletePatient(p.id);
      setPatients((prev) => prev.filter((x) => x.id !== p.id));
      // Refresh so the layout-level patient session re-resolves (in
      // case the just-deleted patient was the selected one).
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep"
        >
          {error}
        </div>
      )}
      <ul className="divide-y divide-line rounded-lg border border-line bg-card overflow-hidden">
        {patients.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <Link
              href={`/patients/${p.id}`}
              className="flex min-w-0 flex-1 flex-col rounded -mx-1 px-1 hover:bg-paper-dim/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl text-ink">
                  {p.preferred_name || p.full_name}
                </span>
                <span className="font-mono text-xs text-ink4 tracking-wide capitalize">
                  {p.relation}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-ink4 tracking-wide">
                {p.full_name}
                {p.home_address ? ` · ${p.home_address}` : ''}
              </p>
            </Link>
            <Link
              href={`/patients/${p.id}`}
              className="rounded-md border border-line bg-card px-3 py-1.5 text-base text-ink2 hover:bg-paper-dim transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={() => deletePatient(p)}
              disabled={removing === p.id}
              className="rounded-md border border-line bg-card px-3 py-1.5 text-base text-ink2 hover:border-terra/40 hover:bg-terra-soft hover:text-terra-deep disabled:opacity-50 transition-colors"
            >
              {removing === p.id ? 'Deleting…' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
