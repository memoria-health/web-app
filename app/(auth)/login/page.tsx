'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supa = getBrowserSupabase();
      const { error } = await supa.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-sm w-full rounded border border-zinc-800 bg-zinc-950 p-6 flex flex-col gap-3"
    >
      <h1 className="text-base font-semibold tracking-wide">Sign in</h1>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-600"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-600"
        />
      </label>
      {error && (
        <div
          role="alert"
          className="rounded border border-red-900 bg-red-950/40 px-2 py-1.5 text-xs text-red-300"
        >
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-xs text-zinc-500">
        No account?{' '}
        <Link href="/signup" className="text-zinc-300 underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
