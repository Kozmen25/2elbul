import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when the given user id has a real grant row in `public.admin_roles`.
 *
 * FAIL-SAFE: any query error (migration not applied, DB down, service role
 * missing) resolves to `false` — never throws. The caller combines this with
 * the env allow-list (isAdminEmail), so a bad migration can never lock every
 * admin out and can never open the panel to everyone.
 */
export async function isDbAdmin(
  adminClient: SupabaseClient | null,
  userId: string,
): Promise<boolean> {
  if (!adminClient) return false;
  try {
    const { data, error } = await adminClient
      .from("admin_roles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}
