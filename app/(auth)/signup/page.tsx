'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { getBrowserNemara } from '@/lib/api/client';
import { CURRENT_TOS_VERSION } from '@/lib/legal';
import { passwordProblem, passwordValid } from '@/lib/auth/password';
import { PasswordChecklist } from '@/app/_components/PasswordChecklist';
import { TermsConsentModal } from '@/app/_components/TermsConsentModal';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Consent is reviewed + agreed right here at signup (not deferred to first
  // sign-in). `agreed` gates the submit; the review modal flips it after the
  // caregiver scrolls both documents to the end.
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Live validation (also enforced by the disabled submit button below).
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    passwordValid(password) && password === confirm && agreed;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!agreed) {
      setShowTerms(true);
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const supa = getBrowserSupabase();
    const { data, error } = await supa.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (data.session) {
      // Provision the caregiver row WITH the accepted version, so consent
      // captured at signup is stamped server-side and the (app) gate doesn't
      // re-prompt. Best-effort: if it races the fresh session, the layout
      // gate still catches it on first load.
      try {
        await getBrowserNemara().createMe({
          display_name: name,
          tos_version: CURRENT_TOS_VERSION,
        });
      } catch {
        // fall through — the (app) TermsGate is the backstop
      }
      router.replace('/');
      router.refresh();
    } else {
      setInfo(
        'Account created. Check your email for a confirmation link to sign in.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-serif text-5xl tracking-tight text-ink">Memoria</h1>
      <form
        onSubmit={onSubmit}
        className="max-w-sm w-full rounded-lg border border-line bg-card p-8 flex flex-col gap-4 shadow-sm"
      >
        <h2 className="font-serif text-3xl tracking-tight text-ink">
          Create account
        </h2>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
            Display name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
            maxLength={120}
            className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="pw-checklist"
            className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          />
          <div id="pw-checklist">
            <PasswordChecklist value={password} />
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
            Confirm password
          </span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          />
          {mismatch && (
            <span className="text-xs text-terra-deep">Passwords don&apos;t match.</span>
          )}
        </label>
        {error && (
          <div
            role="alert"
            className="rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep"
          >
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-md border border-success/40 bg-card-alt px-3 py-2 text-sm text-success">
            {info}
          </div>
        )}
        {/* Review + confirm right here (not deferred to first sign-in). */}
        {agreed ? (
          <div className="flex items-center gap-2 text-xs text-ink2">
            <span aria-hidden className="text-success">✓</span>
            <span>Agreed to the Terms of Service and Privacy Notice.</span>
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="text-terra underline"
            >
              Review again
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="self-start text-xs font-medium text-terra underline"
          >
            Review Terms of Service and Privacy Notice
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !canSubmit}
          title={!agreed ? 'Review and agree to the Terms and Privacy Notice first' : undefined}
          className="rounded-md bg-action px-4 py-2.5 text-sm font-medium text-action-ink hover:bg-ink2 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="text-sm text-ink3">
          Already have an account?{' '}
          <Link href="/login" className="text-terra underline">
            Sign in
          </Link>
        </p>
      </form>

      {showTerms && (
        <TermsConsentModal
          agreeLabel="I agree"
          onClose={() => setShowTerms(false)}
          onAgree={() => {
            // Local consent only — the account doesn't exist yet. It's
            // persisted at provision time (createMe with tos_version) once
            // the user submits.
            setAgreed(true);
            setShowTerms(false);
          }}
        />
      )}
    </div>
  );
}
