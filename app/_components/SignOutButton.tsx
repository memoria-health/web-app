'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await getBrowserSupabase().auth.signOut();
    router.replace('/login');
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="rounded border border-zinc-800 bg-transparent px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
