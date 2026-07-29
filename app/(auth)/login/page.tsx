'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      className="max-w-sm w-full rounded-lg border border-line bg-card p-8 flex flex-col gap-4 shadow-sm"
    >
      <h2 className="font-serif text-3xl tracking-tight text-ink">Sign in</h2>
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
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-line bg-paper-dim px-3 py-2 pr-10 text-sm text-ink focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            title={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-ink3 hover:text-ink transition-colors focus:outline-none"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
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
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <div className="flex items-center justify-between gap-3 text-sm text-ink3">
        <span>
          No account?{' '}
          <Link href="/signup" className="text-terra underline">
            Sign up
          </Link>
        </span>
        <Link href="/forgot-password" className="text-terra underline">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-serif text-5xl tracking-tight text-ink">Memoria</h1>
      <Suspense fallback={<div className="text-sm text-ink3">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
