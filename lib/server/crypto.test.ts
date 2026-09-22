import { beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "./crypto";

const TEST_KEY = "cZn5XvyrT8dxihKTDhaZo4d0eV7OCO8+zK6j/bsEZwI="; // 32 random bytes, base64 — test-only

beforeEach(() => {
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
});

describe("encrypt/decrypt", () => {
  it("round-trips a string", () => {
    const plaintext = "a-very-secret-refresh-token";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("round-trips unicode content", () => {
    const plaintext = "token with emoji 🔒 and accents éàü";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const plaintext = "same input";
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it("throws on a tampered ciphertext instead of silently returning garbage", () => {
    const packed = encrypt("secret value");
    const bytes = Buffer.from(packed, "base64");
    bytes[bytes.length - 1] ^= 0xff; // flip a bit in the ciphertext
    expect(() => decrypt(bytes.toString("base64"))).toThrow();
  });

  it("throws when decrypting with the wrong key", () => {
    const packed = encrypt("secret value");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    expect(() => decrypt(packed)).toThrow();
  });

  it("throws a clear error when the key env var is missing", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    expect(() => encrypt("x")).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("throws a clear error when the key isn't 32 bytes", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.from("too short").toString("base64"));
    expect(() => encrypt("x")).toThrow(/32 bytes/);
  });
});
