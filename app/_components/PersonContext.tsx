'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePatients } from './PatientProvider';

/* ONE control decides who the whole app is about: a specific patient, or
 * 'all' ("Everyone", multi-patient accounts only). Every tab — Home, Live,
 * Ask, Explore — renders for this selection, so single- and multi-patient
 * accounts share an IDENTICAL layout; patient count only changes whether
 * the chip opens a menu. Persisted per device. */

const KEY = 'memoria-person';

type Ctx = { selected: string; setSelected: (id: string) => void };
const PersonCtx = createContext<Ctx>({ selected: 'all', setSelected: () => {} });

export function PersonProvider({ children }: { children: React.ReactNode }) {
  const patients = usePatients();
  const [selected, setSelectedRaw] = useState<string>('');

  // default: the only patient (family) or Everyone (facility); heal stale ids
  useEffect(() => {
    if (!patients.length) return;
    const saved = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    const valid = (id: string | null) => id === 'all' || patients.some((p) => p.id === id);
    if (selected && valid(selected)) return;
    if (saved && valid(saved) && !(saved === 'all' && patients.length === 1)) setSelectedRaw(saved);
    else setSelectedRaw(patients.length === 1 ? patients[0].id : 'all');
  }, [patients, selected]);

  const value = useMemo<Ctx>(() => ({
    selected: selected || (patients.length === 1 ? patients[0]?.id ?? 'all' : 'all'),
    setSelected: (id) => { setSelectedRaw(id); try { localStorage.setItem(KEY, id); } catch {} },
  }), [selected, patients]);

  return <PersonCtx.Provider value={value}>{children}</PersonCtx.Provider>;
}

export function usePerson() {
  return useContext(PersonCtx);
}
