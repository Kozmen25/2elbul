import type { BotAdapterListing } from "@/lib/bots/types";
import type { RawImportListing, ImportSource } from "@/lib/import/types";

/** A product template used to generate varied listings at scale. */
export interface ProductTemplate {
  productName: string;
  brand: string;
  category: string;
  basePrice: number;
  hasStorageVariants: boolean;
  storageOptions: string[];
}

/**
 * 50 product templates covering ~40% Apple, ~30% Samsung,
 * ~20% Xiaomi, ~10% other brands — realistic Turkish second-hand market.
 */
const PRODUCT_CATALOG: ProductTemplate[] = [
  // ── Apple (20 products) ──
  { productName: "iPhone 11", brand: "apple", category: "Telefon", basePrice: 8999, hasStorageVariants: true, storageOptions: ["64gb", "128gb"] },
  { productName: "iPhone 12", brand: "apple", category: "Telefon", basePrice: 10999, hasStorageVariants: true, storageOptions: ["64gb", "128gb"] },
  { productName: "iPhone 12 Mini", brand: "apple", category: "Telefon", basePrice: 9999, hasStorageVariants: true, storageOptions: ["64gb", "128gb"] },
  { productName: "iPhone 13", brand: "apple", category: "Telefon", basePrice: 12999, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "iPhone 13 Mini", brand: "apple", category: "Telefon", basePrice: 11999, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "iPhone 13 Pro", brand: "apple", category: "Telefon", basePrice: 17999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb"] },
  { productName: "iPhone 13 Pro Max", brand: "apple", category: "Telefon", basePrice: 20999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb", "1024gb"] },
  { productName: "iPhone 14", brand: "apple", category: "Telefon", basePrice: 14999, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "iPhone 14 Plus", brand: "apple", category: "Telefon", basePrice: 16499, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "iPhone 14 Pro", brand: "apple", category: "Telefon", basePrice: 22999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb", "1024gb"] },
  { productName: "iPhone 14 Pro Max", brand: "apple", category: "Telefon", basePrice: 25999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb", "1024gb"] },
  { productName: "iPhone 15", brand: "apple", category: "Telefon", basePrice: 17999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb"] },
  { productName: "iPhone 15 Plus", brand: "apple", category: "Telefon", basePrice: 19999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb"] },
  { productName: "iPhone 15 Pro", brand: "apple", category: "Telefon", basePrice: 27999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb", "1024gb"] },
  { productName: "iPhone 15 Pro Max", brand: "apple", category: "Telefon", basePrice: 32999, hasStorageVariants: true, storageOptions: ["256gb", "512gb", "1024gb"] },
  { productName: "iPhone 16", brand: "apple", category: "Telefon", basePrice: 21999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb"] },
  { productName: "iPhone 16 Plus", brand: "apple", category: "Telefon", basePrice: 23999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb"] },
  { productName: "iPhone 16 Pro", brand: "apple", category: "Telefon", basePrice: 32999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb", "1024gb"] },
  { productName: "iPhone 16 Pro Max", brand: "apple", category: "Telefon", basePrice: 37999, hasStorageVariants: true, storageOptions: ["256gb", "512gb", "1024gb"] },
  { productName: "MacBook Air M3", brand: "apple", category: "Laptop", basePrice: 24999, hasStorageVariants: true, storageOptions: ["256gb", "512gb", "1024gb"] },

  // ── Samsung (15 products) ──
  { productName: "Samsung Galaxy S23", brand: "samsung", category: "Telefon", basePrice: 11999, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Samsung Galaxy S23 Plus", brand: "samsung", category: "Telefon", basePrice: 14999, hasStorageVariants: true, storageOptions: ["256gb", "512gb"] },
  { productName: "Samsung Galaxy S23 Ultra", brand: "samsung", category: "Telefon", basePrice: 20999, hasStorageVariants: true, storageOptions: ["256gb", "512gb", "1024gb"] },
  { productName: "Samsung Galaxy S24", brand: "samsung", category: "Telefon", basePrice: 13999, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Samsung Galaxy S24 Plus", brand: "samsung", category: "Telefon", basePrice: 16999, hasStorageVariants: true, storageOptions: ["256gb", "512gb"] },
  { productName: "Samsung Galaxy S24 Ultra", brand: "samsung", category: "Telefon", basePrice: 25999, hasStorageVariants: true, storageOptions: ["256gb", "512gb", "1024gb"] },
  { productName: "Samsung Galaxy A54", brand: "samsung", category: "Telefon", basePrice: 6999, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Samsung Galaxy A55", brand: "samsung", category: "Telefon", basePrice: 8499, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Samsung Galaxy A35", brand: "samsung", category: "Telefon", basePrice: 6499, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Samsung Galaxy Z Fold5", brand: "samsung", category: "Telefon", basePrice: 29999, hasStorageVariants: true, storageOptions: ["256gb", "512gb", "1024gb"] },
  { productName: "Samsung Galaxy Z Flip5", brand: "samsung", category: "Telefon", basePrice: 17999, hasStorageVariants: true, storageOptions: ["256gb", "512gb"] },
  { productName: "Samsung Galaxy Z Fold6", brand: "samsung", category: "Telefon", basePrice: 34999, hasStorageVariants: true, storageOptions: ["256gb", "512gb", "1024gb"] },
  { productName: "Samsung Galaxy Z Flip6", brand: "samsung", category: "Telefon", basePrice: 19999, hasStorageVariants: true, storageOptions: ["256gb", "512gb"] },
  { productName: "Samsung Galaxy Tab S9", brand: "samsung", category: "Tablet", basePrice: 14999, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Samsung Galaxy S25 Ultra", brand: "samsung", category: "Telefon", basePrice: 29999, hasStorageVariants: true, storageOptions: ["256gb", "512gb", "1024gb"] },

  // ── Xiaomi (10 products) ──
  { productName: "Xiaomi Redmi Note 12", brand: "xiaomi", category: "Telefon", basePrice: 4999, hasStorageVariants: true, storageOptions: ["64gb", "128gb"] },
  { productName: "Xiaomi Redmi Note 12 Pro", brand: "xiaomi", category: "Telefon", basePrice: 6499, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Xiaomi Redmi Note 13", brand: "xiaomi", category: "Telefon", basePrice: 5999, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Xiaomi Redmi Note 13 Pro", brand: "xiaomi", category: "Telefon", basePrice: 7999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb"] },
  { productName: "Xiaomi Redmi Note 13 Pro Plus", brand: "xiaomi", category: "Telefon", basePrice: 9499, hasStorageVariants: true, storageOptions: ["256gb", "512gb"] },
  { productName: "Xiaomi Poco X6", brand: "xiaomi", category: "Telefon", basePrice: 7499, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Xiaomi Poco X7", brand: "xiaomi", category: "Telefon", basePrice: 8999, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Xiaomi Poco X7 Pro", brand: "xiaomi", category: "Telefon", basePrice: 10999, hasStorageVariants: true, storageOptions: ["256gb", "512gb"] },
  { productName: "Xiaomi 14T", brand: "xiaomi", category: "Telefon", basePrice: 13999, hasStorageVariants: true, storageOptions: ["256gb", "512gb"] },
  { productName: "Xiaomi Pad 6", brand: "xiaomi", category: "Tablet", basePrice: 8499, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },

  // ── Other brands (5 products) ──
  { productName: "Google Pixel 8", brand: "google", category: "Telefon", basePrice: 12999, hasStorageVariants: true, storageOptions: ["128gb", "256gb"] },
  { productName: "Google Pixel 9 Pro", brand: "google", category: "Telefon", basePrice: 19999, hasStorageVariants: true, storageOptions: ["128gb", "256gb", "512gb"] },
  { productName: "OnePlus 12", brand: "oneplus", category: "Telefon", basePrice: 15999, hasStorageVariants: true, storageOptions: ["256gb", "512gb"] },
  { productName: "OnePlus 13", brand: "oneplus", category: "Telefon", basePrice: 18999, hasStorageVariants: true, storageOptions: ["256gb", "512gb"] },
  { productName: "Huawei P60 Pro", brand: "huawei", category: "Telefon", basePrice: 14999, hasStorageVariants: true, storageOptions: ["256gb", "512gb"] },
];

/** Domain mapping for synthetic import URLs (must match import adapter URL validation). */
const IMPORT_DOMAINS: Record<string, string> = {
  Sahibinden: "sahibinden.com",
  Letgo: "letgo.com",
  "Facebook Marketplace": "facebook.com",
  EasyCep: "easycep.com",
  Getmobil: "getmobil.com",
  "Yenilenmiş Market": "yenilenmismarket.com",
  "Teknosa Yenilenmiş": "teknosa.com",
  "Hepsiburada Yenilenmiş": "hepsiburada.com",
  "MediaMarkt Yenilenmiş": "mediamarkt.com.tr",
};

const CITIES = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya",
  "Adana", "Konya", "Gaziantep", "Mersin", "Trabzon",
];

const CONDITIONS = ["Yenilenmiş", "İkinci El", "Sıfır", "Açılmamış"];

let productIndexCounter = 0;

/** Deterministic (ish) pseudo-random based on an index, for reproducible results. */
function seededValue(index: number): number {
  const x = Math.sin(index * 9301 + 49_297) * 49_297;
  return x - Math.floor(x);
}

/** Pick an item from an array using a seeded index. */
function pick<T>(arr: T[], index: number): T {
  return arr[Math.floor(seededValue(index) * arr.length)];
}

/** Generate a sequential listing index across all generated sets. */
export function resetProductIndex(): void {
  productIndexCounter = 0;
}

export function nextProductIndex(): number {
  return productIndexCounter++;
}

/** Generate `count` BotAdapterListing[] for the sync pipeline path. */
export function generateBotListings(
  count: number,
  source: string = "EasyCep",
): BotAdapterListing[] {
  const listings: BotAdapterListing[] = [];

  for (let i = 0; i < count; i++) {
    const idx = nextProductIndex();
    const product = pick(PRODUCT_CATALOG, idx);
    const storage = product.hasStorageVariants
      ? pick(product.storageOptions, idx + 1)
      : null;
    const title = storage
      ? `${product.productName} ${storage.toUpperCase()}`
      : product.productName;
    const priceVariation = 0.9 + seededValue(idx + 100) * 0.2; // 0.9–1.1
    const price = Math.round(product.basePrice * priceVariation);
    const city = pick(CITIES, idx + 200);
    const condition = pick(CONDITIONS, idx + 300);

    listings.push({
      product_name: product.productName,
      title,
      price,
      city,
      source,
      url: `https://example.com/${source.toLowerCase()}/product-${idx}`,
      condition,
      image_url: `https://example.com/images/${idx}.jpg`,
      image_urls: [`https://example.com/images/${idx}.jpg`],
      status: "pending",
    });
  }

  return listings;
}

/** Generate `count` RawImportListing[] for the import pipeline path. */
export function generateRawImportListings(
  count: number,
  source: ImportSource = "EasyCep",
): RawImportListing[] {
  const listings: RawImportListing[] = [];
  const domain = IMPORT_DOMAINS[source];

  for (let i = 0; i < count; i++) {
    const idx = nextProductIndex();
    const product = pick(PRODUCT_CATALOG, idx);
    const storage = product.hasStorageVariants
      ? pick(product.storageOptions, idx + 1)
      : null;
    const title = storage
      ? `${product.productName} ${storage.toUpperCase()}`
      : product.productName;
    const priceVariation = 0.9 + seededValue(idx + 100) * 0.2;
    const price = Math.round(product.basePrice * priceVariation);
    const city = pick(CITIES, idx + 200);
    const condition = pick(CONDITIONS, idx + 300);

    listings.push({
      externalId: `ext-${idx}`,
      productName: product.productName,
      title,
      price,
      source,
      url: `https://${domain}/${source.toLowerCase().replace(/\s+/g, "-")}/product-${idx}`,
      description: `${product.productName} - ${condition} - ${city}`,
      city,
      image_url: `https://${domain}/images/${idx}.jpg`,
      condition,
    });
  }

  return listings;
}

/** Export catalog info for metrics/reporting. */
export function getCatalogInfo() {
  return {
    totalProducts: PRODUCT_CATALOG.length,
    brandDistribution: Object.entries(
      PRODUCT_CATALOG.reduce<Record<string, number>>((acc, p) => {
        acc[p.brand] = (acc[p.brand] || 0) + 1;
        return acc;
      }, {}),
    ).map(([brand, count]) => ({ brand, count })),
  };
}
