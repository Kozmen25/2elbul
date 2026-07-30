import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BatteryCharging,
  Cable,
  Camera,
  ChevronRight,
  Clock3,
  HardDrive,
  MonitorSmartphone,
  PackageSearch,
  Plug,
  Smartphone,
  Store,
  TriangleAlert,
  Usb,
} from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import type { CategoryListingRecord } from "@/lib/category-intelligence";
import {
  getCategoryPageData,
} from "@/lib/category-intelligence";
import {
  TrustBadge,
  confidenceToTrustLevel,
} from "@/lib/trust-badge";
import {
  formatMarketIntelligenceSources,
  formatMarketIntelligenceTimestamp,
} from "@/app/product/[slug]/market-intelligence-panel";
import { formatCurrencyTRY, formatDateTR } from "@/lib/formatters";
import {
  formatOpportunityFreshness,
  formatOpportunityLevel,
} from "@/lib/opportunity-engine";
import type { MarketPulseItem } from "@/lib/market-pulse";

export const dynamic = "force-dynamic";

const categorySlug = "aksesuar";
const categoryUrl = "https://2elbul.com/category/aksesuar";

export const metadata: Metadata = {
  title: "Telefon Aksesuarı ikinci el kategori analizi | 2ElBul",
  description:
    "Kılıf, şarj aleti, powerbank, ekran koruyucu, kablo, batarya ve diğer telefon aksesuarları için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.",
  alternates: {
    canonical: categoryUrl,
  },
  openGraph: {
    title: "Telefon Aksesuarı ikinci el kategori analizi | 2ElBul",
    description:
      "Telefon aksesuarları ikinci el piyasa analizi — kılıf, şarj aleti, powerbank, ekran koruyucu ve daha fazlası.",
    url: categoryUrl,
    siteName: "2ElBul",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Telefon Aksesuarı ikinci el kategori analizi | 2ElBul",
    description:
      "2ElBul, ikinci el telefon aksesuarları piyasasını analiz eder.",
  },
};

const subCategories = [
  {
    slug: "kilif",
    label: "Kılıflar",
    description: "iPhone, Samsung ve diğer telefonlar için ikinci el kılıf fırsatları.",
    icon: Smartphone,
  },
  {
    slug: "sarj-aleti",
    label: "Şarj Aletleri",
    description: "Hızlı şarj adaptörleri ve duvar şarj cihazları ikinci el piyasası.",
    icon: Plug,
  },
  {
    slug: "kablo",
    label: "Kablo",
    description: "USB-C, Lightning, Micro USB data kabloları ikinci el fiyatları.",
    icon: Cable,
  },
  {
    slug: "powerbank",
    label: "Powerbank",
    description: "Taşınabilir şarj cihazları ve powerbank ikinci el piyasa analizi.",
    icon: BatteryCharging,
  },
  {
    slug: "ekran-koruyucu",
    label: "Ekran Koruyucu",
    description: "Tempered glass ve film ekran koruyucuları ikinci el fiyatları.",
    icon: MonitorSmartphone,
  },
  {
    slug: "batarya",
    label: "Batarya",
    description: "Telefon yedek bataryaları ve pil değişim ürünleri ikinci el.",
    icon: BatteryCharging,
  },
  {
    slug: "tutucu",
    label: "Tutucu",
    description: "Araç telefon tutucu, masaüstü stand ve manyetik aparatlar.",
    icon: Usb,
  },
  {
    slug: "adaptor",
    label: "Adaptör",
    description: "Dönüştürücü, çoklu giriş adaptörleri ve USB hub ikinci el.",
    icon: HardDrive,
  },
  {
    slug: "lens-kiti",
    label: "Lens Kiti",
    description: "Telefon harici lensleri, geniş açı ve makro lens kitleri.",
    icon: Camera,
  },
  {
    slug: "selfie",
    label: "Selfie Çubuğu",
    description: "Selfie çubuğu, monopod ve tripod aksesuarları ikinci el.",
    icon: Camera,
  },
];

export default async function AksesuarPage() {
  const categoryData = await getCategoryPageData(categorySlug);

  const fallbackName = "Telefon Aksesuarı";
  const fallbackShortDescription = "Telefon aksesuarları ikinci el piyasa analizi";
  const fallbackLongDescription =
    "Kılıf, şarj aleti, powerbank, ekran koruyucu, kablo, batarya, tutucu, adaptör ve diğer telefon aksesuarları için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.";

  const categoryName = categoryData?.categoryName ?? fallbackName;
  const shortDescription = categoryData?.shortDescription ?? fallbackShortDescription;
  const longDescription = categoryData?.longDescription ?? fallbackLongDescription;
  const productCount = categoryData?.productCount ?? 0;
  const listingCount = categoryData?.listingCount ?? 0;
  const marketIntelligence = categoryData?.marketIntelligence ?? null;
  const opportunityAnalysis = categoryData?.opportunityAnalysis ?? null;
  const topOpportunities = categoryData?.topOpportunities ?? [];
  const popularProducts = categoryData?.popularProducts ?? [];
  const latestListings = categoryData?.latestListings ?? [];
  const brandDistribution = categoryData?.brandDistribution ?? [];
  const faqItems = categoryData?.faqItems ?? fallbackFaq;
  const jsonLd = categoryData?.jsonLd ?? [];

  const hasEnoughData = (marketIntelligence?.sampleSize ?? 0) >= 3;
  const sourceLabel = marketIntelligence
    ? formatMarketIntelligenceSources(marketIntelligence.sourcesUsed)
    : "";
  const summaryHighlights = marketIntelligence?.marketSummary.highlights.slice(0, 4) ?? [];
  const summaryWarnings = marketIntelligence?.marketSummary.warnings.slice(0, 3) ?? [];
  const totalBrandListings = brandDistribution.reduce(
    (total, brand) => total + brand.listingCount,
    0,
  );

  return (
    <main className="min-w-0 bg-[#fafaf8] py-10 sm:py-14">
      {jsonLd.map((document, index) => (
        <script
          key={`${document["@type"]}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(document).replace(/</g, "\\u003c"),
          }}
        />
      ))}

      <div className="container-shell min-w-0">
        <Breadcrumbs
          items={[
            { label: "Ana Sayfa", href: "/" },
            { label: "Telefon Aksesuarı" },
          ]}
        />

        <section className="mt-4 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8 lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff6b00]">
                Kategori analizi
              </p>
              <h1 className="mt-3 break-words text-4xl font-black tracking-[-0.055em] sm:text-6xl">
                {categoryName}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-black/58 sm:text-base">
                {longDescription}
              </p>
              <p className="mt-3 text-sm font-semibold text-black/48">
                {productCount.toLocaleString("tr-TR")} ürün ·{" "}
                {listingCount.toLocaleString("tr-TR")} ilan
              </p>
            </div>

            {opportunityAnalysis ? (
              <div className="rounded-3xl border border-[#ff6b00]/18 bg-[#fff7f1] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#d95700]/75">
                  Karar özeti
                </p>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-black tracking-[-0.04em] text-[#d95700]">
                      {opportunityAnalysis.recommendation.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-black/60">
                      {opportunityAnalysis.recommendation.description}
                    </p>
                  </div>
                  <span className="rounded-2xl border border-white/70 bg-white px-3 py-2 text-right text-xs font-black text-black shadow-sm">
                    <span className="block text-[10px] uppercase tracking-[0.08em] text-black/35">
                      Fırsat skoru
                    </span>
                    <span className="mt-1 block text-lg text-[#d95700]">
                      {opportunityAnalysis.opportunityScore}/100
                    </span>
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {opportunityAnalysis.positiveSignals.slice(0, 3).map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-semibold leading-5 text-green-800"
                    >
                      {signal}
                    </span>
                  ))}
                  {opportunityAnalysis.warningSignals.slice(0, 2).map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold leading-5 text-amber-800"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard
              label="Analiz edilen ilan"
              value={(marketIntelligence?.sampleSize ?? 0).toLocaleString("tr-TR")}
            />
            <StatCard
              label="Ortalama fiyat"
              value={formatPrice(marketIntelligence?.priceAnalysis.averagePrice)}
            />
            <StatCard
              label="En düşük fiyat"
              value={formatPrice(marketIntelligence?.priceAnalysis.minPrice)}
              accent
            />
            <StatCard
              label="Kaynak sayısı"
              value={(marketIntelligence?.marketSummary.sourceCount ?? 0).toLocaleString("tr-TR")}
            />
            <div className="min-w-0 rounded-2xl border border-[#ff6b00]/20 bg-[#fff7f1] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
                Güven
              </p>
              <div className="mt-2">
                <TrustBadge
                  level={confidenceToTrustLevel(
                    marketIntelligence?.confidenceLevel ?? "low",
                    marketIntelligence?.sampleSize ?? 0,
                  )}
                  size="md"
                />
              </div>
            </div>
            <StatCard
              label="Risk seviyesi"
              value={opportunityAnalysis ? formatOpportunityLevel(opportunityAnalysis.riskLevel) : "—"}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
                Market Intelligence özeti
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-black/60">
                {marketIntelligence?.marketSummary.summary ?? "Henüz yeterli veri bulunmuyor."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {summaryHighlights.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-semibold leading-5 text-black/55"
                  >
                    {item}
                  </span>
                ))}
              </div>
              {summaryWarnings.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {summaryWarnings.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold leading-5 text-amber-800"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
                Analiz zamanı
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-black/60">
                Son güncelleme:{" "}
                {marketIntelligence
                  ? formatMarketIntelligenceTimestamp(marketIntelligence.analysisGeneratedAt)
                  : "—"}
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-black/60">
                Kullanılan kaynaklar: {sourceLabel || "—"}
              </p>
              <p className="mt-3 text-xs font-semibold leading-6 text-black/45">
                Bu karar, {(marketIntelligence?.sampleSize ?? 0).toLocaleString("tr-TR")} ilan
                üzerinden üretildi.
              </p>
              {!hasEnoughData ? (
                <div className="mt-4 flex gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                  <TriangleAlert className="mt-0.5 shrink-0" size={17} />
                  <span>Yetersiz veri: karar notu daha fazla ilan geldikçe otomatik olarak güçlenecek.</span>
                </div>
              ) : (
                <div className="mt-4 flex gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold leading-6 text-green-900">
                  <BadgeCheck className="mt-0.5 shrink-0 text-green-700" size={17} />
                  <span>Bu kategori sayfası yeterli veriyle oluşturuldu.</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <nav className="mt-5 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {[
            { label: "Alt kategoriler", href: "#alt-kategoriler" },
            { label: "Fırsatlar", href: "#firsatlar" },
            { label: "Popüler ürünler", href: "#populer-urunler" },
            { label: "Son ilanlar", href: "#son-ilanlar" },
            { label: "Marka dağılımı", href: "#marka-dagilimi" },
            { label: "SSS", href: "#sss" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black transition hover:border-[#ff6b00]/35 hover:bg-[#fff7f1] hover:text-[#d95700]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <section id="alt-kategoriler" className="mt-6 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={PackageSearch}
            eyebrow="Alt kategoriler"
            title="Telefon Aksesuarı Alt Kategorileri"
          />
          <p className="mt-3 max-w-3xl text-sm leading-7 text-black/58">
            İkinci el telefon aksesuarları piyasasında en çok aranan alt kategoriyi seçerek
            detaylı analizlere ulaşın.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subCategories.map((sub) => {
              const Icon = sub.icon;
              return (
                <Link
                  key={sub.slug}
                  href={`/aksesuar/${sub.slug}`}
                  className="flex items-start gap-4 rounded-2xl border border-black/8 bg-[#fafaf8] p-5 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:bg-white hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)]"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
                    <Icon size={24} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-black leading-6">{sub.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-black/55">{sub.description}</p>
                  </div>
                  <ArrowUpRight className="mt-1 shrink-0 text-black/25" size={16} />
                </Link>
              );
            })}
          </div>
        </section>

        <section id="firsatlar" className="mt-6 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={BarChart3}
            eyebrow="Öne çıkan fırsatlar"
            title="En İyi Fırsatlar"
          />
          {topOpportunities.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topOpportunities.map((item) => (
                <OpportunityCard key={item.productName} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu kategori için henüz yeterli fırsat sinyali oluşmadı." />
          )}
        </section>

        <section id="populer-urunler" className="mt-6 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={PackageSearch}
            eyebrow="Popüler sinyaller"
            title="En Popüler Ürünler"
          />
          {popularProducts.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {popularProducts.map((item) => (
                <PopularProductCard key={item.productName} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu kategori için henüz popüler ürün sinyali oluşmadı." />
          )}
        </section>

        <section id="son-ilanlar" className="mt-6 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={Clock3}
            eyebrow="Yeni veri"
            title="Son Eklenen İlanlar"
          />
          {latestListings.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {latestListings.map((listing) => (
                <LatestListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu kategori için henüz yeni ilan bulunmuyor." />
          )}
        </section>

        <section id="marka-dagilimi" className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <SectionTitle
              icon={Store}
              eyebrow="Marka dağılımı"
              title="Kategorideki Markalar"
            />
            {brandDistribution.length > 0 ? (
              <div className="mt-6 grid gap-3">
                {brandDistribution.map((brand) => (
                  <BrandCard
                    key={brand.brandSlug}
                    brand={brand}
                    totalListings={totalBrandListings}
                  />
                ))}
              </div>
            ) : (
              <EmptyState text="Bu kategori için henüz marka dağılımı oluşmadı." />
            )}
          </div>

          <div className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <SectionTitle
              icon={BadgeCheck}
              eyebrow="Güven notları"
              title="Güven Özeti"
            />
            <div className="mt-6 grid gap-3">
              <TrustBadge
                level={confidenceToTrustLevel(
                  marketIntelligence?.confidenceLevel ?? "low",
                  marketIntelligence?.sampleSize ?? 0,
                )}
                size="md"
              />
              <StatCard
                label="Güven nedeni"
                value={marketIntelligence?.confidenceReasons[0] ?? "Henüz yeterli veri yok"}
                accent
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {(marketIntelligence?.confidenceReasons ?? []).slice(0, 4).map((reason) => (
                <span
                  key={reason}
                  className="rounded-full border border-black/8 bg-[#fafaf8] px-3 py-1.5 text-xs font-semibold leading-5 text-black/55"
                >
                  {reason}
                </span>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
                İç linkleme
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/market"
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/60 transition hover:border-[#ff6b00]/35 hover:text-[#d95700]"
                >
                  Piyasa merkezi
                </Link>
                <Link
                  href="/search?q=telefon+aksesuar%C4%B1"
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/60 transition hover:border-[#ff6b00]/35 hover:text-[#d95700]"
                >
                  Aksesuar araması
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="sss" className="mt-6 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle icon={TriangleAlert} eyebrow="Sık sorulanlar" title="SSS" />
          <div className="mt-6 grid gap-3">
            {faqItems.map((faq) => (
              <details
                key={faq.question}
                className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4"
              >
                <summary className="cursor-pointer list-none text-sm font-black leading-6 text-black">
                  {faq.question}
                </summary>
                <p className="mt-3 text-sm leading-7 text-black/60">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function OpportunityCard({ item }: { item: MarketPulseItem }) {
  return (
    <article className="min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-5 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:bg-white hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-black leading-6">
            {item.productName}
          </h2>
          <p className="mt-2 text-xs font-bold text-black/40">
            {item.listingCount} ilan · {item.searchCount} arama
          </p>
        </div>
        <span className="rounded-full border border-green-200 bg-white px-3 py-1.5 text-[11px] font-black text-green-700">
          {item.decisionLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniMetric label="Fırsat skoru" value={`${item.opportunityScore}/100`} accent />
        <MiniMetric
          label="Piyasa avantajı"
          value={item.lowestPrice && item.averagePrice
            ? `${Math.max(0, Math.round(((item.averagePrice - item.lowestPrice) / item.averagePrice) * 100))}%`
            : "—"}
        />
        <MiniMetric
          label="Ortalama fiyat"
          value={formatPrice(item.averagePrice)}
        />
        <MiniMetric label="En düşük fiyat" value={formatPrice(item.lowestPrice)} />
      </div>

      <Link href={item.href} className="orange-button mt-5 w-full justify-center py-3">
        Ürün detayına git
        <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}

function PopularProductCard({ item }: { item: MarketPulseItem }) {
  return (
    <article className="min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-black leading-6">
            {item.productName}
          </h2>
          <p className="mt-2 text-xs font-bold text-black/40">
            {item.listingCount} ilan · {item.searchCount} arama
          </p>
        </div>
        <span className="rounded-full border border-[#ff6b00]/20 bg-white px-3 py-1.5 text-[11px] font-black text-[#d95700]">
          {item.opportunityLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniMetric label="Ortalama fiyat" value={formatPrice(item.averagePrice)} />
        <MiniMetric label="En düşük fiyat" value={formatPrice(item.lowestPrice)} accent />
        <MiniMetric label="Güven" value={`%${item.buyScore}`} />
        <MiniMetric
          label="Trend"
          value={formatTrend(item.trendDirection, item.trendChangePercent)}
        />
      </div>

      <Link href={item.href} className="orange-button mt-5 w-full justify-center py-3">
        Ürün detayına git
        <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}

function LatestListingCard({ listing }: { listing: CategoryListingRecord }) {
  return (
    <article className="min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-black/35">
            {listing.productName}
          </p>
          <h2 className="mt-2 break-words text-lg font-black leading-6">
            {listing.title}
          </h2>
        </div>
        {listing.confidenceLevel ? (
            <TrustBadge level={confidenceToTrustLevel(listing.confidenceLevel)} />
          ) : null}
      </div>

      <p className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#ff6b00]">
        {formatPrice(listing.price)}
      </p>

      <div className="mt-4 grid gap-2 border-t border-black/7 pt-4 text-xs font-semibold text-black/50">
        <span className="inline-flex items-center gap-2">
          <Store size={14} /> {listing.source}
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock3 size={14} /> {formatListingDate(listing.createdAt)}
        </span>
        <span className="inline-flex items-center gap-2">
          <ChevronRight size={14} /> {listing.city}
        </span>
      </div>

      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="orange-button mt-5 w-full justify-center py-3"
      >
        İlana Git
        <ArrowUpRight size={17} />
      </a>
    </article>
  );
}

function BrandCard({
  brand,
  totalListings,
}: {
  brand: {
    brandSlug: string;
    brandName: string;
    productCount: number;
    listingCount: number;
    share: number;
  };
  totalListings: number;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/brand/${brand.brandSlug}`}
            className="break-words text-sm font-black transition hover:text-[#d95700]"
          >
            {brand.brandName}
          </Link>
          <p className="mt-1 text-xs font-semibold text-black/45">
            {brand.productCount} ürün · {brand.listingCount} ilan
          </p>
        </div>
        <span className="rounded-full border border-white bg-white px-3 py-1.5 text-[11px] font-black text-[#d95700]">
          %{Math.round(brand.share * 100)}
        </span>
      </div>
      {totalListings > 0 ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full rounded-full bg-[#ff6b00]"
            style={{ width: `${Math.max(4, Math.round(brand.share * 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
        {label}
      </p>
      <p
        className={`mt-2 break-words text-base font-black leading-6 ${
          accent ? "text-[#d95700]" : ""
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-black/8 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.06em] text-black/35">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-black ${
          accent ? "text-[#ff6b00]" : ""
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: typeof BarChart3;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
        <Icon size={21} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#ff6b00]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">{title}</h2>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-12 text-center text-sm font-semibold text-black/45">
      {text}
    </div>
  );
}

function formatTrend(
  direction: "rising" | "falling" | "stable" | "unknown",
  changePercent: number | null,
) {
  if (direction === "unknown") return "—";
  const label =
    direction === "falling"
      ? "Düşüyor"
      : direction === "rising"
        ? "Yükseliyor"
        : "Stabil";
  return changePercent === null ? label : `${label} %${Math.abs(changePercent)}`;
}

function formatListingDate(value: string) {
  return formatDateTR(value, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value: number | null | undefined) {
  return formatCurrencyTRY(value);
}

const fallbackFaq = [
  {
    question: "İkinci el telefon aksesuarı almak güvenli midir?",
    answer:
      "2ElBul, ikinci el telefon aksesuarlarını güvenilir kaynaklardan derleyerek fiyat karşılaştırması ve piyasa analizi sunar. Kılıf, şarj aleti, powerbank ve diğer aksesuarların fiyat dağılımını görerek bilinçli karar verebilirsiniz.",
  },
  {
    question: "Hangi telefon aksesuarı kategorileri analiz ediliyor?",
    answer:
      "Kılıf, şarj aleti, kablo, powerbank, ekran koruyucu, batarya, telefon tutucu, adaptör, lens kiti ve selfie çubuğu olmak üzere 10 alt kategoride ikinci el piyasa analizi sunuyoruz. Her kategori için fırsat sinyalleri ve fiyat trendleri takip ediliyor.",
  },
  {
    question: "Telefon aksesuarları için hangi kaynaklar taranıyor?",
    answer:
      "EasyCep, Getmobil, Hepsiburada, Teknosa, MediaMarkt ve Sahibinden gibi önde gelen ikinci el ve elektronik platformları düzenli olarak taranır. Bu sayede geniş bir veri yelpazesiyle piyasa istihbaratı sunarız.",
  },
  {
    question: "Aksesuar fırsat sinyalleri nasıl hesaplanıyor?",
    answer:
      "Fırsat sinyalleri, ilan fiyatlarının piyasa ortalamasına göre konumu, ilan hacmi, fiyat düşüş trendi ve arama talebi gibi faktörlerin programmatic SEO ve yapay zeka destekli analiziyle belirlenir.",
  },
  {
    question: "İkinci el aksesuar alırken nelere dikkat etmeliyim?",
    answer:
      "Ürünün orijinalliği, fiziksel durumu ve fiyatının piyasa ortalamasına uygunluğu önemlidir. 2ElBul, şeffaf fiyat karşılaştırması ve güvenilir kaynak verileriyle bilinçli alışveriş kararları almanıza yardımcı olur.",
  },
];
