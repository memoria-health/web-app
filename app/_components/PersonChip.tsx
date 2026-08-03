'use client';

import { ChevronDown, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { usePatients } from './PatientProvider';
import { usePerson } from './PersonContext';

/* The person chip — the ONLY thing patient count changes in the whole app.
 * One patient: a static label ("Mom"), no menu, nothing to learn.
 * Several: the same chip becomes a picker with each person + "Everyone". */
export function PersonChip() {
  const patients = usePatients();
  const { selected, setSelected } = usePerson();
  const router = useRouter();
  const pathname = usePathname();

  if (!patients.length) return null;

  const label = selected === 'all'
    ? 'Everyone'
    : (patients.find((p) => p.id === selected)?.preferred_name
        ?? patients.find((p) => p.id === selected)?.full_name ?? '…');

  if (patients.length === 1) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-1.5 text-[15px] font-medium text-ink2">
        <Users size={14} className="text-terra" />
        {label}
      </span>
    );
  }

  const choose = (id: string) => {
    setSelected(id);
    // inside a patient's pages, switching person follows you there; Everyone
    // has no single-patient page, so it returns to Home
    const m = pathname.match(/^\/patients\/[0-9a-f-]+(\/.*)?$/i);
    if (m) router.push(id === 'all' ? '/home' : `/patients/${id}${m[1] ?? ''}`);
  };

  return (
    <label className="relative inline-flex items-center">
      <Users size={14} className="pointer-events-none absolute left-3.5 text-terra" />
      <select
        value={selected}
        onChange={(e) => choose(e.target.value)}
        className="appearance-none rounded-full border border-line bg-card py-1.5 pl-9 pr-8 text-[15px] font-medium text-ink2 outline-none hover:border-terra/50"
      >
        <option value="all">Everyone</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>{p.preferred_name || p.full_name}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-ink4" />
    </label>
  );
}
