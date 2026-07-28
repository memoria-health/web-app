'use client';

import { FamilyHome } from '@/components/insight/home';
import { usePatients } from '@/app/_components/PatientProvider';

/// Family Home — answers, not charts. Patient list comes from the authed
/// PatientProvider (backend-scoped); the insight API routes re-derive the
/// same scope server-side from the session, so the client list is display-
/// only and never trusted for access control.
export default function HomePage() {
  const patients = usePatients();
  return (
    <FamilyHome
      patients={patients.map((p) => ({ id: p.id, name: p.full_name, preferred: p.preferred_name }))}
    />
  );
}
