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
      className="rounded-md border border-line bg-transparent px-3 py-1.5 text-base text-ink2 hover:bg-paper-dim hover:text-ink disabled:opacity-50 transition-colors"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
