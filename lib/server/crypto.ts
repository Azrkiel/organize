import "server-only";
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // NIST-recommended IV length for GCM
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const b64 = process.env.TOKEN_ENCRYPTION_KEY;
  if (!b64) throw new Error("Missing TOKEN_ENCRYPTION_KEY env var.");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes (openssl rand -base64 32).");
  }
  return key;
}

/**
 * Encrypts a string with AES-256-GCM. Output packs iv + auth tag + ciphertext into one
 * base64 string, so callers only need to store a single column value.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

/** Reverses {@link encrypt}. Throws if the key is wrong or the packed value was tampered with. */
export function decrypt(packed: string): string {
  const buf = Buffer.from(packed, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
