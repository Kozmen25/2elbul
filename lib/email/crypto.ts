// Encryption for the SMTP password stored in email_settings.
// AES-256-GCM with a random 12-byte IV per value; the key comes from the
// EMAIL_SETTINGS_ENCRYPTION_KEY environment variable and is never stored in
// the database, so a database leak alone does not expose the SMTP password.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Parses a base64 key that decodes to exactly 32 bytes; null when absent or malformed. */
export function parseEncryptionKey(raw: string | undefined | null): Buffer | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const key = Buffer.from(trimmed, "base64");
  return key.length === KEY_BYTES ? key : null;
}

export function getEncryptionKey(): Buffer | null {
  return parseEncryptionKey(process.env.EMAIL_SETTINGS_ENCRYPTION_KEY);
}

export function generateEncryptionKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

/** Throws when the key is wrong or the value was tampered with (GCM authentication). */
export function decryptSecret(payload: string, key: Buffer): string {
  const [version, body] = payload.split(":");
  if (version !== VERSION || !body) throw new Error("Unsupported encrypted value format.");
  const raw = Buffer.from(body, "base64");
  if (raw.length < IV_BYTES + TAG_BYTES) throw new Error("Encrypted value is truncated.");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}
