'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import type { Patient, Region, Relation } from '@/lib/api/types';

const RELATIONS: Relation[] = [
  'parent',
  'spouse',
  'grandparent',
  'sibling',
  'client',
  'other',
];

// Data-residency region picker (patient onboarding only — region is
// immutable after creation). Maps a country label to the wire value.
const REGIONS: { value: Region; label: string }[] = [
  { value: 'US', label: 'United States' },
  { value: 'IN', label: 'India' },
];

/// Shared form for /patients/new and /patients/[id] edit. Mirrors the
/// fields collected by the iOS NewPatientView (full name, preferred
/// name, DOB, gender, relation, optional home address). Cameras-paused
/// is not edited here — that's a one-button toggle on the dashboard,
/// not a form field.
export function PatientForm({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: Patient;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [preferredName, setPreferredName] = useState(initial?.preferred_name ?? '');
  const [relation, setRelation] = useState<Relation>(initial?.relation ?? 'parent');
  const [dateOfBirth, setDateOfBirth] = useState(initial?.date_of_birth ?? '');
  const [gender, setGender] = useState(initial?.gender ?? '');
  const [homeAddress, setHomeAddress] = useState(initial?.home_address ?? '');
  // Data residency. Only set at creation (immutable server-side), so the
  // picker renders in create mode only; edit keeps the existing value.
  const [region, setRegion] = useState<Region>(initial?.region ?? 'US');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Mirror the iOS NewPatientView fallback: if preferred name is
      // empty, derive it from the first word of full name. Keeps
      // parity so server-side data looks the same regardless of which
      // client created the row.
      const pref =
        preferredName.trim().length === 0
          ? fullName.trim().split(/\s+/)[0] || fullName.trim()
          : preferredName.trim();

      const api = getBrowserNemara();
      if (mode === 'create') {
        const created = await api.createPatient({
          full_name: fullName.trim(),
          preferred_name: pref,
          relation,
          date_of_birth: dateOfBirth || undefined,
          gender: gender || undefined,
          home_address: homeAddress.trim() || undefined,
          region,
        });
        // Cookie write so the home-page redirect prefers the just-
        // created patient on subsequent root-loads. The drill-down
        // navigation below is what actually places the user in the
        // new patient's view immediately.
        void fetch('/api/select-patient', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id: created.id }),
        });
        router.replace(`/patients/${created.id}`);
        router.refresh();
      } else if (initial) {
        await api.updatePatient(initial.id, {
          full_name: fullName.trim(),
          preferred_name: pref,
          relation,
          date_of_birth: dateOfBirth || undefined,
          gender: gender || undefined,
          home_address: homeAddress.trim() || undefined,
        });
        router.replace(`/patients/${initial.id}/settings`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
          Full name
        </span>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="off"
          placeholder="Margaret O'Brien"
          className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
          Preferred name
        </span>
        <input
          type="text"
          value={preferredName}
          onChange={(e) => setPreferredName(e.target.value)}
          autoComplete="off"
          placeholder="Maggie"
          className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
        />
        <span className="text-xs text-ink4">
          What the people who love them actually call them. Leave blank to use the first word of the full name.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
          Relation
        </span>
        <select
          value={relation}
          onChange={(e) => setRelation(e.target.value as Relation)}
          className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none capitalize"
        >
          {RELATIONS.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>
      </label>

      {mode === 'create' && (
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
            Region
          </span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as Region)}
            className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink4">
            Where this person&apos;s data is stored. Set once at onboarding and
            can&apos;t be changed later.
          </span>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
            Date of birth
          </span>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
            Gender (optional)
          </span>
          <input
            type="text"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            autoComplete="off"
            placeholder="Female / Male / etc."
            className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
          Home address (optional)
        </span>
        <input
          type="text"
          value={homeAddress}
          onChange={(e) => setHomeAddress(e.target.value)}
          autoComplete="off"
          placeholder="84 Birch Lane, Cambridge MA"
          className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
        />
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep"
        >
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy || fullName.trim().length === 0}
          className="rounded-md bg-action px-5 py-2.5 text-sm font-semibold text-action-ink hover:bg-ink2 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Saving…' : mode === 'create' ? 'Add patient' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-line bg-card px-5 py-2.5 text-sm text-ink2 hover:bg-paper-dim transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
