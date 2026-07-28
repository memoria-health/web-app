'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { SignOutButton } from './SignOutButton';
import { PersonChip } from './PersonChip';
import { AlertsBell } from './alerts/AlertsBell';

/// Top of every page. Two stacked rows:
///
///   Row 1 (always):
///     - Left: Memoria brand
///     - Right: "Current patient: <name> ▾" (only when inside a
///              patient) + email + Sign out
///
///   Row 2 (only when inside a patient):
///     - Centered: Live · Sensors · Detectors · Settings
///
/// On non-patient routes (`/`, `/patients/new`) only Row 1 renders.
export function TopNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  const patientIdMatch = pathname.match(/^\/patients\/([0-9a-f-]+)/i);
  const inPatient = patientIdMatch !== null;
  const base = patientIdMatch ? `/patients/${patientIdMatch[1]}` : '';
  // ONE tab row for every account shape — the person chip carries the
  // patient dimension, so the tabs never change with patient count.
  const inPatientSetup = inPatient && /\/(cameras|detectors|settings)/.test(pathname);

  const tabs = [
    { href: '/home', label: 'Home', isActive: pathname.startsWith('/home') },
    { href: '/live', label: 'Live', isActive: pathname.startsWith('/live') || (inPatient && !inPatientSetup) },
    { href: '/ask', label: 'Ask', isActive: pathname.startsWith('/ask') },
    { href: '/explore', label: 'Explore', isActive: pathname.startsWith('/explore') },
    {
      href: '/settings',
      label: 'Settings',
      isActive: pathname.startsWith('/settings') || pathname === '/patients' || pathname.startsWith('/patients/new') || inPatientSetup,
    },
  ];

  return (
    <>
      <nav className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-line bg-card px-5 py-3">
        <Link
          href="/"
          className="justify-self-start font-serif text-2xl tracking-tight text-ink hover:text-ink2 transition-colors"
        >
          Memoria
        </Link>

        <div className="justify-self-center">
          <PersonChip />
        </div>

        <div className="flex items-center gap-3 justify-self-end">
          {email && (
            <span
              className="text-base text-ink3 max-w-[14rem] truncate"
              title={email}
            >
              {email}
            </span>
          )}
          {/* Per-device browser-alerts toggle (sound + desktop notification +
              toast). See app/_components/alerts/AlertsProvider.tsx. */}
          <AlertsBell />
          <SignOutButton />
        </div>
      </nav>

      {tabs.length > 0 && (
        <div className="border-b border-line bg-card-alt px-5 py-3">
          <ul className="mx-auto flex max-w-7xl items-center justify-center gap-12">
            {tabs.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className={cn(
                    'rounded-md px-5 py-2 text-base transition-colors',
                    t.isActive
                      ? 'bg-action text-action-ink'
                      : 'text-ink3 hover:bg-paper-dim hover:text-ink',
                  )}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
