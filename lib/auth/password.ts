// Canonical client-side password policy for account creation. Rules +
// labels match the iOS NemaraPasswordChecklist 1:1 so both surfaces show the
// same green checklist and accept the same inputs. Server-side, Supabase Auth
// enforces its own minimum as the real gate; this is UX.

export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'One symbol', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function passwordValid(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

/// First unmet rule as a plain-language error (fallback for the submit
/// handler; the live checklist is the primary affordance).
export function passwordProblem(pw: string): string | null {
  const failed = PASSWORD_RULES.find((r) => !r.test(pw));
  return failed ? `Password needs: ${failed.label.toLowerCase()}.` : null;
}
