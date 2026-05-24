'use client';

import { createContext, useContext } from 'react';
import type { Patient } from '@/lib/api/types';

interface PatientContextValue {
  patient: Patient;
}

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({
  patient,
  children,
}: {
  patient: Patient;
  children: React.ReactNode;
}) {
  return (
    <PatientContext.Provider value={{ patient }}>
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient(): Patient {
  const ctx = useContext(PatientContext);
  if (!ctx)
    throw new Error('usePatient must be used within PatientProvider');
  return ctx.patient;
}
