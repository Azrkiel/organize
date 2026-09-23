import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getDigestRecipient, getDigestData, buildDigestEmail } from "@/lib/server/digest";
import { getDigestFromEmail, getResendClient } from "@/lib/server/resend";

export const dynamic = "force-dynamic";

/**
 * Runs once daily (see `vercel.json`), protected by `CRON_SECRET`. Emails today's tasks,
 * overdue items, today's events, and exam countdowns (PLAN.md Phase 6 task 3).
 */
export async function GET(request: NextRequest) {
  // Without this guard an unset CRON_SECRET would make the expected header the literal
  // "Bearer undefined", so anyone who guessed that string could trigger the route.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run the digest cron.");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Keep-alive: touch the DB every day even if the digest itself is off or unconfigured,
  // so the Supabase free project doesn't pause from a week of no traffic.
  const supabase = createServiceClient();
  await supabase.from("settings").select("user_id").limit(1);

  const resend = getResendClient();
  const fromEmail = getDigestFromEmail();
  if (!resend || !fromEmail) {
    return NextResponse.json({ sent: false, reason: "Resend not configured" });
  }

  const recipient = await getDigestRecipient();
  if (!recipient) {
    return NextResponse.json({ sent: false, reason: "Digest disabled or no recipient" });
  }

  const data = await getDigestData(recipient.userId, recipient.timezone);
  const { subject, text, html } = buildDigestEmail(data, recipient.timezone);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: recipient.email,
    subject,
    text,
    html,
  });

  if (error) {
    console.error("Daily digest send failed", error);
    return NextResponse.json({ sent: false, reason: "Resend error" }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
