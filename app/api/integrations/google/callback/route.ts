import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeGoogleCode } from "@/lib/server/calendar/google-auth";
import { saveIntegration } from "@/lib/server/integrations";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const settingsUrl = (status: string) => `${origin}/settings?google=${status}`;

  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const consentError = searchParams.get("error"); // e.g. "access_denied" if the user cancels

  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const response = NextResponse.redirect(settingsUrl("error"));
  response.cookies.delete(STATE_COOKIE); // one-time use either way

  if (consentError) {
    response.headers.set("Location", settingsUrl("cancelled"));
    return response;
  }
  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    response.headers.set("Location", settingsUrl("error"));
    return response;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    response.headers.set("Location", `${origin}/login`);
    return response;
  }

  try {
    const redirectUri = `${origin}/api/integrations/google/callback`;
    const tokens = await exchangeGoogleCode(redirectUri, code);
    await saveIntegration(data.user.id, "google", {
      accountEmail: tokens.accountEmail,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    });
    response.headers.set("Location", settingsUrl("connected"));
  } catch (err) {
    console.error("Google OAuth callback failed", err);
    response.headers.set("Location", settingsUrl("error"));
  }

  return response;
}
