"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteIntegration } from "@/lib/server/integrations";
import type { CalendarProvider } from "@/lib/server/calendar/types";

type ActionResult = { error?: string };

export async function disconnectIntegration(provider: CalendarProvider): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  await deleteIntegration(auth.user.id, provider);
  revalidatePath("/settings");
  return {};
}
