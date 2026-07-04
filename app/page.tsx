import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  BadgePercent,
  BarChart3,
  Car,
  Clock3,
  Flame,
  FolderSearch2,
  Gamepad2,
  HomeIcon,
  Laptop,
  MapPin,
  PackageSearch,
  Search,
  Smartphone,
  Store,
  TrendingDown,
  TriangleAlert,
  Tv,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ListingImage } from "@/components/listing-image";
import { SearchBar } from "@/components/search-bar";
import { createProductSlug } from "@/lib/product-slug";
import {
  getHomeData,
  type HomeListing,
  type MarketPulseItem,
  type PriceOpportunity,
  type PriceDrop,
} from "@/lib/home-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ikinci el urunlerin gercek piyasa fiyatini karsilastir | 2ElBul",
  description:
    "Telefon, bilgisayar, konsol ve daha fazlasi icin ikinci el ilanlari tek yerde karsilastir; ortalama fiyati, en ucuz ilani ve fiyat gecmisini gor.",
  openGraph: {
    title: "Ikinci el urunlerin gercek piyasa fiyatini karsilastir | 2ElBul",
    description:
      "2ElBul ile ikinci el ilanlari karsilastir, ortalama fiyati, en ucuz ilani, fiyat gecmisini ve guven skorunu gor.",
    url: "https://2elbul.vercel.app",
    siteName: "2ElBul",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ikinci el urunlerin gercek piyasa fiyatini karsilastir | 2ElBul",
    description:
      "Ikinci el piyasasini tek yerde karsilastir; fiyat analizini, en ucuz ilanlari ve fiyat gecmisini gor.",
  },
};

const quickCategories = [
  { label: "Telefon", query: "telefon", icon: Smartphone },
  { label: "Bilgisayar", query: "bilgisayar", icon: Laptop },
  { label: "Konsol", query: "oyun konsolu", icon: Gamepad2 },
  { label: "TV / Ses", query: "tv", icon: Tv },
  { label: "Araç", query: "araba", icon: Car },
  { label: "Emlak", query: "emlak", icon: HomeIcon },
  { label: "Yedek Parça", query: "yedek parça", icon: Store },
  { label: "Ev / Yaşam", query: "mobilya", icon: FolderSearch2 },
  { label: "Fiyatı düşenler", query: "fiyatı düşen", icon: TrendingDown },
  { label: "Fırsatlar", query: "fırsat", icon: BadgePercent },
  { label: "Yakınımdaki", query: "yakınımdaki", icon: MapPin },
  { label: "Tüm ilanlar", query: "", icon: PackageSearch },
];

const quickAnchors = [
  { label: "Kategori Rehberi", href: "#kategori-rehberi" },
  { label: "Fırsatlar", href: "#firsatlar" },
  { label: "Piyasa Nabzı", href: "#piyasa" },
  { label: "Yeni İlanlar", href: "#yeni-ilanlar" },
  { label: "Kaynaklar", href: "#kaynaklar" },
];

const categoryGuide = [
  {
    title: "Emlak",
    query: "emlak",
    emoji: "🏠",
    items: ["Konut", "Kiralık Ev", "Satılık Ev", "Arsa", "İş Yeri", "Günlük Kiralık", "Devre Mülk", "Turistik Tesis"],
  },
  {
    title: "Vasıta",
    query: "vasıta",
    emoji: "🚗",
    items: ["Otomobil", "SUV", "Motosiklet", "Elektrikli Araç", "Ticari Araç", "Karavan", "Deniz Aracı", "Hasarlı Araç"],
  },
  {
    title: "Yedek Parça",
    query: "yedek parça",
    emoji: "🧰",
    items: ["Oto Parça", "Lastik", "Jant", "Motosiklet Ekipmanı", "Aksesuar", "Donanım", "Far", "Tampon"],
  },
  {
    title: "Elektronik",
    query: "elektronik",
    emoji: "📱",
    items: ["Cep Telefonu", "Bilgisayar", "Tablet", "TV", "Kamera", "Ses Sistemi", "Akıllı Saat", "Kulaklık"],
  },
  {
    title: "Bilgisayar Parçaları",
    query: "bilgisayar parçaları",
    emoji: "🖥️",
    items: ["Ekran Kartı", "İşlemci", "Anakart", "RAM", "SSD", "HDD", "Monitör", "Oyuncu PC"],
  },
  {
    title: "Ev & Yaşam",
    query: "ev eşyası",
    emoji: "🛋️",
    items: ["Mobilya", "Beyaz Eşya", "Ev Elektroniği", "Küçük Ev Aleti", "Bahçe", "Yapı Market", "Dekorasyon", "Klima"],
  },
  {
    title: "Moda & Kişisel",
    query: "giyim",
    emoji: "👟",
    items: ["Giyim", "Ayakkabı", "Çanta", "Saat", "Takı", "Kozmetik", "Aksesuar", "Koleksiyon"],
  },
  {
    title: "Anne / Bebek / Hobi",
    query: "bebek",
    emoji: "🧸",
    items: ["Bebek Arabası", "Oto Koltuğu", "Oyuncak", "Spor", "Bisiklet", "Müzik Aleti", "Kitap", "Oyun"],
  },
  {
    title: "İş & Sanayi",
    query: "iş makinesi",
    emoji: "🏗️",
    items: ["İş Makinesi", "Tarım Makinesi", "Forklift", "Jeneratör", "Kompresör", "Sanayi", "Enerji", "Ofis"],
  },
  {
    title: "Hizmet & Hayvan",
    query: "hizmet",
    emoji: "🐾",
    items: ["Ustalar", "Özel Ders", "İş İlanı", "Yardımcı", "Kedi", "Köpek", "Kuş", "Mama"],
  },
];

const fallbackPopularSearches = [
  "iPhone",
  "Laptop",
  "PS5",
  "RTX 4060",
  "MacBook",
  "AirPods",
  "iPad",
  "Samsung",
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

export default async function Home() {
  const {
    refurbishedListings,
    priceOpportunities,
    last24HourListings,
    sourceSummary,
    popularProducts,
    popularListedProducts,
    priceDrops,
    popularCategories,
    marketPulse,
    error,
  } = await getHomeData();

  const totalListings = sourceSummary.reduce(
    (total, source) => total + source.listingCount,
    0,
  );
  const totalSources = sourceSummary.filter((source) => source.listingCount > 0).length;
  const fallingSignals = marketPulse.fallingPriceProducts.length + priceDrops.length;
  const topOpportunity = priceOpportunities[0];
  const heroSearches = popularProducts.length > 0
    ? popularProducts.map((item) => item.productName).slice(0, 8)
    : fallbackPopularSearches;

  return (
    <>
      <section className="relative overflow-hidden border-b border-black/7 bg-white pb-8 pt-8 sm:pb-12 sm:pt-12">
        <div className="absolute -right-24 top-6 size-72 rounded-full bg-[#ff6b00]/8 blur-3xl" />
        <div className="absolute -left-24 bottom-0 size-72 rounded-full bg-black/4 blur-3xl" />

        <div className="container-shell relative">
          <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div>
              <div className="mb-5">
                <BrandLogo size="lg" linked={false} />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ff6b00]/15 bg-[#fff7f1] px-3 py-2 text-xs font-black text-[#d95700]">
                <span className="size-2 rounded-full bg-[#ff6b00] shadow-[0_0_0_4px_rgba(255,107,0,0.12)]" />
                Güncel ikinci el piyasa verisi
              </div>
              <h1 className="mt-4 max-w-4xl text-[34px] font-black leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                İkinci el ürünlerin{" "}
                <span className="text-[#ff6b00]">gerçek piyasa fiyatını</span>{" "}
                karşılaştır.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-black/55 sm:text-lg">
                Aradığın ürünü yaz; 2ElBul ilanları, fiyat aralığını, fırsatları
                ve piyasa sinyallerini tek ekranda toplasın.
              </p>

              <div id="home-search" className="mt-7 w-full max-w-3xl scroll-mt-28">
                <SearchBar actionPath="/search" showLocation={false} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {heroSearches.map((query) => (
                  <Link
                    key={query}
                    href={`/search?q=${encodeURIComponent(query)}`}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold transition hover:border-[#ff6b00]/40 hover:bg-[#fff7f1] hover:text-[#d95700]"
                  >
                    {query}
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <HeroMetric
                title="Yayındaki ilan"
                value={totalListings || last24HourListings.length}
                suffix="+"
                description="Aktif kaynaklardan toplanan güncel ilanlar"
                icon={PackageSearch}
              />
              <HeroMetric
                title="Aktif kaynak"
                value={totalSources || sourceSummary.length}
                description="Piyasa verisi gelen platformlar"
                icon={Store}
              />
              <HeroMetric
                title="Fırsat sinyali"
                value={priceOpportunities.length}
                description="Piyasa ortalamasına göre öne çıkan ilan"
                icon={BadgePercent}
              />
              <HeroMetric
                title="Fiyat hareketi"
                value={fallingSignals}
                description="Düşüş trendi ve fiyat değişimi sinyali"
                icon={TrendingDown}
              />
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-black/8 bg-[#fafaf8] p-3 shadow-[0_14px_45px_rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {quickCategories.map(({ label, query, icon: Icon }) => (
                <Link
                  key={label}
                  href={`/search?q=${encodeURIComponent(query)}`}
                  className="group rounded-2xl border border-transparent bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-[#ff6b00]/25 hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)]"
                >
                  <span className="mx-auto grid size-11 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00] transition group-hover:bg-[#ff6b00] group-hover:text-white">
                    <Icon size={21} />
                  </span>
                  <span className="mt-3 block text-xs font-black sm:text-sm">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <nav className="mt-5 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {quickAnchors.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black transition hover:border-[#ff6b00]/35 hover:bg-[#fff7f1] hover:text-[#d95700]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {error && (
        <div className="container-shell pt-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-800">
            {error}
          </div>
        </div>
      )}

      <section id="kategori-rehberi" className="border-b border-black/7 bg-white py-8 sm:py-10">
        <div className="container-shell">
          <SectionHeader
            eyebrow="Hızlı erişim"
            title="Kategori rehberi"
            icon={FolderSearch2}
            compact
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {categoryGuide.map((group) => (
              <div
                key={group.title}
                className="rounded-3xl border border-black/8 bg-[#fafaf8] p-4 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/25 hover:bg-white hover:shadow-[0_16px_40px_rgba(0,0,0,0.05)]"
              >
                <Link
                  href={`/search?q=${encodeURIComponent(group.query)}`}
                  className="flex items-center gap-3"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-xl shadow-sm">
                    {group.emoji}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black">{group.title}</h3>
                    <p className="text-xs text-black/45">{group.items.length} alt başlık</p>
                  </div>
                </Link>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.slice(0, 8).map((item) => (
                    <Link
                      key={item}
                      href={`/search?q=${encodeURIComponent(item)}`}
                      className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-[11px] font-bold text-black/65 transition hover:border-[#ff6b00]/30 hover:bg-[#fff7f1] hover:text-[#d95700]"
                    >
                      {item}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="firsatlar" className="border-b border-black/7 bg-white py-10 sm:py-12">
        <div className="container-shell">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <SectionHeader
                eyebrow="Bugün öne çıkan"
                title="En iyi fırsatlar"
                icon={BadgePercent}
                href="/search?q=fırsat"
              />
              {priceOpportunities.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {priceOpportunities.slice(0, 6).map((listing) => (
                    <OpportunityCard key={listing.id} listing={listing} />
                  ))}
                </div>
              ) : (
                <EmptyState text="Fiyat karşılaştırması için henüz yeterli ilan bulunmuyor." />
              )}
            </div>

            <aside className="rounded-3xl border border-[#ff6b00]/20 bg-[#fff7f1] p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-[#ff6b00] text-white">
                  <Flame size={21} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d95700]">
                    Hızlı karar
                  </p>
                  <h2 className="text-xl font-black tracking-[-0.035em]">
                    Piyasa özeti
                  </h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <SummaryRow label="Aktif ilan" value={String(totalListings || last24HourListings.length)} />
                <SummaryRow label="Popüler ürün" value={popularListedProducts[0]?.productName ?? "Veri oluşuyor"} />
                <SummaryRow label="En çok aranan" value={popularProducts[0]?.productName ?? "Aramalar izleniyor"} />
                <SummaryRow label="En iyi fırsat" value={topOpportunity ? formatPrice(topOpportunity.price) : "Yakında"} />
              </div>
              <Link
                href="/market"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111] px-5 py-3 text-sm font-black text-white transition hover:bg-black"
              >
                Piyasa Merkezine Git
                <ArrowUpRight size={16} />
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <section id="piyasa" className="border-b border-black/7 bg-[#fafaf8] py-10 sm:py-12">
        <div className="container-shell">
          <SectionHeader
            eyebrow="Canlı veri alanı"
            title="Piyasa Nabzı"
            icon={BarChart3}
            href="/market"
          />
          <div className="grid gap-5 xl:grid-cols-2">
            <MarketPulseGroup
              title="En çok arananlar"
              items={marketPulse.mostSearchedProducts}
              emptyText="Yeterli piyasa verisi oluşunca burada sinyaller görünecek."
            />
            <MarketPulseGroup
              title="En çok ilanı olanlar"
              items={marketPulse.mostListedProducts}
              emptyText="Yeterli ilan verisi oluşunca burada ürün yoğunluğu görünecek."
            />
            <MarketPulseGroup
              title="Öne çıkan fırsatlar"
              items={marketPulse.topOpportunities}
              emptyText="Fırsat skoru için yeterli piyasa verisi oluşunca burada görünecek."
            />
            <MarketPulseGroup
              title="Fiyatı düşenler"
              items={marketPulse.fallingPriceProducts}
              emptyText="Düşüş trendi yakalanınca burada ürünler listelenecek."
            />
          </div>
        </div>
      </section>

      <section id="yeni-ilanlar" className="border-b border-black/7 bg-white py-10 sm:py-12">
        <div className="container-shell">
          <SectionHeader
            eyebrow="Yeni gelenler"
            title="Son eklenen ilanlar"
            icon={Clock3}
            href="/search"
          />
          {last24HourListings.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {last24HourListings.slice(0, 8).map((listing) => (
                <CompactListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState text="Henüz Supabase'de gösterilecek ilan bulunmuyor." />
          )}
        </div>
      </section>

      <section className="border-b border-black/7 bg-[#fafaf8] py-10 sm:py-12">
        <div className="container-shell">
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <SectionHeader
                eyebrow="Kontrollü alternatifler"
                title="Yenilenmiş cihazlar"
                icon={Smartphone}
                compact
              />
              {refurbishedListings.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {refurbishedListings.slice(0, 4).map((listing) => (
                    <CompactListingCard
                      key={listing.id}
                      listing={listing}
                      badge="Yenilenmiş"
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="Yayınlanmış yenilenmiş cihaz ilanı henüz bulunmuyor." />
              )}
            </div>
            <div>
              <SectionHeader
                eyebrow="Fiyat hareketleri"
                title="Fiyatı düşenler"
                icon={TrendingDown}
                compact
              />
              {priceDrops.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {priceDrops.slice(0, 4).map((listing) => (
                    <PriceDropCard key={listing.id} listing={listing} />
                  ))}
                </div>
              ) : (
                <EmptyState text="Son 24 saatte kaydedilmiş bir fiyat düşüşü bulunmuyor." />
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="kategoriler" className="border-b border-black/7 bg-white py-10 sm:py-12">
        <div className="container-shell">
          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <div>
              <SectionHeader
                eyebrow="Piyasa özeti"
                title="Popüler ürünler"
                icon={PackageSearch}
                compact
              />
              {popularListedProducts.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
                  {popularListedProducts.slice(0, 8).map((product) => (
                    <ProductStatCard key={product.productName} product={product} />
                  ))}
                </div>
              ) : (
                <EmptyState text="Ürün istatistikleri ilanlar eklendikçe burada görünecek." />
              )}
            </div>

            <div>
              <SectionHeader
                eyebrow="Ürün grupları"
                title="Popüler kategoriler"
                icon={FolderSearch2}
                compact
              />
              {popularCategories.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {popularCategories.slice(0, 6).map((category) => (
                    <Link
                      key={category.name}
                      href={`/search?q=${encodeURIComponent(category.name)}`}
                      className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4 transition hover:border-[#ff6b00]/35 hover:bg-[#fff7f1]"
                    >
                      <span className="grid size-10 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
                        <FolderSearch2 size={19} />
                      </span>
                      <h3 className="mt-5 text-sm font-black">{category.name}</h3>
                      <p className="mt-1 text-xs text-black/45">
                        {category.listingCount} ilan
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState text="Ürünlere kategori atandığında popüler kategoriler burada görünecek." />
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="kaynaklar" className="border-b border-black/7 bg-[#fafaf8] py-10 sm:py-12">
        <div className="container-shell">
          <SectionHeader
            eyebrow="Platform dağılımı"
            title="Kaynaklara göre ilanlar"
            icon={Store}
            compact
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {sourceSummary.map((item) => (
              <div
                key={item.source}
                className="min-w-0 rounded-2xl border border-black/8 bg-white p-4 sm:p-5"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
                  <Store size={19} />
                </span>
                <h3 className="mt-4 break-words text-sm font-black">
                  {item.source}
                </h3>
                <p className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#ff6b00]">
                  {item.listingCount}
                </p>
                <p className="text-xs text-black/40">yayındaki ilan</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MobileBottomNav />

      <section className="bg-[#111] py-10 pb-24 text-white sm:py-12 md:pb-12">
        <div className="container-shell">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff8a2a]">
                Neden 2ElBul?
              </p>
              <h2 className="mt-2 max-w-3xl text-2xl font-black tracking-[-0.04em] sm:text-4xl">
                İlan listesi değil, ikinci el karar destek ekranı.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Aynı üründeki ilanları toplar, piyasa ortalamasını çıkarır,
                fırsatları ve fiyat hareketlerini görünür hale getirir.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <DarkFeature title="Piyasa fiyatı" description="Ortalama, medyan ve fiyat aralığı" />
              <DarkFeature title="Fırsat sinyali" description="Piyasanın altındaki ilanları öne çıkarır" />
              <DarkFeature title="Fiyat geçmişi" description="Değişimleri ve düşüşleri takip eder" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function MobileBottomNav() {
  const items = [
    { label: "Ana", href: "/", icon: HomeIcon },
    { label: "Ara", href: "#home-search", icon: Search },
    { label: "Piyasa", href: "/market", icon: BarChart3 },
    { label: "Kategori", href: "#kategori-rehberi", icon: FolderSearch2 },
    { label: "Giriş", href: "/giris", icon: Store },
  ];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 rounded-3xl border border-black/10 bg-white/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-black text-black/55 transition hover:bg-[#fff1e7] hover:text-[#d95700]"
          >
            <Icon size={18} />
            <span className="mt-1">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function HeroMetric({
  title,
  value,
  description,
  icon: Icon,
  suffix = "",
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof Clock3;
  suffix?: string;
}) {
  return (
    <div className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_14px_45px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
          <Icon size={21} />
        </span>
        <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-black text-green-700">
          canlı
        </span>
      </div>
      <p className="mt-6 text-sm font-bold text-black/45">{title}</p>
      <p className="mt-1 text-3xl font-black tracking-[-0.045em]">
        {value.toLocaleString("tr-TR")}{suffix}
      </p>
      <p className="mt-2 text-xs leading-5 text-black/45">{description}</p>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  icon: Icon,
  href,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  icon: typeof Clock3;
  href?: string;
  compact?: boolean;
}) {
  return (
    <div className={`${compact ? "mb-5" : "mb-7"} flex items-end justify-between gap-4`}>
      <div className="flex min-w-0 items-end gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
          <Icon size={21} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff6b00]">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
            {title}
          </h2>
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="hidden shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black transition hover:border-[#ff6b00]/35 hover:bg-[#fff7f1] hover:text-[#d95700] sm:inline-flex"
        >
          Tümünü gör
          <ArrowUpRight size={15} />
        </Link>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#ff6b00]/12 bg-white px-4 py-3">
      <span className="text-sm font-bold text-black/45">{label}</span>
      <span className="max-w-[58%] truncate text-right text-sm font-black" title={value}>
        {value}
      </span>
    </div>
  );
}

function ProductStatCard({
  product,
}: {
  product: { productName: string; listingCount: number; lowestPrice: number; averagePrice: number };
}) {
  return (
    <Link
      href={`/product/${createProductSlug(product.productName)}`}
      className="min-w-0 rounded-2xl border border-black/8 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:shadow-[0_12px_35px_rgba(0,0,0,0.05)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words font-black">
          {product.productName}
        </h3>
        <span className="shrink-0 rounded-full bg-[#fff1e7] px-2.5 py-1 text-xs font-black text-[#d95700]">
          {product.listingCount} ilan
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-black/7 pt-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-black/40">
            En düşük
          </p>
          <p className="mt-1 text-sm font-black text-[#ff6b00] sm:text-base">
            {formatPrice(product.lowestPrice)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-black/40">
            Ortalama
          </p>
          <p className="mt-1 text-sm font-black sm:text-base">
            {formatPrice(product.averagePrice)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function DarkFeature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-[#ff6b00] text-white">
        <BarChart3 size={18} />
      </span>
      <h3 className="mt-4 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/50">{description}</p>
    </div>
  );
}

function HomeSection({
  eyebrow,
  title,
  icon: Icon,
  muted = false,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: typeof Clock3;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`border-t border-black/7 py-12 sm:py-16 ${
        muted ? "bg-[#fafaf8]" : "bg-white"
      }`}
    >
      <div className="container-shell">
        <div className="mb-7 flex items-end gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
            <Icon size={21} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff6b00]">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              {title}
            </h2>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

function IntelligenceSignal({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#ff6b00]/15 bg-white p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-[#111] text-white">
        <BarChart3 size={18} />
      </span>
      <h3 className="mt-4 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-black/50">{description}</p>
    </div>
  );
}

function MarketPulseGroup({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: MarketPulseItem[];
  emptyText: string;
}) {
  return (
    <section className="rounded-2xl border border-black/8 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-black">{title}</h3>
        <span className="rounded-full bg-[#fff1e7] px-2.5 py-1 text-[11px] font-black text-[#d95700]">
          {items.length} sinyal
        </span>
      </div>
      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <Link
              key={`${title}-${item.productName}`}
              href={item.href}
              className="group rounded-2xl border border-black/7 bg-[#fafaf8] p-4 transition hover:border-[#ff6b00]/35 hover:bg-[#fff7f1]"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="break-words text-sm font-black group-hover:text-[#d95700]">
                    {item.productName}
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-black/45">
                    {item.listingCount} ilan · {item.searchCount} arama
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[#ff6b00]/20 bg-white px-2.5 py-1 text-[11px] font-black text-[#d95700]">
                  {item.opportunityLabel}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <PulseMetric
                  label="Ortalama"
                  value={item.averagePrice ? formatPrice(item.averagePrice) : "—"}
                />
                <PulseMetric
                  label="En düşük"
                  value={item.lowestPrice ? formatPrice(item.lowestPrice) : "—"}
                  accent
                />
                <PulseMetric
                  label="Trend"
                  value={formatPulseTrend(item)}
                />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState text={emptyText} />
      )}
    </section>
  );
}

function PulseMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-black/7 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.06em] text-black/35">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-xs font-black ${
          accent ? "text-[#ff6b00]" : ""
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function formatPulseTrend(item: MarketPulseItem) {
  if (item.trendDirection === "unknown") return "—";
  const label =
    item.trendDirection === "falling"
      ? "Düşüyor"
      : item.trendDirection === "rising"
        ? "Yükseliyor"
        : "Stabil";
  return item.trendChangePercent === null
    ? label
    : `${label} %${Math.abs(item.trendChangePercent)}`;
}

function CompactListingCard({
  listing,
  badge,
}: {
  listing: HomeListing;
  badge?: string;
}) {
  const productHref = `/product/${createProductSlug(listing.productName)}`;

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-black/8 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:shadow-[0_12px_35px_rgba(0,0,0,0.06)]">
      <Link href={productHref} className="block min-w-0">
        <ListingImage
          imageUrl={listing.imageUrl}
          productName={listing.productName}
          alt={listing.title}
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-black text-[#d95700]">
            {listing.productName}
          </span>
          {badge && (
            <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-700">
              {badge}
            </span>
          )}
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-black leading-5">
          {listing.title}
        </h3>
      </Link>
      <p className="mt-3 text-xl font-black tracking-[-0.035em] text-[#ff6b00]">
        {formatPrice(listing.price)}
      </p>
      <div className="mt-3 grid gap-1.5 text-xs text-black/45">
        <span className="flex items-center gap-1.5">
          <Store size={13} /> {listing.source}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={13} /> {listing.city}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock3 size={13} /> {formatDate(listing.createdAt)}
        </span>
      </div>
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-[#d95700] hover:underline"
      >
        İlana git <ArrowUpRight size={15} />
      </a>
    </article>
  );
}

function OpportunityCard({ listing }: { listing: PriceOpportunity }) {
  const hasDiscount = listing.discountRate > 0;

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-green-200 bg-green-50/45 p-4">
      <Link
        href={`/product/${createProductSlug(listing.productName)}`}
        className="block min-w-0"
      >
        <ListingImage
          imageUrl={listing.imageUrl}
          productName={listing.productName}
          alt={listing.title}
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-black text-green-800">
            {listing.productName}
          </span>
          <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-black text-green-700">
            {hasDiscount
              ? `Ortalamanın %${listing.discountRate} altında`
              : "Düşük fiyat"}
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-black leading-5">
          {listing.title}
        </h3>
      </Link>
      <p className="mt-3 text-xl font-black tracking-[-0.035em] text-green-700">
        {formatPrice(listing.price)}
      </p>
      {hasDiscount && (
        <p className="mt-1 text-xs text-black/45">
          Ürün ortalaması: {formatPrice(listing.averagePrice)}
        </p>
      )}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-black/45">
        <Store size={13} /> {listing.source}
      </div>
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-green-700 hover:underline"
      >
        İlana git <ArrowUpRight size={15} />
      </a>
    </article>
  );
}

function PriceDropCard({ listing }: { listing: PriceDrop }) {
  return (
    <article className="rounded-2xl border border-green-200 bg-green-50/50 p-5">
      <ListingImage
        imageUrl={listing.imageUrl}
        productName={listing.productName}
        alt={listing.title}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-black text-green-700">
          %{listing.discountRate} düştü
        </span>
        <span className="text-xs text-black/35">{listing.productName}</span>
      </div>
      <h3 className="mt-4 text-base font-black">{listing.title}</h3>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-2xl font-black text-green-700">
          {formatPrice(listing.price)}
        </span>
        <span className="pb-1 text-sm text-black/35 line-through">
          {formatPrice(listing.previousPrice)}
        </span>
      </div>
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-green-700 hover:underline"
      >
        İlana git <ArrowUpRight size={16} />
      </a>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-white px-6 py-10 text-center text-sm font-semibold text-black/45">
      {text}
    </div>
  );
}
