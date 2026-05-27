'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabase/client';

function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const code = search.get('code');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `exchanging` = we are turning the URL code into a recovery session.
  // Until this completes, the form is disabled — submitting before the
  // recovery session is live would just hit `auth.updateUser` against
  // an unauthenticated client and fail with a confusing 401.
  const [exchanging, setExchanging] = useState(true);
  const [linkValid, setLinkValid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!code) {
        setExchanging(false);
        return;
      }
      try {
        const supa = getBrowserSupabase();
        const { error } = await supa.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          setLinkValid(true);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setExchanging(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords don\'t match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supa = getBrowserSupabase();
      const { error } = await supa.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      // Recovery session is now a fully-signed-in session; route to the
      // dashboard. router.refresh() makes the server components re-fetch
      // with the new auth cookie.
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (exchanging) {
    return (
      <div className="max-w-sm w-full rounded-lg border border-line bg-card p-8 flex flex-col gap-4 shadow-sm">
        <h1 className="font-serif text-3xl tracking-tight text-ink">
          Reset password
        </h1>
        <p className="text-sm text-ink3">Verifying link…</p>
      </div>
    );
  }

  if (!code || !linkValid) {
    return (
      <div className="max-w-sm w-full rounded-lg border border-line bg-card p-8 flex flex-col gap-4 shadow-sm">
        <h1 className="font-serif text-3xl tracking-tight text-ink">
          Link invalid
        </h1>
        <p className="text-sm text-ink2">
          {error ?? 'This reset link is missing, expired, or has already been used.'}
        </p>
        <Link
          href="/forgot-password"
          className="mt-2 rounded-md bg-action px-4 py-2.5 text-center text-sm font-medium text-action-ink hover:bg-ink2 transition-colors"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-sm w-full rounded-lg border border-line bg-card p-8 flex flex-col gap-4 shadow-sm"
    >
      <h1 className="font-serif text-3xl tracking-tight text-ink">
        New password
      </h1>
      <p className="text-sm text-ink3">
        Pick a new password. At least 8 characters.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
          New password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
          className="rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink3">
          Confirm
        </span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
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
        {busy ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="text-sm text-ink3">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
