'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supa = getBrowserSupabase();
      // `redirectTo` lands the user on /auth/reset-password with a
      // `?code=…` param Supabase exchanges for a recovery session. Must
      // be on the Auth → URL Configuration allow-list in the Supabase
      // dashboard or Supabase silently refuses the link.
      const { error } = await supa.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      // Supabase intentionally returns success whether or not the
      // email exists — privacy-preserving. We mirror that here: never
      // reveal whether the address is registered.
      setSent(true);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-lg border border-line bg-card p-8 flex flex-col gap-4 shadow-sm">
        <h1 className="font-serif text-3xl tracking-tight text-ink">
          Reset password
        </h1>
        {sent ? (
          <>
            <p className="text-sm text-ink2">
              If <span className="font-mono text-ink">{email}</span> is
              registered, a reset link is on its way. Check your inbox (and
              spam folder).
            </p>
            <p className="text-sm text-ink3">
              The link expires in 1 hour.
            </p>
            <Link
              href="/login"
              className="mt-2 rounded-md bg-action px-4 py-2.5 text-center text-sm font-medium text-action-ink hover:bg-ink2 transition-colors"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-ink3">
              Enter the email you signed up with and we&apos;ll send you a
              link to set a new password.
            </p>
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
            {error && (
              <div
                role="alert"
                className="rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep"
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-action px-4 py-2.5 text-sm font-medium text-action-ink hover:bg-ink2 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="text-sm text-ink3">
              Remembered it?{' '}
              <Link href="/login" className="text-terra underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
