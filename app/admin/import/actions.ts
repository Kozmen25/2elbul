"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminUser } from "@/lib/admin";
import { normalizeImageUrls } from "@/lib/bots/image-urls";
import { createListingExternalId } from "@/lib/bots/listing-sync";
import { LISTING_CONDITIONS, LISTING_SOURCES } from "@/lib/listings";

export type ImportError = {
  index: number;
  title: string;
  message: string;
};

export type AdminImportState = {
  status: "idle" | "success" | "error";
  message: string;
  imported: number;
  existing: number;
  failed: number;
  errors: ImportError[];
};

type ImportListing = {
  productName: string;
  title: string;
  price: number;
  city: string;
  source: string;
  url: string;
  condition: string;
  imageUrl: string | null;
  imageUrls: string[];
};

const allowedConditions = new Set<string>(LISTING_CONDITIONS);
const allowedSources = new Set<string>(LISTING_SOURCES);

export async function importAdminListings(
  _previousState: AdminImportState,
  formData: FormData,
): Promise<AdminImportState> {
  await requireAdminUser("/admin/import");

  const rawJson = String(formData.get("json") ?? "").trim();
  if (!rawJson) {
    return emptyResult("error", "JSON alanı boş bırakılamaz.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawJson);
  } catch (error) {
    console.error("Admin import JSON parse failed:", error);
    return emptyResult("error", "Geçerli bir JSON dizisi girin.");
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    return emptyResult("error", "JSON, en az bir ilan içeren bir dizi olmalıdır.");
  }

  if (payload.length > 500) {
    return emptyResult("error", "Tek seferde en fazla 500 ilan aktarabilirsiniz.");
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return emptyResult(
      "error",
      "Supabase admin bağlantısı yapılandırılmamış. SUPABASE_SERVICE_ROLE_KEY değerini kontrol edin.",
    );
  }

  const result: AdminImportState = {
    status: "success",
    message: "",
    imported: 0,
    existing: 0,
    failed: 0,
    errors: [],
  };

  for (const [index, rawRecord] of payload.entries()) {
    let listing: ImportListing;

    try {
      listing = normalizeListing(rawRecord);
    } catch (error) {
      addError(result, index, getRecordTitle(rawRecord), error);
      continue;
    }

    const { data: existingListings, error: duplicateError } = await supabase
      .from("listings")
      .select("id")
      .eq("url", listing.url)
      .limit(1);

    if (duplicateError) {
      console.error("Supabase admin import duplicate check failed:", duplicateError);
      addError(result, index, listing.title, duplicateError);
      continue;
    }

    if ((existingListings ?? []).length > 0) {
      result.existing += 1;
      continue;
    }

    let productId: string | number;
    const { data: existingProduct, error: productLookupError } = await supabase
      .from("products")
      .select("id")
      .eq("name", listing.productName)
      .maybeSingle();

    if (productLookupError) {
      console.error("Supabase admin import product lookup failed:", productLookupError);
      addError(result, index, listing.title, productLookupError);
      continue;
    }

    if (existingProduct) {
      productId = existingProduct.id;
    } else {
      const { data: createdProduct, error: productInsertError } = await supabase
        .from("products")
        .insert({ name: listing.productName })
        .select("id")
        .single();

      if (productInsertError || !createdProduct) {
        if (productInsertError) {
          console.error(
            "Supabase admin import product insert failed:",
            productInsertError,
          );
        }
        addError(
          result,
          index,
          listing.title,
          productInsertError ?? new Error("Ürün oluşturulamadı."),
        );
        continue;
      }

      productId = createdProduct.id;
    }

    const { error: listingInsertError } = await supabase
      .from("listings")
      .insert({
        product_id: productId,
        external_id: createListingExternalId(listing.url),
        title: listing.title,
        price: listing.price,
        city: listing.city,
        source: listing.source,
        url: listing.url,
        condition: listing.condition,
        image_url: listing.imageUrl,
        status: "published",
        imported_at: new Date().toISOString(),
        raw_payload: rawRecord,
      });

    if (listingInsertError) {
      console.error("Supabase admin listing insert failed:", listingInsertError);
      addError(result, index, listing.title, listingInsertError);
      continue;
    }

    result.imported += 1;
  }

  result.message =
    result.failed > 0
      ? "Aktarım tamamlandı, bazı kayıtlar eklenemedi."
      : "İlan aktarımı başarıyla tamamlandı.";

  return result;
}

function normalizeListing(value: unknown): ImportListing {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Kayıt bir JSON nesnesi olmalıdır.");
  }

  const record = value as Record<string, unknown>;
  const productName = readRequiredString(record, "product_name");
  const title = readRequiredString(record, "title");
  const city = readRequiredString(record, "city");
  const source = readRequiredString(record, "source");
  const condition = readRequiredString(record, "condition");
  const url = readRequiredString(record, "url");
  const price = parsePrice(record.price);
  const imageUrl = readOptionalString(record, "image_url");
  const galleryUrls = normalizeImageUrls(record.image_urls);

  if (!allowedConditions.has(condition)) {
    throw new Error(
      `condition desteklenmiyor. Geçerli değerler: ${LISTING_CONDITIONS.join(", ")}.`,
    );
  }

  if (!allowedSources.has(source)) {
    throw new Error(
      `source desteklenmiyor. Geçerli değerler: ${LISTING_SOURCES.join(", ")}.`,
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("url geçerli bir bağlantı olmalıdır.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("url yalnızca http veya https olabilir.");
  }

  if (imageUrl) {
    try {
      const parsedImageUrl = new URL(imageUrl);
      if (!["http:", "https:"].includes(parsedImageUrl.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error("image_url geçerli bir http veya https bağlantısı olmalıdır.");
    }
  }
  const imageUrls = normalizeImageUrls([
    ...(imageUrl ? [imageUrl] : []),
    ...galleryUrls,
  ]);

  return {
    productName,
    title,
    price,
    city,
    source,
    url,
    condition,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
  };
}

function readRequiredString(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} alanı eksik.`);
  }
  return value.trim();
}

function readOptionalString(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${field} metin olmalıdır.`);
  }
  return value.trim() || null;
}

function parsePrice(value: unknown) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("price pozitif bir sayı olmalıdır.");
    }
    return value;
  }

  const rawValue = String(value ?? "")
    .trim()
    .replace(/[^\d,.-]/g, "");
  const normalizedValue = rawValue.includes(",")
    ? rawValue.replace(/\./g, "").replace(",", ".")
    : rawValue;
  const normalized = Number(normalizedValue);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("price pozitif bir sayı olmalıdır.");
  }

  return normalized;
}

function addError(
  result: AdminImportState,
  index: number,
  title: string,
  error: unknown,
) {
  result.failed += 1;
  result.errors.push({
    index,
    title,
    message: error instanceof Error ? error.message : "Bilinmeyen hata",
  });
}

function getRecordTitle(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Geçersiz kayıt";
  }

  const title = (value as Record<string, unknown>).title;
  return typeof title === "string" && title.trim()
    ? title.trim()
    : "Başlıksız kayıt";
}

function emptyResult(
  status: "error" | "success",
  message: string,
): AdminImportState {
  return {
    status,
    message,
    imported: 0,
    existing: 0,
    failed: 0,
    errors: [],
  };
}
