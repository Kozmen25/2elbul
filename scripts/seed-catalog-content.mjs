import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"];

const ELECTRONICS_SOURCES = [
  "Sahibinden",
  "Letgo",
  "Facebook Marketplace",
  "EasyCep",
  "Getmobil",
  "Yenilenmiş Market",
  "Teknosa Yenilenmiş",
  "Hepsiburada Yenilenmiş",
  "MediaMarkt Yenilenmiş",
  "Satarız",
];
const VEHICLE_SOURCES = ["Sahibinden", "Letgo", "Facebook Marketplace"];
const REALESTATE_SOURCES = ["Sahibinden", "Letgo"];
const HOME_SOURCES = ["Sahibinden", "Letgo", "Facebook Marketplace", "Satarız"];

const ELECTRONICS_CONDITIONS = ["Sıfır", "Yeni gibi", "Çok iyi", "İyi", "İkinci El", "Yenilenmiş"];
const VEHICLE_CONDITIONS = ["Çok iyi", "İyi", "İkinci El", "Kullanılmış"];
const REALESTATE_CONDITIONS = ["Çok iyi", "İyi", "Yeni gibi"];
const HOME_CONDITIONS = ["Yeni gibi", "Çok iyi", "İyi", "İkinci El", "Kullanılmış"];

const TITLE_NOTES = [
  "temiz kullanılmış, kutulu",
  "faturalı, garantili",
  "az kullanılmış",
  "sorunsuz, tam çalışır",
  "ilk sahibinden",
  "değişim olmaz, net fiyat",
  "hasar kaydı yok",
  "aksesuarları eksiksiz",
];

function pick(list, i) {
  return list[i % list.length];
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function roundPrice(value) {
  if (value >= 100000) return Math.round(value / 500) * 500;
  if (value >= 10000) return Math.round(value / 100) * 100;
  if (value >= 1000) return Math.round(value / 50) * 50;
  return Math.round(value / 10) * 10;
}

function slugForUrl(text) {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SOURCE_DOMAINS = {
  Sahibinden: "www.sahibinden.com",
  Letgo: "www.letgo.com",
  "Facebook Marketplace": "www.facebook.com/marketplace/item",
  EasyCep: "www.easycep.com",
  Getmobil: "www.getmobil.com",
  "Yenilenmiş Market": "www.yenilenmismarket.com",
  "Teknosa Yenilenmiş": "www.teknosa.com/yenilenmis",
  "Hepsiburada Yenilenmiş": "www.hepsiburada.com/yenilenmis",
  "MediaMarkt Yenilenmiş": "www.mediamarkt.com.tr/yenilenmis",
  Satarız: "www.sataris.com",
};

function buildUrl(source, title, index) {
  const domain = SOURCE_DOMAINS[source] ?? "www.sahibinden.com";
  return `https://${domain}/ilan/${slugForUrl(title)}-${index}`;
}

/**
 * category: category label text matched against lib/category-intelligence.ts CATEGORY_ROUTES
 * products: [{ name, base(min,max), listingCount }]
 */
const CATALOG = [
  {
    category: "Telefon",
    type: "electronics",
    products: [
      { name: "iPhone 14", min: 30000, max: 37000, count: 6 },
      { name: "iPhone 13", min: 23000, max: 28000, count: 6 },
      { name: "Samsung Galaxy S23", min: 26000, max: 32000, count: 5 },
      { name: "Samsung Galaxy A54", min: 12000, max: 16000, count: 5 },
      { name: "Xiaomi Redmi Note 13", min: 7500, max: 10500, count: 5 },
    ],
  },
  {
    category: "Bilgisayar",
    type: "electronics",
    products: [
      { name: "MacBook Air M2", min: 38000, max: 46000, count: 5 },
      { name: "MacBook Air M1", min: 25000, max: 31000, count: 5 },
      { name: "MacBook Pro 14 M3", min: 62000, max: 74000, count: 4 },
      { name: "Asus ROG Strix G15", min: 34000, max: 42000, count: 5 },
      { name: "Lenovo ThinkPad X1 Carbon", min: 40000, max: 50000, count: 4 },
    ],
  },
  {
    category: "Oyun Konsolu",
    type: "electronics",
    products: [
      { name: "PS5", min: 17500, max: 21500, count: 6 },
      { name: "PlayStation 4 Pro", min: 8000, max: 10500, count: 5 },
      { name: "Xbox Series X", min: 16500, max: 20000, count: 5 },
      { name: "Nintendo Switch OLED", min: 9500, max: 12500, count: 5 },
    ],
  },
  {
    category: "TV ve Ses Sistemleri",
    type: "electronics",
    products: [
      { name: 'Samsung 55" QLED Smart TV', min: 21000, max: 27000, count: 5 },
      { name: 'LG 65" OLED TV', min: 38000, max: 46000, count: 4 },
      { name: "JBL Charge 5 Hoparlör", min: 2700, max: 3600, count: 5 },
      { name: "Sony WH-1000XM5 Kulaklık", min: 8200, max: 10500, count: 5 },
    ],
  },
  {
    category: "Araç",
    type: "vehicle",
    products: [
      { name: "Volkswagen Golf 1.6 TDI", min: 720000, max: 850000, count: 5 },
      { name: "Renault Clio 1.0 TCe", min: 560000, max: 670000, count: 5 },
      { name: "Fiat Egea 1.4 Fire", min: 530000, max: 640000, count: 5 },
      { name: "Honda Civic 1.6 Eco", min: 880000, max: 1020000, count: 4 },
    ],
  },
  {
    category: "Emlak",
    type: "realestate",
    products: [
      { name: "Kadıköy 3+1 Satılık Daire", min: 5600000, max: 6900000, count: 4 },
      { name: "Çankaya 2+1 Kiralık Daire", min: 22000, max: 32000, count: 4 },
      { name: "Bornova Müstakil Villa", min: 8900000, max: 10800000, count: 3 },
      { name: "Nilüfer Satılık Arsa", min: 2900000, max: 3800000, count: 3 },
    ],
  },
  {
    category: "Yedek Parça",
    type: "electronics",
    products: [
      { name: "RTX 2060 Super", min: 6800, max: 8200, count: 5 },
      { name: "i5-12400F", min: 3800, max: 4700, count: 5 },
      { name: "RTX 4070 Ekran Kartı", min: 17500, max: 21500, count: 5 },
      { name: "Intel i7-13700K İşlemci", min: 12000, max: 15000, count: 4 },
      { name: "16GB DDR5 RAM Kiti", min: 2200, max: 3000, count: 4 },
      { name: "1TB NVMe SSD", min: 1600, max: 2200, count: 4 },
    ],
  },
  {
    category: "Ev ve Yaşam",
    type: "home",
    products: [
      { name: "Bosch Çamaşır Makinesi 9 kg", min: 10200, max: 12800, count: 5 },
      { name: "Arçelik Buzdolabı No-Frost", min: 13800, max: 17200, count: 5 },
      { name: "Dyson V15 Süpürge", min: 12000, max: 15000, count: 4 },
      { name: "Yemek Odası Mobilya Takımı", min: 15500, max: 21500, count: 4 },
    ],
  },
  {
    category: "Telefon Aksesuarı",
    type: "electronics",
    products: [
      { name: "iPhone 15 Silikon Kılıf", min: 250, max: 450, count: 4 },
      { name: "Anker 20000mAh Powerbank", min: 800, max: 1150, count: 4 },
      { name: "Baseus 65W Hızlı Şarj Aleti", min: 500, max: 800, count: 4 },
      { name: "USB-C Type Kablo Seti", min: 140, max: 230, count: 4 },
    ],
  },
];

function sourcesFor(type) {
  if (type === "vehicle") return VEHICLE_SOURCES;
  if (type === "realestate") return REALESTATE_SOURCES;
  if (type === "home") return HOME_SOURCES;
  return ELECTRONICS_SOURCES;
}

function conditionsFor(type) {
  if (type === "vehicle") return VEHICLE_CONDITIONS;
  if (type === "realestate") return REALESTATE_CONDITIONS;
  if (type === "home") return HOME_CONDITIONS;
  return ELECTRONICS_CONDITIONS;
}

async function upsertProduct(name, category) {
  const { data, error } = await sb
    .from("products")
    .upsert({ name, category }, { onConflict: "name" })
    .select("id")
    .single();
  if (error) throw new Error(`product upsert failed for ${name}: ${error.message}`);
  return data.id;
}

async function insertListings(rows) {
  const { error } = await sb.from("listings").insert(rows);
  if (error) throw new Error(`listings insert failed: ${error.message}`);
}

let urlCounter = 1;

async function main() {
  let totalProducts = 0;
  let totalListings = 0;

  for (const group of CATALOG) {
    const sources = sourcesFor(group.type);
    const conditions = conditionsFor(group.type);

    for (const product of group.products) {
      const productId = await upsertProduct(product.name, group.category);
      totalProducts += 1;

      const rows = [];
      for (let i = 0; i < product.count; i += 1) {
        const price = roundPrice(randomBetween(product.min, product.max));
        const city = pick(CITIES, i + rows.length);
        const source = pick(sources, i);
        const condition = pick(conditions, i + 1);
        const note = pick(TITLE_NOTES, i + 2);
        const title = `${product.name} ${note}`;
        const url = buildUrl(source, product.name, urlCounter++);

        rows.push({
          product_id: productId,
          title,
          price,
          city,
          source,
          url,
          condition,
          status: "published",
          published_at: new Date().toISOString(),
        });
      }

      await insertListings(rows);
      totalListings += rows.length;
      console.log(`✓ ${product.name} (${group.category}) -> ${rows.length} ilan`);
    }
  }

  console.log(`\nTamamlandı: ${totalProducts} ürün, ${totalListings} ilan eklendi.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
