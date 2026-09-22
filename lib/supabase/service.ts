import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "./env";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * `integrations` (OAuth tokens) has RLS on with NO policies for the anon/authenticated
 * roles — only this client can read or write it. Never import this into a client
 * component, and never use it for tables a user's own session client can already reach.
 */
export function createServiceClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var.");

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
