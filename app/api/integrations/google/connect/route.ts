import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleAuthUrl } from "@/lib/server/calendar/google-auth";

const STATE_COOKIE = "google_oauth_state";

// Kicks off the Google consent flow. GET so it can be a plain link/redirect from settings.
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${origin}/api/integrations/google/callback`;
  const authUrl = buildGoogleAuthUrl(redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes — plenty for a consent-screen click-through
    path: "/",
  });
  return response;
}
