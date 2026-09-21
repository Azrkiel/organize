"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/timezone";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const timeZoneSchema = z.string().refine(isValidTimeZone, "Invalid time zone");

/**
 * Store the browser's time zone in settings, but only while it is still the untouched default,
 * so a value the owner picked later is never overwritten. Returns true when nothing more to do.
 */
export async function syncTimezone(timeZone: string): Promise<boolean> {
  const parsed = timeZoneSchema.safeParse(timeZone);
  if (!parsed.success) return true;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;

  const { error } = await supabase
    .from("settings")
    .update({ timezone: parsed.data })
    .eq("user_id", data.user.id)
    .eq("timezone", DEFAULT_TIMEZONE);

  // Table missing / DB unreachable: try again on a later load instead of crashing.
  return !error;
}
