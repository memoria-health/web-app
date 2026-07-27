'use client';

import { useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase/client';

/// Keeps a tab honest about who's actually signed in.
///
/// A browser shares one auth session across all tabs. If a *different* account
/// signs in (or someone signs out) in another tab, this tab would otherwise keep
/// showing the old account's UI while its requests silently run as the new one —
/// which surfaces as confusing 404s. This listens for auth changes and, when the
/// live session no longer matches the account this page was rendered for,
/// reconciles: sign-out → go to /login; a different account → hard-reload so the
/// whole app re-renders as the account that's actually active.
///
/// `userId` is the account the server rendered this page for. We only act on
/// real identity changes (SIGNED_IN as someone else / SIGNED_OUT) — token
/// refreshes and re-auth as the same account are ignored, so there's no loop.
export function SessionSync({ userId }: { userId: string }) {
  useEffect(() => {
    const supa = getBrowserSupabase();
    const {
      data: { subscription },
    } = supa.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      const current = session?.user?.id ?? null;
      if (event === 'SIGNED_OUT') {
        window.location.assign('/login');
        return;
      }
      if (event === 'SIGNED_IN' && current && current !== userId) {
        // A different account is now active in this browser → reload as them.
        window.location.assign('/');
      }
    });
    return () => subscription.unsubscribe();
  }, [userId]);

  return null;
}
