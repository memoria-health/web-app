'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { SignOutButton } from './SignOutButton';

const LINKS = [
  { href: '/', label: 'Live' },
  { href: '/cameras', label: 'Cameras' },
  { href: '/detectors', label: 'Detectors' },
];

export function TopNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center justify-between gap-4 border-b border-line bg-card px-5 py-3">
      <div className="flex items-center gap-4">
        <span className="font-serif text-xl tracking-tight text-ink">
          Nemara
        </span>
        <ul className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-action text-action-ink'
                      : 'text-ink3 hover:bg-paper-dim hover:text-ink',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex items-center gap-3">
        {email && (
          <span
            className="text-sm text-ink3 max-w-[14rem] truncate"
            title={email}
          >
            {email}
          </span>
        )}
        <SignOutButton />
      </div>
    </nav>
  );
}
