type DemoProduct = {
  name: string;
  minPrice: number;
  maxPrice: number;
  titleDetails: string[];
};

export type DemoListing = {
  productName: string;
  title: string;
  price: number;
  city: string;
  source: string;
  url: string;
  condition: string;
  imageUrl: string;
  status: "pending";
};

const products: DemoProduct[] = [
  {
    name: "iPhone 13",
    minPrice: 18_000,
    maxPrice: 25_500,
    titleDetails: ["128GB", "256GB", "Kutulu 128GB"],
  },
  {
    name: "iPhone 14",
    minPrice: 24_000,
    maxPrice: 33_500,
    titleDetails: ["128GB", "256GB", "Pil sağlığı yüksek"],
  },
  {
    name: "Samsung S23",
    minPrice: 20_000,
    maxPrice: 29_500,
    titleDetails: ["128GB", "256GB", "Garantili"],
  },
  {
    name: "Samsung S24",
    minPrice: 27_000,
    maxPrice: 38_500,
    titleDetails: ["128GB", "256GB", "Kutulu ve garantili"],
  },
  {
    name: "PlayStation 5",
    minPrice: 17_000,
    maxPrice: 25_000,
    titleDetails: ["Slim", "Diskli sürüm", "Çift kollu"],
  },
  {
    name: "RTX 4060",
    minPrice: 12_000,
    maxPrice: 18_500,
    titleDetails: ["8GB", "Kutulu", "Garantili ekran kartı"],
  },
  {
    name: "MacBook Air M1",
    minPrice: 22_000,
    maxPrice: 32_000,
    titleDetails: ["8/256GB", "8/512GB", "Temiz kullanılmış"],
  },
  {
    name: "iPad 9. Nesil",
    minPrice: 9_000,
    maxPrice: 14_500,
    titleDetails: ["64GB Wi-Fi", "256GB", "Kutulu"],
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
): DemoListing[] {
  return Array.from({ length: 10 }, (_, index) => {
    const product = randomItem(products);
    const condition = getCondition(sourceName);
    const detail = randomItem(product.titleDetails);

    return {
      productName: product.name,
      title: `${product.name} ${detail} ${condition}`,
      price: randomPrice(product.minPrice, product.maxPrice),
      city: randomItem(cities),
      source: sourceName,
      url: `https://demo.2elbul.com/${sourceSlug}/${runToken}-${index + 1}`,
      condition,
      imageUrl: `https://placehold.co/800x450/F5F3EF/FF6B00?text=${encodeURIComponent(product.name)}`,
      status: "pending",
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
