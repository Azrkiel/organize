import "server-only";
import { Resend } from "resend";

/** Null when Resend isn't configured — callers should treat the digest as unavailable, not error. */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

export function getDigestFromEmail(): string | null {
  return process.env.DIGEST_FROM_EMAIL ?? null;
}
