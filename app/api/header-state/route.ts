import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export type HeaderState = {
  userEmail: string | null;
  unreadCount: number;
  displayName: string | null;
  avatarUrl: string | null;
};

const GUEST_STATE: HeaderState = {
  userEmail: null,
  unreadCount: 0,
  displayName: null,
  avatarUrl: null,
};

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

/** Signed-in user details for the site header (kept out of page rendering). */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  const user = data.user;
  if (!supabase || !user) {
    return NextResponse.json(GUEST_STATE, { headers: PRIVATE_HEADERS });
  }

  const [unread, profile] = await Promise.all([
    supabase
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const state: HeaderState = {
    userEmail: user.email ?? null,
    unreadCount: unread.count ?? 0,
    displayName: profile.data?.display_name ?? null,
    avatarUrl: profile.data?.avatar_url ?? null,
  };
  return NextResponse.json(state, { headers: PRIVATE_HEADERS });
}
