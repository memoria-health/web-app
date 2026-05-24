'use client';

import { getBrowserSupabase } from '@/lib/supabase/client';
import { NemaraAPI } from './core';
import { NemaraClient } from './methods';

let _client: NemaraClient | null = null;

export function getBrowserNemara(): NemaraClient {
  if (!_client) {
    _client = new NemaraClient(
      new NemaraAPI(async () => {
        const supa = getBrowserSupabase();
        const { data } = await supa.auth.getSession();
        return data.session?.access_token ?? null;
      }),
    );
  }
  return _client;
}
