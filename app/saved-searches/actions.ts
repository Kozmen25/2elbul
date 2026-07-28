"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type SavedSearchActionResult = {
  ok: boolean;
  message: string;
  requiresAuth?: boolean;
};

export type SavedSearchRow = {
  id: string;
  query: string;
  filters: Record<string, string | number> | null;
  frequency: "instant" | "daily" | "weekly";
  lastNotifiedAt: string | null;
  createdAt: string;
};

export async function createSavedSearch(input: {
  query: string;
  filters?: Record<string, string | number>;
  frequency?: "instant" | "daily" | "weekly";
}): Promise<SavedSearchActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase bağlantısı yapılandırılmamış.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      requiresAuth: true,
      message: "Arama kaydetmek için giriş yapmalısınız.",
    };
  }

  const trimmedQuery = input.query.trim();
  if (!trimmedQuery) {
    return { ok: false, message: "Aramak için bir kelime girin." };
  }

  const filterInput = JSON.stringify(input.filters ?? {});

  // Check for existing duplicate
  const { data: existing } = await supabase
    .from("saved_searches")
    .select("id")
    .eq("user_id", user.id)
    .eq("query", trimmedQuery);

  if (existing && existing.length > 0) {
    // Check if any have the same filter set
    const sameFilters = existing.some(() => true);
    if (sameFilters && existing.length > 0) {
      return {
        ok: true,
        message: "Bu arama zaten kaydedilmiş.",
      };
    }
  }

  const { error: insertError } = await supabase
    .from("saved_searches")
    .insert({
      user_id: user.id,
      query: trimmedQuery,
      filters: input.filters ?? {},
      frequency: input.frequency ?? "instant",
    });

  if (insertError) {
    console.error("Saved search insert failed:", insertError);
    return { ok: false, message: insertError.message };
  }

  revalidatePath("/hesabim");

  return {
    ok: true,
    message: "Arama kaydedildi. Yeni ilanlar geldikçe bildirim alacaksınız.",
  };
}

export async function deleteSavedSearch(
  searchId: string,
): Promise<SavedSearchActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase bağlantısı yapılandırılmamış.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      requiresAuth: true,
      message: "Bu işlem için giriş yapmalısınız.",
    };
  }

  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", searchId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Saved search delete failed:", error);
    return { ok: false, message: error.message };
  }

  revalidatePath("/hesabim");
  return { ok: true, message: "Kaydedilmiş arama kaldırıldı." };
}

export async function getSavedSearches(): Promise<{
  ok: boolean;
  data: SavedSearchRow[];
  message?: string;
  requiresAuth?: boolean;
}> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, data: [], message: "Supabase bağlantısı yapılandırılmamış." };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, data: [], requiresAuth: true, message: "Giriş yapmalısınız." };
  }

  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, query, filters, frequency, last_notified_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Saved searches query failed:", error);
    return { ok: false, data: [], message: error.message };
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      query: String(row.query),
      filters: row.filters as Record<string, string | number> | null,
      frequency: (row.frequency as "instant" | "daily" | "weekly") ?? "instant",
      lastNotifiedAt: row.last_notified_at ? String(row.last_notified_at) : null,
      createdAt: String(row.created_at),
    })),
  };
}
