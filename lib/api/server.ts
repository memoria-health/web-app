import 'server-only';
import { getServerAccessToken } from '@/lib/supabase/server';
import { NemaraAPI } from './core';
import { NemaraClient } from './methods';

export async function getServerNemara(): Promise<NemaraClient> {
  return new NemaraClient(new NemaraAPI(() => getServerAccessToken()));
}
