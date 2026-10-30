import { redirect } from "next/navigation";
import { isDbAdmin } from "@/lib/auth/db-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAdminEmail } from "@/lib/auth/admin-emails";

export { ADMIN_EMAILS, isAdminEmail } from "@/lib/auth/admin-emails";

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

  // Dual gate: env allow-list OR a real DB grant row. Fail-safe — if the
  // admin_roles query ever throws, isDbAdmin() returns false and the env
  // allow-list still decides (a broken migration can never lock admins out).
  const dbAdmin = await isDbAdmin(createSupabaseAdminClient(), user.id);

  if (!(isAdminEmail(user.email) || dbAdmin)) {
    redirect("/");
  }

  return user;
}
