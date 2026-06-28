"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type PriceAlertActionResult = {
  ok: boolean;
  message: string;
  requiresAuth?: boolean;
};

export async function createPriceAlert(input: {
  productId: string;
  targetPrice: number;
}): Promise<PriceAlertActionResult> {
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
      message: "Fiyat alarmı kurmak için giriş yapmalısınız.",
    };
  }

  const productId = Number(input.productId);
  const targetPrice = Number(input.targetPrice);

  if (!Number.isInteger(productId) || productId <= 0) {
    return { ok: false, message: "Geçersiz ürün seçimi." };
  }
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    return { ok: false, message: "Geçerli bir hedef fiyat girin." };
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    return {
      ok: false,
      message: productError?.message ?? "Ürün bulunamadı.",
    };
  }

  const { data: existingAlert, error: lookupError } = await supabase
    .from("price_alerts")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .eq("target_price", targetPrice)
    .eq("status", "active")
    .maybeSingle();

  if (lookupError) {
    console.error("Price alert lookup failed:", lookupError);
    return { ok: false, message: lookupError.message };
  }

  if (existingAlert) {
    return {
      ok: true,
      message: "Bu hedef fiyat için aktif alarmın zaten var.",
    };
  }

  const { data: currentListing, error: currentPriceError } = await supabase
    .from("listings")
    .select("price")
    .eq("product_id", productId)
    .in("status", ["published", "active"])
    .order("price", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (currentPriceError) {
    console.error("Price alert current price lookup failed:", currentPriceError);
  }

  const { error: insertError } = await supabase.from("price_alerts").insert({
    user_id: user.id,
    product_id: productId,
    target_price: targetPrice,
    current_price: currentListing?.price ? Number(currentListing.price) : null,
    status: "active",
  });

  if (insertError) {
    console.error("Price alert insert failed:", insertError);
    return { ok: false, message: insertError.message };
  }

  revalidatePath("/hesabim");

  return {
    ok: true,
    message: "Fiyat alarmın oluşturuldu.",
  };
}

export async function deactivatePriceAlert(
  alertId: string,
): Promise<PriceAlertActionResult> {
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
    .from("price_alerts")
    .update({ status: "cancelled" })
    .eq("id", alertId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Price alert cancel failed:", error);
    return { ok: false, message: error.message };
  }

  revalidatePath("/hesabim");
  return { ok: true, message: "Fiyat alarmı iptal edildi." };
}
