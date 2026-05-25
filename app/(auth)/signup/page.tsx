'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="max-w-sm w-full rounded-lg border border-line bg-card p-8 flex flex-col gap-4 shadow-sm"
      >
        <h1 className="font-serif text-3xl tracking-tight text-ink">
          Create account
        </h1>
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
            minLength={6}
            autoComplete="new-password"
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
        {info && (
          <div className="rounded-md border border-success/40 bg-card-alt px-3 py-2 text-sm text-success">
            {info}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
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
    </div>
  );
}
