// Live password-requirement checklist: each rule's box fills green the moment
// it's met. Mirrors the iOS NemaraPasswordChecklist (same rules, same green,
// 2-column grid) so signup looks and behaves the same on both surfaces.

import { PASSWORD_RULES } from '@/lib/auth/password';
import { cn } from '@/lib/utils/cn';

export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-1">
      {PASSWORD_RULES.map((rule) => {
        const pass = rule.test(value);
        return (
          <li key={rule.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[9px] font-bold leading-none transition-colors',
                pass
                  ? 'border-success bg-success text-paper'
                  : 'border-line text-transparent',
              )}
            >
              ✓
            </span>
            <span className={cn('text-xs transition-colors', pass ? 'text-ink2' : 'text-ink4')}>
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
