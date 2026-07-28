import { createSupabaseServerClient } from "@/lib/supabase-server";
import { HeaderClient } from "@/components/header-client";

export async function Header() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  const userEmail = data.user?.email ?? null;

  let unreadCount = 0;
  if (supabase && data.user) {
    const { count } = await supabase
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .is("read_at", null);
    unreadCount = count ?? 0;
  }

  return <HeaderClient userEmail={userEmail} unreadCount={unreadCount} />;
}
