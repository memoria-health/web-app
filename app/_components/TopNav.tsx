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
    <nav className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tracking-wide">Nemara</span>
        <span className="text-zinc-700">·</span>
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
                    'rounded px-2 py-1 text-xs',
                    active
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex items-center gap-2">
        {email && (
          <span
            className="text-xs text-zinc-500 max-w-[14rem] truncate"
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
