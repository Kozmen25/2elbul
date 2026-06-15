"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export type SubmissionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const allowedSources = new Set([
  "Sahibinden",
  "Letgo",
  "Facebook Marketplace",
  "Dolap",
]);

const allowedConditions = new Set([
  "Sıfır",
  "Yeni gibi",
  "Çok iyi",
  "İyi",
  "İkinci El",
  "Kullanılmış",
]);

export async function submitListing(
  _previousState: SubmissionState,
  formData: FormData,
): Promise<SubmissionState> {
  const productIdValue = String(formData.get("product_id") ?? "").trim();
  const productId = Number(productIdValue);
  const title = String(formData.get("title") ?? "").trim();
  const priceValue = String(formData.get("price") ?? "").trim();
  const price = parsePrice(priceValue);
  const city = String(formData.get("city") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim();
  const condition = String(formData.get("condition") ?? "").trim();

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !title ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !city ||
    !allowedSources.has(source) ||
    !allowedConditions.has(condition)
  ) {
    return {
      status: "error",
      message: "Lütfen tüm alanları geçerli bilgilerle doldurun.",
    };
  }

  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Unsupported protocol");
    }
  } catch {
    return {
      status: "error",
      message: "Lütfen geçerli bir ilan bağlantısı girin.",
    };
  }

  if (imageUrl && !isHttpUrl(imageUrl)) {
    return {
      status: "error",
      message: "Görsel linki geçerli bir http veya https adresi olmalıdır.",
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: "Supabase bağlantısı yapılandırılmamış.",
    };
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    if (productError) {
      console.error("Supabase product lookup failed:", productError);
    }
    return {
      status: "error",
      message: productError
        ? `Ürün doğrulanamadı: ${productError.message}`
        : "Seçilen ürün bulunamadı. Ürün listesini yenileyip tekrar deneyin.",
    };
  }

  const { error } = await supabase.from("listings").insert({
    product_id: productId,
    title,
    price,
    city,
    source,
    url,
    condition,
    image_url: imageUrl || null,
  });

  if (error) {
    console.error("Supabase listing insert failed:", error);
    return {
      status: "error",
      message: `İlan kaydedilemedi: ${error.message}`,
    };
  }

  return {
    status: "success",
    message: "İlan başarıyla alındı, onaydan sonra yayınlanacak",
  };
}

function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function parsePrice(value: string) {
  if (!value) return Number.NaN;

  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;

  return Number(normalized);
}
