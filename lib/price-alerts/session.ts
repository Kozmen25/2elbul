import { createSupabaseServerClient } from "@/lib/supabase-server";

export type AlertSession = {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  userId: string;
};

/** The signed-in user and their RLS-scoped client, or null when logged out. */
export async function getAlertSession(): Promise<
  { ok: true; session: AlertSession } | { ok: false; reason: "unconfigured" | "unauthenticated" }
> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, reason: "unauthenticated" };

  return { ok: true, session: { supabase, userId: data.user.id } };
}
