import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

export async function requireAdminUser(nextPath = "/admin") {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = (await supabase?.auth.getUser()) ?? {
    data: { user: null },
    error: null,
  };

  if (error) {
    console.error("Supabase admin auth check failed:", error);
  }

  if (!user) {
    redirect(`/giris?next=${encodeURIComponent(nextPath)}`);
  }

  if (!isAdminEmail(user.email)) {
    redirect("/");
  }

  return user;
}
