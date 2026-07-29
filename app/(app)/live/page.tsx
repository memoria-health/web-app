'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePatients } from '@/app/_components/PatientProvider';
import { usePerson } from '@/app/_components/PersonContext';

/// Live — the selected person's cameras (the existing per-patient Live
/// page). With "Everyone" selected there is no single room to show, so
/// pick who to watch.
export default function LivePage() {
  const patients = usePatients();
  const { selected, setSelected } = usePerson();
  const router = useRouter();

  useEffect(() => {
    if (selected && selected !== 'all') router.replace(`/patients/${selected}`);
  }, [selected, router]);

  if (selected !== 'all') return null;
  return (
    <div className="mx-auto w-full max-w-xl px-6 pt-8">
      <h1 className="font-serif text-[24px] font-semibold text-ink">Who do you want to see?</h1>
      <div className="mt-5 space-y-3">
        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelected(p.id); router.push(`/patients/${p.id}`); }}
            className="anim-up lift block w-full rounded-2xl border border-line bg-card px-6 py-4 text-left font-serif text-[18px] font-semibold text-ink"
          >
            {p.preferred_name || p.full_name}
          </button>
        ))}
      </div>
    </div>
  );
}
