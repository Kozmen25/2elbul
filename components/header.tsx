import { createSupabaseServerClient } from "@/lib/supabase-server";
import { HeaderClient } from "@/components/header-client";

export async function Header() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  const userEmail = data.user?.email ?? null;

  let unreadCount = 0;
  let profile: { display_name: string | null; avatar_url: string | null } | null = null;
  if (supabase && data.user) {
    const unread = await supabase
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .is("read_at", null);
    unreadCount = unread.count ?? 0;

    const { data: row } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", data.user.id)
      .maybeSingle();
    profile = row ?? null;
  }

  return (
    <HeaderClient
      userEmail={userEmail}
      unreadCount={unreadCount}
      displayName={profile?.display_name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
    />
  );
}
