function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export const env = {
  SUPABASE_URL: required(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  SUPABASE_ANON_KEY: required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  BACKEND_URL: required(
    'NEXT_PUBLIC_NEMARA_BACKEND_URL',
    process.env.NEXT_PUBLIC_NEMARA_BACKEND_URL,
  ),
  LIVEKIT_URL: required(
    'NEXT_PUBLIC_LIVEKIT_URL',
    process.env.NEXT_PUBLIC_LIVEKIT_URL,
  ),
};
