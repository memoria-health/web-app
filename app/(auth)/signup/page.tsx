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
        className="max-w-sm w-full rounded border border-zinc-800 bg-zinc-950 p-6 flex flex-col gap-3"
      >
        <h1 className="text-base font-semibold tracking-wide">
          Create account
        </h1>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Display name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
            maxLength={120}
            className="rounded border border-zinc-800 bg-black px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-600"
          />
        </label>
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
            minLength={6}
            autoComplete="new-password"
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
        {info && (
          <div className="rounded border border-emerald-900 bg-emerald-950/40 px-2 py-1.5 text-xs text-emerald-300">
            {info}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="text-xs text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="text-zinc-300 underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
