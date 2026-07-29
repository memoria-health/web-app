'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { usePatient } from './PatientProvider';

/* Cohesive care-setup navigation: on a person's Cameras / Detectors /
 * Advanced pages, show where you are and a way back to Settings. Live
 * pages stay chrome-free. */
const SECTIONS: Record<string, string> = {
  cameras: 'Cameras',
  detectors: 'Detectors',
  settings: 'Advanced settings',
};

export function SetupBreadcrumb() {
  const pathname = usePathname();
  const patient = usePatient();
  const m = pathname.match(/^\/patients\/[0-9a-f-]+\/(cameras|detectors|settings)/i);
  if (!m || !patient) return null;
  const name = patient.preferred_name || patient.full_name;
  return (
    <div className="border-b border-line bg-card-alt/60 px-6 py-2.5">
      <div className="mx-auto flex max-w-7xl items-center gap-2 text-[14px]">
        <Link href="/settings" className="flex items-center gap-1 rounded-md px-1.5 py-1 text-ink3 hover:bg-paper-dim hover:text-ink">
          <ChevronLeft size={15} /> Settings
        </Link>
        <span className="text-ink4">/</span>
        <span className="font-medium text-ink2">{name}</span>
        <span className="text-ink4">/</span>
        <span className="text-ink3">{SECTIONS[m[1].toLowerCase()]}</span>
      </div>
    </div>
  );
}
