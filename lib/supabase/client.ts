import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

// NEXT_PUBLIC_* vars must be referenced literally so Next inlines them in the browser bundle.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars. See .env.example.");
  return createBrowserClient<Database>(url, anonKey);
}
