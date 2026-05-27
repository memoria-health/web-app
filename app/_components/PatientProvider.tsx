'use client';

import { createContext, useContext } from 'react';
import type { Patient } from '@/lib/api/types';

interface PatientContextValue {
  patients: Patient[];
  selected: Patient | null;
}

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({
  patients,
  selected,
  children,
}: {
  patients: Patient[];
  selected: Patient | null;
  children: React.ReactNode;
}) {
  return (
    <PatientContext.Provider value={{ patients, selected }}>
      {children}
    </PatientContext.Provider>
  );
}

/// Returns the currently-selected patient. Throws if there isn't one
/// — use this in pages that require a patient (cameras, detectors,
/// dashboard tiles). The home page should use `useMaybePatient()`
/// instead so it can render an empty state.
export function usePatient(): Patient {
  const ctx = useContext(PatientContext);
  if (!ctx) {
    throw new Error('usePatient must be used within PatientProvider');
  }
  if (!ctx.selected) {
    throw new Error('usePatient called when no patient is selected');
  }
  return ctx.selected;
}

/// Returns the currently-selected patient or null. For pages that
/// gracefully handle the no-patient case (the home page's empty
/// state, the patients roster).
export function useMaybePatient(): Patient | null {
  const ctx = useContext(PatientContext);
  if (!ctx) {
    throw new Error('useMaybePatient must be used within PatientProvider');
  }
  return ctx.selected;
}

/// Full patient list — used by the TopNav switcher and the
/// /patients roster.
export function usePatients(): Patient[] {
  const ctx = useContext(PatientContext);
  if (!ctx) {
    throw new Error('usePatients must be used within PatientProvider');
  }
  return ctx.patients;
}
