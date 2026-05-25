'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { env } from '@/lib/env';

type Client = ReturnType<typeof createBrowserClient>;

let _client: Client | null = null;
let _authReady: Promise<void> | null = null;

/**
 * Synchronous accessor — returns the browser client. The first call also
 * kicks off the auth-binding work (`bindRealtimeAuth`), which is async.
 *
 * Use this when you only need the client for non-Realtime work (REST
 * calls, auth.signIn, etc). For Realtime, use `getAuthedBrowserSupabase`
 * which awaits the initial `setAuth()` before returning.
 */
export function getBrowserSupabase(): Client {
  if (!_client) {
    _client = createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    console.log('[SUPABASE] browser client created');
    _authReady = bindRealtimeAuth(_client);
  }
  return _client;
}

/**
 * **Use this before subscribing to a Realtime channel.**
 *
 * The bug this exists to prevent: `realtime.setAuth(token)` is async-ish
 * (it has to read the session from cookies). If a component calls
 * `.subscribe()` synchronously after `getBrowserSupabase()`, the channel
 * registers on the server with the **anon** role — because no JWT has
 * been pushed to Realtime yet. The realtime container stores
 * `claims.role = "anon"`, `claims.sub = ""` in the subscription row,
 * and from that moment on RLS evaluates `auth.uid()` as NULL.
 *
 * RLS policies like `caregiver_id = auth.uid()` then silently drop
 * every broadcast for this subscription. The channel reports
 * `SUBSCRIBED`, no errors fire, but you receive zero events. The user
 * sees an empty feed. We've been hit by exactly this.
 *
 * Awaiting `_authReady` guarantees the initial JWT has been pushed
 * to Realtime before the caller subscribes, so the subscription row
 * is registered with `claims.role = "authenticated"` and `claims.sub =
 * <user-id>` — and RLS lets the broadcasts through.
 */
export async function getAuthedBrowserSupabase(): Promise<Client> {
  const client = getBrowserSupabase();
  if (_authReady) {
    await _authReady;
  }
  return client;
}

async function bindRealtimeAuth(client: Client): Promise<void> {
  console.log('[SUPABASE] binding realtime auth refresher');

  // Listen for future token refreshes (TOKEN_REFRESHED fires ~ every 50 min)
  // — these update the in-memory token AND push to active channels for
  // any subscriptions registered after this point.
  client.auth.onAuthStateChange(
    (event: AuthChangeEvent, session: Session | null) => {
      const tok = session?.access_token ?? null;
      console.log(
        '[SUPABASE] auth event=',
        event,
        'token=',
        tok ? `${tok.slice(0, 24)}…` : 'null',
        'expires_at=',
        session?.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : 'n/a',
      );
      client.realtime.setAuth(tok);
    },
  );

  // Initial setAuth — this is what callers of getAuthedBrowserSupabase()
  // await. Must complete BEFORE any subscribe() call so the subscription
  // registers with authenticated claims, not anon.
  const { data } = await client.auth.getSession();
  const session = data.session;
  const tok = session?.access_token ?? null;
  console.log(
    '[SUPABASE] initial setAuth — token=',
    tok ? `${tok.slice(0, 24)}…` : 'null',
    'session expires_at=',
    session?.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : 'n/a',
  );
  client.realtime.setAuth(tok);
}
