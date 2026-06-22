import type {
  ImportAdapter,
  ImportSource,
  NormalizedImportListing,
  RawImportListing,
} from "@/lib/import/types";
import type { ListingCondition } from "@/lib/listings";
import { normalizeImageUrls } from "@/lib/bots/image-urls";

const conditionAliases: Record<string, ListingCondition> = {
  sıfır: "Sıfır",
  yeni: "Sıfır",
  "yeni gibi": "Yeni gibi",
  "çok iyi": "Çok iyi",
  iyi: "İyi",
  "ikinci el": "İkinci El",
  kullanılmış: "Kullanılmış",
  yenilenmiş: "Yenilenmiş",
  refurbished: "Yenilenmiş",
};

function readString(
  payload: RawImportListing,
  keys: string[],
  fieldName: string,
): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  throw new Error(`${fieldName} alanı eksik.`);
}

function readOptionalString(
  payload: RawImportListing,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readPrice(payload: RawImportListing): number {
  const rawValue =
    payload.price ?? payload.fiyat ?? payload.amount ?? payload.listing_price;
  const normalized =
    typeof rawValue === "number"
      ? rawValue
      : Number(
          String(rawValue ?? "")
            .replace(/[^\d,.-]/g, "")
            .replace(/\./g, "")
            .replace(",", "."),
        );

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Geçerli bir fiyat bulunamadı.");
  }

  return normalized;
}

function readUrl(payload: RawImportListing, source: ImportSource): string {
  const value = readString(
    payload,
    ["url", "listing_url", "link", "webUrl"],
    "url",
  );
  const parsedUrl = new URL(value);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("İlan URL protokolü geçersiz.");
  }

  const allowedHosts: Record<ImportSource, string[]> = {
    Sahibinden: ["sahibinden.com"],
    Letgo: ["letgo.com"],
    "Facebook Marketplace": ["facebook.com", "fb.com"],
    EasyCep: ["easycep.com"],
    Getmobil: ["getmobil.com"],
    "Yenilenmiş Market": ["yenilenmismarket.com"],
    "Teknosa Yenilenmiş": ["teknosa.com"],
    "Hepsiburada Yenilenmiş": ["hepsiburada.com"],
    "MediaMarkt Yenilenmiş": ["mediamarkt.com.tr"],
  };

  if (
    !allowedHosts[source].some(
      (host) =>
        parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`),
    )
  ) {
    throw new Error(`URL ${source} alan adına ait değil.`);
  }

  return parsedUrl.toString();
}

function normalizeCondition(payload: RawImportListing): ListingCondition {
  const rawCondition =
    readOptionalString(payload, ["condition", "durum", "item_condition"]) ??
    "İkinci El";
  return (
    conditionAliases[rawCondition.toLocaleLowerCase("tr-TR")] ?? "İkinci El"
  );
}

function normalizeCommon(
  source: ImportSource,
  payload: RawImportListing,
  aliases: {
    id: string[];
    productName: string[];
    title: string[];
    city: string[];
  },
): NormalizedImportListing {
  const imageUrl = readOptionalString(payload, [
    "image_url",
    "imageUrl",
    "image",
    "main_image",
    "thumbnail",
  ]);
  const imageUrls = normalizeImageUrls([
    ...(imageUrl ? [imageUrl] : []),
    ...normalizeImageUrls(
      payload.image_urls ??
        payload.imageUrls ??
        payload.images ??
        payload.gallery,
    ),
  ]);

  return {
    externalId: readString(payload, aliases.id, "externalId"),
    productName: readString(payload, aliases.productName, "productName"),
    category: readOptionalString(payload, ["category", "kategori"]),
    title: readString(payload, aliases.title, "title"),
    price: readPrice(payload),
    city: readString(payload, aliases.city, "city"),
    source,
    url: readUrl(payload, source),
    condition: normalizeCondition(payload),
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    publishedAt: readOptionalString(payload, [
      "publishedAt",
      "published_at",
      "createdAt",
      "created_at",
      "date",
    ]),
    rawPayload: payload,
  };
}

export const importAdapters: Record<ImportSource, ImportAdapter> = {
  Sahibinden: {
    source: "Sahibinden",
    normalize: (payload) =>
      normalizeCommon("Sahibinden", payload, {
        id: ["externalId", "external_id", "listingId", "ilan_no", "id"],
        productName: ["productName", "product_name", "urun", "model"],
        title: ["title", "baslik", "ilan_basligi"],
        city: ["city", "sehir", "location"],
      }),
  },
  Letgo: {
    source: "Letgo",
    normalize: (payload) =>
      normalizeCommon("Letgo", payload, {
        id: ["externalId", "external_id", "listingId", "itemId", "id"],
        productName: ["productName", "product_name", "model", "name"],
        title: ["title", "name", "listing_title"],
        city: ["city", "location", "region"],
      }),
  },
  "Facebook Marketplace": {
    source: "Facebook Marketplace",
    normalize: (payload) =>
      normalizeCommon("Facebook Marketplace", payload, {
        id: ["externalId", "external_id", "listingId", "marketplace_id", "id"],
        productName: ["productName", "product_name", "model", "name"],
        title: ["title", "name", "listing_title"],
        city: ["city", "location", "marketplace_city"],
      }),
  },
  EasyCep: createRefurbishedAdapter("EasyCep"),
  Getmobil: createRefurbishedAdapter("Getmobil"),
  "Yenilenmiş Market": createRefurbishedAdapter("Yenilenmiş Market"),
  "Teknosa Yenilenmiş": createRefurbishedAdapter("Teknosa Yenilenmiş"),
  "Hepsiburada Yenilenmiş": createRefurbishedAdapter(
    "Hepsiburada Yenilenmiş",
  ),
  "MediaMarkt Yenilenmiş": createRefurbishedAdapter(
    "MediaMarkt Yenilenmiş",
  ),
};

function createRefurbishedAdapter(source: ImportSource): ImportAdapter {
  return {
    source,
    normalize: (payload) => {
      const normalized = normalizeCommon(source, payload, {
        id: ["externalId", "external_id", "listingId", "sku", "id"],
        productName: ["productName", "product_name", "model", "name"],
        title: ["title", "name", "listing_title"],
        city: ["city", "location", "region"],
      });
      return {
        ...normalized,
        condition:
          normalized.condition === "İkinci El"
            ? "Yenilenmiş"
            : normalized.condition,
      };
    },
  };
}
