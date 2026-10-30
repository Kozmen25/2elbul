// Env allow-list of admin e-mails (ADMIN_EMAILS, comma separated).
// Dependency-free so both the middleware and server components can use it.

const DEFAULT_ADMIN_EMAILS = [
  "kozmen25@gmail.com",
  "ozmebomer9@gmail.com",
];

function parseAdminEmails() {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return DEFAULT_ADMIN_EMAILS;

  const parsed = raw
    .split(",")
    .map((email) => email.trim().toLocaleLowerCase("en-US"))
    .filter(Boolean);

  return parsed.length ? parsed : DEFAULT_ADMIN_EMAILS;
}

const adminEmails = new Set(parseAdminEmails());

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return adminEmails.has(email.trim().toLocaleLowerCase("en-US"));
}

export const ADMIN_EMAILS = [...adminEmails];
