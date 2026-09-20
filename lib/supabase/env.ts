export class MissingSupabaseEnvError extends Error {
  constructor() {
    super("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.");
    this.name = "MissingSupabaseEnvError";
  }
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new MissingSupabaseEnvError();
  return { url, anonKey };
}
