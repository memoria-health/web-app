'use client';

import { FamilyHome } from '@/components/insight/home';
import { EveryoneHome } from '@/components/insight/overview';
import { usePatients } from '@/app/_components/PatientProvider';
import { usePerson } from '@/app/_components/PersonContext';

/// Home — reassurance first, for whoever the person chip says.
/// A person selected → their briefing. "Everyone" → the triage board.
export default function HomePage() {
  const patients = usePatients().map((p) => ({ id: p.id, name: p.full_name, preferred: p.preferred_name }));
  const { selected } = usePerson();
  if (!patients.length) return null;
  return selected === 'all'
    ? <EveryoneHome patients={patients} />
    : <FamilyHome patients={patients} fixedPatient={selected} />;
}
