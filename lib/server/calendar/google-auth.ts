import "server-only";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env var.");
  }
  return { clientId, clientSecret };
}

export function createGoogleOAuthClient(redirectUri: string) {
  const { clientId, clientSecret } = getEnv();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Builds the consent-screen URL the user is redirected to. */
export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const client = createGoogleOAuthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    // Forces Google to re-issue a refresh token every time, not just on first-ever consent.
    // Without this, reconnecting after a revoke would silently omit refresh_token.
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

/** Exchanges the callback's `code` for tokens and the connected account's email. */
export async function exchangeGoogleCode(redirectUri: string, code: string) {
  const client = createGoogleOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Reconnect and make sure to approve the consent screen fully.",
    );
  }
  if (!tokens.access_token) {
    throw new Error("Google did not return an access token.");
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    accountEmail: data.email ?? null,
  };
}
