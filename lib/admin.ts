const adminEmails = new Set([
  "kozmen25@gmail.com",
  "ozmebomer9@gmail.com",
]);

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return adminEmails.has(email.trim().toLocaleLowerCase("en-US"));
}
