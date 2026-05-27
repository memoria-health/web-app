'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  RealtimePostgresDeletePayload,
} from '@supabase/supabase-js';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { usePatients, useMaybePatient } from './PatientProvider';
import { cn } from '@/lib/utils/cn';

/// Header dropdown for switching between the caregiver's patients
/// and quick-access to add a new one. Mirrors the iOS RosterView's
/// patient list — keeping web parity so changes on either surface
/// reflect on the other within ~1s via Supabase Realtime.
///
/// Selection persists via the `selected_patient_id` cookie (written
/// by POST /api/select-patient). After writing the cookie we call
/// router.refresh() so the server components re-render with the
/// patient that's now selected.
///
/// Realtime: subscribes to the `patients` table. Any INSERT / UPDATE
/// / DELETE within the caregiver's scope (RLS filters on
/// `caregiver_id`) triggers router.refresh() so the dropdown stays
/// in sync with iOS-side additions and edits.
export function PatientSwitcher() {
  const router = useRouter();
  const patients = usePatients();
  const selected = useMaybePatient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  // Realtime: react to any patients-table change so the dropdown
  // never goes stale relative to iOS. router.refresh() re-runs the
  // server components, which re-resolves the patient list + selected
  // via patientSession() and re-hydrates the PatientProvider.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void (async () => {
      const supa = await getAuthedBrowserSupabase();
      if (cancelled) return;
      const channel = supa
        .channel('patient-switcher:patients')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'patients' },
          (_p: RealtimePostgresInsertPayload<unknown>) => {
            startTransition(() => router.refresh());
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'patients' },
          (_p: RealtimePostgresUpdatePayload<unknown>) => {
            startTransition(() => router.refresh());
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'patients' },
          (_p: RealtimePostgresDeletePayload<unknown>) => {
            startTransition(() => router.refresh());
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
  }, [router]);

  async function selectPatient(id: string) {
    if (selected?.id === id) {
      setOpen(false);
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch('/api/select-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: id }),
      });
      if (!res.ok) throw new Error(`select failed: ${res.status}`);
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      // Surface in console; UI doesn't currently render a fault
      // toast for this. Real failure is rare (cookie write).
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  if (patients.length === 0) {
    return (
      <Link
        href="/patients/new"
        className="rounded-md border border-action/30 bg-action px-3 py-1.5 text-sm font-semibold text-action-ink hover:bg-ink2 transition-colors"
      >
        + Add your first patient
      </Link>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-3 py-1.5 text-base text-ink hover:border-action/40 hover:bg-paper-dim transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="font-serif text-base">
          {selected?.preferred_name ?? selected?.full_name ?? 'Pick a patient'}
        </span>
        <span className="text-ink3">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[14rem] overflow-hidden rounded-md border border-line bg-card shadow-lg"
        >
          <ul className="max-h-72 overflow-y-auto">
            {patients.map((p) => {
              const active = selected?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => selectPatient(p.id)}
                    disabled={busyId === p.id}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-base transition-colors disabled:opacity-50',
                      active
                        ? 'bg-paper-dim text-ink'
                        : 'text-ink2 hover:bg-paper-dim',
                    )}
                  >
                    <span>
                      <span className="block font-serif text-base text-ink">
                        {p.preferred_name || p.full_name}
                      </span>
                      <span className="block font-mono text-xs text-ink4 capitalize">
                        {p.relation}
                      </span>
                    </span>
                    {active && <span className="text-action">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line">
            <Link
              href="/patients"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-ink2 hover:bg-paper-dim transition-colors"
            >
              Manage patients →
            </Link>
            <Link
              href="/patients/new"
              onClick={() => setOpen(false)}
              className="block border-t border-line px-3 py-2 text-sm font-semibold text-action hover:bg-paper-dim transition-colors"
            >
              + Add a patient
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
