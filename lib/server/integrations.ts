import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { decrypt, encrypt } from "@/lib/server/crypto";
import type { CalendarProvider } from "@/lib/server/calendar/types";

export type StoredIntegration = {
  accountEmail: string | null;
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  calendarId: string | null;
};

/** Reads a user's integration row and decrypts its tokens. Null if not connected. */
export async function getIntegration(
  userId: string,
  provider: CalendarProvider,
): Promise<StoredIntegration | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("account_email, refresh_token_enc, access_token_enc, access_token_expires_at, calendar_id")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    accountEmail: data.account_email,
    refreshToken: decrypt(data.refresh_token_enc),
    accessToken: data.access_token_enc ? decrypt(data.access_token_enc) : null,
    accessTokenExpiresAt: data.access_token_expires_at,
    calendarId: data.calendar_id,
  };
}

/** Upserts a user's integration row, encrypting tokens before they touch the DB. */
export async function saveIntegration(
  userId: string,
  provider: CalendarProvider,
  values: {
    accountEmail?: string | null;
    refreshToken: string;
    accessToken?: string | null;
    accessTokenExpiresAt?: string | null;
    calendarId?: string | null;
  },
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("integrations").upsert({
    user_id: userId,
    provider,
    account_email: values.accountEmail ?? null,
    refresh_token_enc: encrypt(values.refreshToken),
    access_token_enc: values.accessToken ? encrypt(values.accessToken) : null,
    access_token_expires_at: values.accessTokenExpiresAt ?? null,
    calendar_id: values.calendarId ?? null,
  });
  if (error) throw error;
}

/** Updates only the access token after a refresh, keeping the stored refresh token as-is. */
export async function updateAccessToken(
  userId: string,
  provider: CalendarProvider,
  accessToken: string,
  expiresAt: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("integrations")
    .update({ access_token_enc: encrypt(accessToken), access_token_expires_at: expiresAt })
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw error;
}

export async function deleteIntegration(userId: string, provider: CalendarProvider): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw error;
}
