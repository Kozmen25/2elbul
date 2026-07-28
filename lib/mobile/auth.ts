import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mobileError } from "@/lib/mobile/response";
import type { NextResponse } from "next/server";

type AuthSuccess = {
  supabase: SupabaseClient;
  userId: string;
  error: null;
};

type AuthFailure = {
  supabase: null;
  userId: null;
  error: NextResponse;
};

export async function getAuthenticatedClient(): Promise<AuthSuccess | AuthFailure> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      supabase: null,
      userId: null,
      error: mobileError("Supabase bağlantısı yapılandırılmamış.", 500),
    };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return {
      supabase: null,
      userId: null,
      error: mobileError("Bu işlem için giriş yapmalısınız.", 401),
    };
  }

  return { supabase, userId: data.user.id, error: null };
}

export async function getOptionalUser(): Promise<{
  supabase: SupabaseClient | null;
  userId: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, userId: null };

  const { data } = await supabase.auth.getUser();
  return { supabase, userId: data?.user?.id ?? null };
}
