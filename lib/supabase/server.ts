import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Setting cookies in Server Components is a no-op outside of
          // Server Actions / Route Handlers. The proxy keeps the session
          // fresh, so this is safe to swallow.
        }
      },
    },
  });
}

export async function getServerSession() {
  const supa = await getServerSupabase();
  const { data } = await supa.auth.getSession();
  return data.session;
}

export async function getServerAccessToken(): Promise<string | null> {
  const session = await getServerSession();
  return session?.access_token ?? null;
}
