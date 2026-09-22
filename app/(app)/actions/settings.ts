"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDigestData, buildDigestEmail } from "@/lib/server/digest";
import { getDigestFromEmail, getResendClient } from "@/lib/server/resend";

type ActionResult = { error?: string };

const digestSchema = z.object({
  enabled: z.boolean(),
  email: z.union([z.literal(""), z.string().trim().email()]),
});

/** Turns the daily digest on/off and optionally overrides the recipient (defaults to the account email). */
export async function updateDigestSettings(input: { enabled: boolean; email: string }): Promise<ActionResult> {
  const parsed = digestSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a valid email or leave it blank." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("settings")
    .update({
      digest_enabled: parsed.data.enabled,
      digest_email: parsed.data.email || null,
    })
    .eq("user_id", auth.user.id);

  if (error) return { error: "Could not save digest settings." };
  revalidatePath("/settings");
  return {};
}

/** Sends today's digest to the signed-in user right now, regardless of the enabled toggle, for a quick check. */
export async function sendTestDigest(): Promise<ActionResult> {
  const resend = getResendClient();
  const fromEmail = getDigestFromEmail();
  if (!resend || !fromEmail) return { error: "Resend isn't configured yet." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { error: "Not signed in." };

  const { data: settings } = await supabase.from("settings").select("timezone, digest_email").eq("user_id", auth.user.id).single();
  const timezone = settings?.timezone ?? "America/New_York";
  const to = settings?.digest_email || auth.user.email;

  const data = await getDigestData(auth.user.id, timezone);
  const { subject, text, html } = buildDigestEmail(data, timezone);

  const { error } = await resend.emails.send({ from: fromEmail, to, subject: `[Test] ${subject}`, text, html });
  if (error) return { error: "Resend rejected the test send." };
  return {};
}
