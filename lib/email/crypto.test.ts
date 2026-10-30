import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateEncryptionKey, parseEncryptionKey } from "./crypto";

const key = parseEncryptionKey(generateEncryptionKey())!;

describe("parseEncryptionKey", () => {
  it("accepts a base64 key of exactly 32 bytes", () => {
    expect(parseEncryptionKey(generateEncryptionKey())?.length).toBe(32);
  });

  it("rejects missing, blank, short and non-base64 keys", () => {
    expect(parseEncryptionKey(undefined)).toBeNull();
    expect(parseEncryptionKey("")).toBeNull();
    expect(parseEncryptionKey("   ")).toBeNull();
    expect(parseEncryptionKey(Buffer.alloc(16).toString("base64"))).toBeNull();
    expect(parseEncryptionKey("not base64 at all!!")).toBeNull();
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips, including unicode", () => {
    for (const value of ["hunter2", "p@ss w0rd/+=", "şifre-ğüşiöç-🔒", "x".repeat(500)]) {
      expect(decryptSecret(encryptSecret(value, key), key)).toBe(value);
    }
  });

  it("never stores the plain text and uses a fresh IV each time", () => {
    const a = encryptSecret("hunter2", key);
    const b = encryptSecret("hunter2", key);
    expect(a).not.toContain("hunter2");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
  });

  it("fails with the wrong key", () => {
    const other = parseEncryptionKey(generateEncryptionKey())!;
    expect(() => decryptSecret(encryptSecret("hunter2", key), other)).toThrow();
  });

  it("fails when the stored value was tampered with", () => {
    const stored = encryptSecret("hunter2", key);
    const raw = Buffer.from(stored.slice(3), "base64");
    raw[raw.length - 1] ^= 0xff;
    expect(() => decryptSecret(`v1:${raw.toString("base64")}`, key)).toThrow();
  });

  it("rejects unknown formats and truncated values", () => {
    expect(() => decryptSecret("v9:abcd", key)).toThrow();
    expect(() => decryptSecret("plain", key)).toThrow();
    expect(() => decryptSecret("v1:AAAA", key)).toThrow();
  });
});
