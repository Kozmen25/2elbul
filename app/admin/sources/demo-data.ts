import type { BotAdapterListing } from "@/lib/bots/types";
import { createListingExternalId } from "@/lib/bots/listing-sync";

type DemoProduct = {
  name: string;
  minPrice: number;
  maxPrice: number;
  titleDetails: string[];
  imageUrls: string[];
};

export type DemoListing = BotAdapterListing;

const phoneImages = [
  "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80",
];
const androidImages = [
  "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&w=1200&q=80",
];
const consoleImages = [
  "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1486401899868-0e435ed85128?auto=format&fit=crop&w=1200&q=80",
];
const gpuImages = [
  "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80",
];
const laptopImages = [
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80",
];
const tabletImages = [
  "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=80",
];

const products: DemoProduct[] = [
  {
    name: "iPhone 13",
    minPrice: 18_000,
    maxPrice: 25_500,
    titleDetails: ["128GB", "256GB", "Kutulu 128GB"],
    imageUrls: phoneImages,
  },
  {
    name: "iPhone 14",
    minPrice: 24_000,
    maxPrice: 33_500,
    titleDetails: ["128GB", "256GB", "Pil sağlığı yüksek"],
    imageUrls: phoneImages,
  },
  {
    name: "Samsung S23",
    minPrice: 20_000,
    maxPrice: 29_500,
    titleDetails: ["128GB", "256GB", "Garantili"],
    imageUrls: androidImages,
  },
  {
    name: "Samsung S24",
    minPrice: 27_000,
    maxPrice: 38_500,
    titleDetails: ["128GB", "256GB", "Kutulu ve garantili"],
    imageUrls: androidImages,
  },
  {
    name: "PlayStation 5",
    minPrice: 17_000,
    maxPrice: 25_000,
    titleDetails: ["Slim", "Diskli sürüm", "Çift kollu"],
    imageUrls: consoleImages,
  },
  {
    name: "RTX 4060",
    minPrice: 12_000,
    maxPrice: 18_500,
    titleDetails: ["8GB", "Kutulu", "Garantili ekran kartı"],
    imageUrls: gpuImages,
  },
  {
    name: "MacBook Air M1",
    minPrice: 22_000,
    maxPrice: 32_000,
    titleDetails: ["8/256GB", "8/512GB", "Temiz kullanılmış"],
    imageUrls: laptopImages,
  },
  {
    name: "iPad 9. Nesil",
    minPrice: 9_000,
    maxPrice: 14_500,
    titleDetails: ["64GB Wi-Fi", "256GB", "Kutulu"],
    imageUrls: tabletImages,
  },
];

const cities = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"];
const conditions = ["İkinci El", "Yeni gibi", "İyi", "Yenilenmiş"];
const refurbishedSources = new Set([
  "EasyCep",
  "Getmobil",
  "Yenilenmiş Market",
  "Teknosa Yenilenmiş",
  "Hepsiburada Yenilenmiş",
  "MediaMarkt Yenilenmiş",
]);

export function createDemoListings(
  sourceName: string,
  sourceSlug: string,
  runToken: string,
  listingStatus: "pending" | "published",
): DemoListing[] {
  return Array.from({ length: 10 }, (_, index) => {
    const product = randomItem(products);
    const condition = getCondition(sourceName);
    const detail = randomItem(product.titleDetails);

    const url = `https://demo.2elbul.com/${sourceSlug}/${runToken}-${index + 1}`;

    return {
      external_id: createListingExternalId(url),
      product_name: product.name,
      title: `${product.name} ${detail} ${condition}`,
      price: randomPrice(product.minPrice, product.maxPrice),
      city: randomItem(cities),
      source: sourceName,
      url,
      condition,
      image_url: product.imageUrls[0] ?? null,
      image_urls: product.imageUrls,
      status: listingStatus,
    };
  });
}

function getCondition(sourceName: string) {
  if (refurbishedSources.has(sourceName) && Math.random() < 0.75) {
    return "Yenilenmiş";
  }
  return randomItem(conditions);
}

function randomPrice(min: number, max: number) {
  const step = 250;
  const value = min + Math.random() * (max - min);
  return Math.round(value / step) * step;
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]!;
}
