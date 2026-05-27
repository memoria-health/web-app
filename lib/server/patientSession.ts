import { cookies } from 'next/headers';
import { cache } from 'react';
import { getServerNemara } from '@/lib/api/server';
import type { Patient } from '@/lib/api/types';

const SELECTED_PATIENT_COOKIE = 'selected_patient_id';

export interface PatientSession {
  patients: Patient[];
  selected: Patient | null;
}

/// Server-side resolver for the caregiver's patient list + which one
/// is currently selected. Mirrors the iOS roster + active-patient
/// pattern: the caregiver may have several patients, the UI shows one
/// at a time, and the selection persists via cookie across navigations.
///
/// Wrapped in React's `cache()` so calling this multiple times within
/// a single request only fires the backend round-trip once.
///
/// Resolution:
///   1. Fetch the caregiver's full patient list from the backend.
///   2. Read the `selected_patient_id` cookie. If it points at a
///      patient that exists, that's the selected one.
///   3. Otherwise fall back to the first patient (display_id-ordered
///      from the API). When the list is empty, `selected` is null and
///      pages should render an "add your first patient" empty state.
export const patientSession = cache(async (): Promise<PatientSession> => {
  const api = await getServerNemara();
  const patients = await api.listPatients();

  if (patients.length === 0) {
    return { patients, selected: null };
  }

  const jar = await cookies();
  const stored = jar.get(SELECTED_PATIENT_COOKIE)?.value;
  const selected =
    (stored && patients.find((p) => p.id === stored)) ?? patients[0];

  return { patients, selected };
});

export { SELECTED_PATIENT_COOKIE };
