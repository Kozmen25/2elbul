import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
  const includeUnreadCount = searchParams.get("unread_count") === "true";

  const { data, error } = await auth.supabase
    .from("user_notifications")
    .select("*")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Notifications list failed:", error);
    return NextResponse.json(
      { ok: false, error: "Bildirimler okunamadı." },
      { status: 500 },
    );
  }

  const result: Record<string, unknown> = {
    ok: true,
    notifications: data ?? [],
    limit,
    offset,
  };

  if (includeUnreadCount) {
    const { count } = await auth.supabase
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", auth.userId)
      .is("read_at", null);

    result.unreadCount = count ?? 0;
  }

  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as
    | { id?: string; all?: boolean }
    | null;

  const markAll = body?.all === true;
  const singleId = body?.id;

  if (!markAll && !singleId) {
    return NextResponse.json(
      { ok: false, error: "Bildirim kimliği veya 'all: true' gerekli." },
      { status: 400 },
    );
  }

  let query = auth.supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", auth.userId)
    .is("read_at", null);

  if (singleId) {
    query = query.eq("id", singleId);
  }

  const { data: updatedData, error } = await query.select();

  if (error) {
    console.error("Notifications update failed:", error);
    return NextResponse.json(
      { ok: false, error: "Bildirimler güncellenemedi." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    updated: updatedData?.length ?? 0,
    message: `Bildirimler okundu olarak işaretlendi.`,
  });
}

async function getAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Supabase bağlantısı yapılandırılmamış." },
        { status: 500 },
      ),
    } as const;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Bu işlem için giriş yapmalısınız." },
        { status: 401 },
      ),
    } as const;
  }

  return { supabase, userId: data.user.id, error: null } as const;
}
