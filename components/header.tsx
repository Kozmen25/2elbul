import { createSupabaseServerClient } from "@/lib/supabase-server";
import { HeaderClient } from "@/components/header-client";

export async function Header() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  return <HeaderClient userEmail={data.user?.email ?? null} />;
}
