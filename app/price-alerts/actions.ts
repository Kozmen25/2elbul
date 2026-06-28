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
    .eq("is_active", true)
    .maybeSingle();

  if (lookupError) {
    console.error("Price alert lookup failed:", lookupError);
    return { ok: false, message: lookupError.message };
  }

  if (existingAlert) {
    const { error: updateError } = await supabase
      .from("price_alerts")
      .update({ target_price: targetPrice })
      .eq("id", existingAlert.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Price alert update failed:", updateError);
      return { ok: false, message: updateError.message };
    }
  } else {
    const { error: insertError } = await supabase.from("price_alerts").insert({
      user_id: user.id,
      product_id: productId,
      target_price: targetPrice,
      is_active: true,
    });

    if (insertError) {
      console.error("Price alert insert failed:", insertError);
      return { ok: false, message: insertError.message };
    }
  }

  revalidatePath("/hesabim");

  return {
    ok: true,
    message: `Fiyat alarmı kaydedildi: ${formatTry(targetPrice)} ve altı.`,
  };
}

export async function deactivatePriceAlert(
  alertId: number,
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
    .update({ is_active: false })
    .eq("id", alertId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Price alert deactivate failed:", error);
    return { ok: false, message: error.message };
  }

  revalidatePath("/hesabim");
  return { ok: true, message: "Fiyat alarmı kaldırıldı." };
}

function formatTry(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}
