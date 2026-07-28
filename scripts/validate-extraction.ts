import { extractProductSignals } from "@/lib/normalization/engine";
import fs from "fs";
import path from "path";

type Listing = {
  id: number;
  product_id: number | null;
  title: string;
  [key: string]: unknown;
};

type PerListingResult = {
  id: number;
  product_id: number | null;
  title: string;
  brand: string | null;
  model: string | null;
  storage: string | null;
  ram: string | null;
  color: string | null;
  category: string | null;
  normalizedKey: string;
};

// ==============================
// EDGE CASE TITLE FACTORY
// ==============================

type EdgeCaseResult = {
  label: string;
  title: string;
  expectedBrand: string | null;
  expectedModel: string | null;
  expectedCategory: string | null;
  brandOk: boolean;
  modelOk: boolean;
  categoryOk: boolean;
  key: string;
  actual: { brand: string | null; model: string | null; category: string | null; storage: string | null; ram: string | null };
};

type ProductEdgeCase = {
  title: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  note: string;
};

const EDGE_CASES: ProductEdgeCase[] = [
  // --- Cross-category lookalikes ---
  { title: "iPad 10. Nesil 64GB Wi-Fi", brand: "apple", model: "ipad-10-nesil", category: "Tablet", note: "iPad nesil eşleşir, model=ipad-10-nesil" },
  { title: "Samsung Galaxy Tab S9 256GB", brand: "samsung", model: "galaxy-tab-s9", category: "Tablet", note: "Samsung Tab — Tablet kategorisi (Tab, Telefon'dan önce kontrol edilir)" },
  { title: "PlayStation 5 825GB Dijital", brand: "sony", model: "playstation-5-825gb-dijital", category: "Oyun Konsolu", note: "Model fallback: ilk 4 token" },
  { title: "Xbox Series X 1TB", brand: null, model: "xbox-series-x-1tb", category: null, note: "Xbox BRAND_RULES'de yok — brand=null, fallback model ilk 4 token" },
  { title: "Nintendo Switch OLED 64GB", brand: null, model: "nintendo-switch-oled-64gb", category: null, note: "Nintendo BRAND_RULES'de yok — brand=null, fallback model ilk 4 token" },
  { title: "MacBook Air M1 256GB", brand: "apple", model: "macbook-air-m1", category: "Laptop", note: "MacBook regex çalışır" },
  { title: "Dell XPS 13 512GB", brand: "dell", model: "xps-13", category: null, note: "Brand-aware fallback: model brand'siz, storage filtrelenmiş" },
  { title: "HP Pavilion 15 256GB", brand: "hp", model: "pavilion-15", category: null, note: "Brand-aware fallback: model brand'siz, storage filtrelenmiş" },
  { title: "Lenovo ThinkPad X1 512GB", brand: "lenovo", model: "thinkpad-x1", category: null, note: "Brand-aware fallback: model brand'siz, storage filtrelenmiş" },
  { title: "ASUS ROG Zephyrus 1TB", brand: "asus", model: "rog-zephyrus", category: null, note: "Brand-aware fallback: model brand'siz, storage filtrelenmiş" },
  { title: "MSI GF63 Thin 512GB", brand: "msi", model: "gf63-thin", category: null, note: "Brand-aware fallback: msi tespit, model brand'siz, storage filtrelenmiş" },

  // --- Non-Latin / transliteration ---
  { title: "ايفون 15 برو ماكس 256GB", brand: null, model: "ايفون-15-برو-ماكس", category: null, note: "brand=null, model Arapça fallback ilk 4 token, temiz key (tire sorunu yok)" },
  { title: "iPhone 15 Pro Max 256GB сірий", brand: "apple", model: "iphone-15-pro-max", category: "Telefon", note: "Kiril renk normalize edilmez ama extraction çalışır" },
  { title: "IPhone 15 PRO MAX 256GB PİXEL ÇOK TEMİZ", brand: "apple", model: "iphone-15-pro-max", category: "Telefon", note: "Türkçe İ normalizasyonu çalışır" },
  { title: "samsung galaxy s24 ultra 512 gb siyah hatasız", brand: "samsung", model: "galaxy-s24-ultra", category: "Telefon", note: "Tamamen küçük harf çalışır" },

  // --- Noisy / spam ---
  { title: "ACİL!! SATILIK iPhone 15 Pro Max 256GB Sıfır Ayarlı!", brand: "apple", model: "iphone-15-pro-max", category: "Telefon", note: "Ünlem/spam filtrelenir" },
  { title: "16 pro max 256 gb siyah", brand: "apple", model: "iphone-16-pro-max", category: "Telefon", note: "Bare iPhone regex → apple tespit (agresif ama doğru)" },
  { title: "s23 128 gb", brand: "samsung", model: "galaxy-s23", category: "Telefon", note: "Bare Samsung regex → samsung tespit" },
  { title: "telefon", brand: null, model: "telefon", category: null, note: "Tek kelime — brand=null, category=null, fallback model=telefon" },
  { title: "HARİKA DURUMDA TELEFON ARAYANLAR KAÇIRMAYIN", brand: null, model: "harika-durumda-telefon-arayanlar", category: null, note: "Anlamsız başlık — brand=null, fallback model ilk 4 token" },
  { title: "Samsung Galaxy S23 Ultra 12GB RAM 256GB", brand: "samsung", model: "galaxy-s23-ultra", category: "Telefon", note: "Storage=256gb (RAM sonrası arar, greedy sorunu yok)" },
  { title: "Xiaomi Redmi Note 12 8GB RAM 256GB", brand: "xiaomi", model: "redmi-note-12", category: null, note: "Brand-aware fallback: model brand'siz, storage/ram filtrelenmiş" },
  { title: "Huawei P60 Pro 256GB", brand: "huawei", model: "p60-pro", category: null, note: "Brand-aware fallback: model brand'siz, storage filtrelenmiş" },
  { title: "OnePlus 12 16GB RAM 512GB", brand: "oneplus", model: "12", category: null, note: "Storage=512gb (RAM sonrası arar), model=12 (brand-aware)" },
  { title: "Google Pixel 8 Pro 128GB", brand: "google", model: "pixel-8-pro", category: null, note: "Brand-aware fallback: model brand'siz, storage filtrelenmiş" },

  // --- SKU codes ---
  { title: "A2644 128GB Uzay Grisi", brand: null, model: "a2644-128gb-uzay-grisi", category: null, note: "Model kodu A2644 — brand yok, fallback model anlamsız ama tutarlı" },
  { title: "SM-S918B 256GB", brand: null, model: "sm-s918b-256gb", category: null, note: "Samsung SM kodu — brand yok, fallback model" },

  // --- Missing info ---
  { title: "Apple iPhone", brand: "apple", model: "iphone", category: "Telefon", note: "Sadece brand — model fallback 'iphone', collapse riski düşük" },
  { title: "Samsung Telefon 128GB", brand: "samsung", model: "telefon", category: null, note: "Samsung ama model yok — fallback 'telefon', hala collapse!" },
  { title: "iPhone 15 Pro Max", brand: "apple", model: "iphone-15-pro-max", category: "Telefon", note: "Storage yok — model/işlev çalışır" },

  // --- Emoji / HTML ---
  { title: "iPhone 15 Pro Max 256GB ❤️ SIFIR", brand: "apple", model: "iphone-15-pro-max", category: "Telefon", note: "Emoji normalizasyonu çalışır" },
  { title: "iPhone 13 128GB &amp; Kılıf Hediyeli", brand: "apple", model: "iphone-13", category: "Telefon", note: "HTML entity normalizasyonu çalışır" },
  { title: "Samsung S24+ 256GB Çok &quot;Temiz&quot;", brand: "samsung", model: "galaxy-s24-plus", category: "Telefon", note: "S24+ → galaxy-s24-plus (+ → plus dönüşümü çalışır)" },

  // --- RAM variations ---
  { title: "Samsung Galaxy S24 Ultra 256GB 12GB RAM", brand: "samsung", model: "galaxy-s24-ultra", category: "Telefon", note: "RAM=12gb doğru tespit" },
  { title: "Samsung Galaxy S24 Ultra 256GB 12GB Ram", brand: "samsung", model: "galaxy-s24-ultra", category: "Telefon", note: "'Ram' vs 'RAM' fark etmez" },
  { title: "Samsung Galaxy A55 5G 8GB 256GB", brand: "samsung", model: "galaxy-a55", category: "Telefon", note: "8GB storage değil, RAM regex eşleşmez" },

  // --- Long / complex ---
  { title: "2024 Model SIFIR AYARINDA Samsung Galaxy S24 Ultra 256GB 12GB RAM Orijinal Kutu Faturasıyla Beraber Sadece 2 Ay Kullanılmış", brand: "samsung", model: "galaxy-s24-ultra", category: "Telefon", note: "Uzun başlıkta model doğru tespit" },
  { title: "YENİ NESİL 5G DESTEKLİ HUAWEİ MATE 60 PRO 512GB GÜNCEL YAZILIM", brand: "huawei", model: "mate-60-pro-guncel", category: null, note: "Brand-aware fallback: model=mate-60-pro-guncel (ilk 4 token brand sonrası, storage filtrelenmiş)" },
  { title: "Saat 45mm", brand: null, model: "saat-45mm", category: null, note: "Saat — brand=null, category=null, fallback model=saat-45mm" },
  { title: "RTX 4090 24GB Ekran Kartı", brand: "nvidia", model: "rtx-4090-24gb-ekran", category: "Ekran Kartı", note: "Brand=nvidia, category=Ekran Kartı, model fallback" },
];

// ==============================
// 1. Read real listings
// ==============================
const rawPath = path.resolve(".claude/listings_raw.json");
const listings: Listing[] = JSON.parse(fs.readFileSync(rawPath, "utf-8"));

const results: PerListingResult[] = listings.map((l) => {
  const signals = extractProductSignals(l.title);
  return {
    id: l.id,
    product_id: l.product_id,
    title: l.title,
    ...signals,
  };
});

// ==============================
// 2. Run edge cases
// ==============================
const edgeResults: EdgeCaseResult[] = EDGE_CASES.map((ec) => {
  const signals = extractProductSignals(ec.title);
  const brandOk = signals.brand === ec.brand;
  const modelOk = signals.model === ec.model;
  const categoryOk = signals.category === ec.category;
  return {
    label: ec.title.substring(0, 50),
    title: ec.title,
    expectedBrand: ec.brand,
    expectedModel: ec.model,
    expectedCategory: ec.category,
    brandOk,
    modelOk,
    categoryOk,
    key: signals.normalizedKey,
    actual: { brand: signals.brand, model: signals.model, category: signals.category, storage: signals.storage, ram: signals.ram },
  };
});

// Summarize edge case success
const brandSuccess = edgeResults.filter(r => r.brandOk).length;
const modelSuccess = edgeResults.filter(r => r.modelOk).length;
const categorySuccess = edgeResults.filter(r => r.categoryOk).length;

// ==============================
// 3. Compute all metrics on real data
// ==============================
const brandDetected = results.filter((r) => r.brand !== null);
const brandUnknown = results.filter((r) => r.brand === null);
const modelDetected = results.filter((r) => r.model !== null);
const modelUnknown = results.filter((r) => r.model === null);

const validKeys = results.filter((r) => r.normalizedKey && r.normalizedKey.includes("-"));
const nullKeys = results.filter((r) => !r.normalizedKey || !r.normalizedKey.includes("-"));

const catDetected = results.filter((r) => r.category !== null);
const catUnknown = results.filter((r) => r.category === null);

const brandMap = new Map<string, { listingCount: number; models: Set<string>; keys: Set<string> }>();
for (const r of results) {
  const b = r.brand ?? "(bilinmeyen)";
  if (!brandMap.has(b)) brandMap.set(b, { listingCount: 0, models: new Set(), keys: new Set() });
  const s = brandMap.get(b)!;
  s.listingCount++;
  if (r.model) s.models.add(r.model);
  if (r.normalizedKey) s.keys.add(r.normalizedKey);
}

const modelCounts = new Map<string, Map<string, number>>();
for (const r of results) {
  const b = r.brand ?? "(bilinmeyen)";
  const m = r.model ?? "(bilinmeyen)";
  if (!modelCounts.has(b)) modelCounts.set(b, new Map());
  const mc = modelCounts.get(b)!;
  mc.set(m, (mc.get(m) ?? 0) + 1);
}

// Null bucket
const nullDetails: Array<{ id: number; title: string; cause: string }> = [];
for (const r of nullKeys) {
  if (!r.brand) nullDetails.push({ id: r.id, title: r.title, cause: "marka tespit edilemedi -> normalized_title fallback" });
  else if (!r.model) nullDetails.push({ id: r.id, title: r.title, cause: `marka=${r.brand} ama model yok` });
  else nullDetails.push({ id: r.id, title: r.title, cause: `diger: brand=${r.brand} model=${r.model} key=${r.normalizedKey}` });
}

// Duplicate safety
const keyGroups = new Map<string, PerListingResult[]>();
for (const r of validKeys) {
  if (!keyGroups.has(r.normalizedKey)) keyGroups.set(r.normalizedKey, []);
  keyGroups.get(r.normalizedKey)!.push(r);
}

const multiListingKeys: Array<{ key: string; count: number; brands: string[]; ids: number[] }> = [];
let crossBrandCount = 0;
for (const [key, group] of keyGroups) {
  if (group.length > 1) {
    const brands = [...new Set(group.map(r => r.brand).filter((b): b is string => b !== null))];
    if (brands.length > 1) crossBrandCount++;
    multiListingKeys.push({
      key, count: group.length, brands,
      ids: group.map(r => r.id).sort((a, b) => a - b),
    });
  }
}
multiListingKeys.sort((a, b) => b.count - a.count);

// ==============================
// 4. Collapse risk analysis
// ==============================
// Brand=detected but model=null => collapse candidates
const collapseCandidates = results.filter(r => r.brand !== null && r.model === null);
const collapseByBrand = new Map<string, number>();
for (const r of collapseCandidates) {
  const b = r.brand!;
  collapseByBrand.set(b, (collapseByBrand.get(b) ?? 0) + 1);
}

// ==============================
// OUTPUT
// ==============================
const output = {
  real: {
    summary: { totalListings: results.length, totalBrands: brandMap.size },
    brand: {
      total: results.length,
      detected: brandDetected.length,
      unknown: brandUnknown.length,
      successRate: `${((brandDetected.length / results.length) * 100).toFixed(2)}%`,
      brandsFound: [...brandMap.entries()].map(([b, s]) => ({ brand: b, count: s.listingCount, models: s.models.size, distinctKeys: s.keys.size })),
      unknownListings: brandUnknown.map(r => ({ id: r.id, title: r.title })),
    },
    model: {
      total: results.length,
      detected: modelDetected.length,
      unknown: modelUnknown.length,
      successRate: `${((modelDetected.length / results.length) * 100).toFixed(2)}%`,
      unknownListings: modelUnknown.map(r => ({ id: r.id, title: r.title, brand: r.brand })),
    },
    normalizedKey: {
      total: results.length,
      valid: validKeys.length,
      null: nullKeys.length,
      successRate: `${((validKeys.length / results.length) * 100).toFixed(2)}%`,
      distinctKeys: keyGroups.size,
    },
    category: {
      total: results.length,
      detected: catDetected.length,
      unknown: catUnknown.length,
      successRate: `${((catDetected.length / results.length) * 100).toFixed(2)}%`,
      categoryDistribution: [...Map.groupBy(results.filter(r => r.category), r => r.category!).entries()].map(([cat, items]) => ({ category: cat, count: items.length })),
    },
    brandDistribution: [...brandMap.entries()].map(([brand, s]) => ({
      brand,
      listingCount: s.listingCount,
      uniqueModelCount: s.models.size,
      models: [...s.models].sort(),
      distinctKeyCount: s.keys.size,
      modelDistribution: [...(modelCounts.get(brand) ?? new Map()).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([m, c]) => ({ model: m, listingCount: c })),
      medianGroupSize: (() => {
        const counts = [...(modelCounts.get(brand) ?? new Map()).values()].sort((a, b) => a - b);
        const mid = Math.floor(counts.length / 2);
        return counts.length % 2 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2;
      })(),
      largestModelGroup: Math.max(...[...(modelCounts.get(brand) ?? new Map()).values()], 0),
    })).sort((a, b) => b.listingCount - a.listingCount),
    nullBucket: {
      totalNull: nullKeys.length,
      details: nullDetails,
    },
    duplicateSafety: {
      totalDistinctKeys: keyGroups.size,
      keysWithSingleListing: [...keyGroups.values()].filter(g => g.length === 1).length,
      keysWithMultipleListings: multiListingKeys.length,
      crossBrandCollisions: crossBrandCount,
      duplicateKeyDetails: multiListingKeys,
      topGroups: multiListingKeys.slice(0, 10),
    },
    collapseAnalysis: {
      totalCollapseCandidates: collapseCandidates.length,
      byBrand: [...collapseByBrand.entries()].map(([b, c]) => ({ brand: b, count: c })),
      details: collapseCandidates.map(r => ({ id: r.id, title: r.title, brand: r.brand, key: r.normalizedKey })),
    },
  },
  edgeCases: {
    total: EDGE_CASES.length,
    brandSuccess: `${brandSuccess}/${EDGE_CASES.length} (${((brandSuccess / EDGE_CASES.length) * 100).toFixed(1)}%)`,
    modelSuccess: `${modelSuccess}/${EDGE_CASES.length} (${((modelSuccess / EDGE_CASES.length) * 100).toFixed(1)}%)`,
    categorySuccess: `${categorySuccess}/${EDGE_CASES.length} (${((categorySuccess / EDGE_CASES.length) * 100).toFixed(1)}%)`,
    failures: edgeResults.filter(r => !r.brandOk || !r.modelOk || !r.categoryOk).map(r => ({
      title: r.title,
      expected: { brand: r.expectedBrand, model: r.expectedModel, category: r.expectedCategory },
      actual: r.actual,
      failedFields: [
        r.brandOk ? null : "brand",
        r.modelOk ? null : "model",
        r.categoryOk ? null : "category",
      ].filter(Boolean),
      key: r.key,
    })),
    allResults: edgeResults,
  },
};

console.log(JSON.stringify(output, null, 2));
