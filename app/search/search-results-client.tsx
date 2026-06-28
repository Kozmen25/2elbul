"use client";

import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Store,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { ListingImage } from "@/components/listing-image";
import { LISTING_CONDITIONS, type Listing } from "@/lib/listings";
import {
  analyzeListingPrice,
  type ProductPriceStats,
} from "@/lib/price-analysis";
import { calculateOpportunityRating } from "@/lib/price-insights";
import { createProductSlug } from "@/lib/product-slug";
import { recordSearch } from "./actions";

type SortOption = "price-asc" | "most-listings" | "confidence" | "newest";
type ViewOption = "both" | "products" | "listings";

type ProductSummary = {
  productId: string;
  productName: string;
  slug: string;
  listingCount: number;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  newestAt: string;
  confidenceScore: number | null;
  confidenceLabel: "Yüksek güven" | "Orta güven" | "Düşük güven" | "Veri yetersiz";
};

type SearchResultsClientProps = {
  query: string;
  initialListings: Listing[];
  productPriceStats: Record<string, ProductPriceStats>;
  loadError?: string;
  favoriteListingIds: string[];
  isAuthenticated: boolean;
  shouldQueueSearchDemand: boolean;
};

const searchDemandMessage =
  "Bu ürün için piyasayı tarıyoruz. Yeni ilanlar geldikçe sonuçlar güncellenecek.";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);

const formatFilterPrice = (price: number) =>
  `${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(price)} TL`;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));

export function SearchResultsClient({
  query,
  initialListings,
  productPriceStats,
  loadError = "",
  favoriteListingIds,
  isAuthenticated,
  shouldQueueSearchDemand,
}: SearchResultsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [city, setCity] = useState(() => searchParams.get("city") ?? "");
  const [source, setSource] = useState(() => searchParams.get("source") ?? "");
  const [condition, setCondition] = useState(
    () => searchParams.get("condition") ?? "",
  );
  const [minimumPrice, setMinimumPrice] = useState(
    () => searchParams.get("min") ?? "",
  );
  const [maximumPrice, setMaximumPrice] = useState(
    () => searchParams.get("max") ?? "",
  );
  const [sort, setSort] = useState<SortOption>(() =>
    parseSortOption(searchParams.get("sort")),
  );
  const [view, setView] = useState<ViewOption>(() =>
    parseViewOption(searchParams.get("view")),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [demandMessage, setDemandMessage] = useState(
    shouldQueueSearchDemand ? searchDemandMessage : "",
  );

  useEffect(() => {
    if (!query) return;

    const trackingKey = `2elbul-search:${query.toLocaleLowerCase("tr-TR")}`;
    if (sessionStorage.getItem(trackingKey)) return;

    sessionStorage.setItem(trackingKey, "1");
    void recordSearch(query);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (minimumPrice) params.set("min", minimumPrice);
    if (maximumPrice) params.set("max", maximumPrice);
    if (source) params.set("source", source);
    if (city) params.set("city", city);
    if (condition) params.set("condition", condition);
    if (sort !== "price-asc") params.set("sort", sort);
    if (view !== "both") params.set("view", view);

    const nextUrl = `${pathname}${params.toString() ? `?${params}` : ""}`;
    const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [
    city,
    condition,
    maximumPrice,
    minimumPrice,
    pathname,
    query,
    router,
    searchParams,
    sort,
    source,
    view,
  ]);

  useEffect(() => {
    if (!shouldQueueSearchDemand) {
      setDemandMessage("");
      return;
    }

    const demandKey = `2elbul-search-demand:${query.toLocaleLowerCase("tr-TR")}`;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const refreshLater = (delay: number) => {
      const timer = setTimeout(() => {
        if (!cancelled) router.refresh();
      }, delay);
      timers.push(timer);
    };

    async function runInstantSearch() {
      setDemandMessage(searchDemandMessage);

      if (!sessionStorage.getItem(demandKey)) {
        try {
          const demandResponse = await fetch("/api/search-demand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query,
              resultCount: initialListings.length,
            }),
          });

          if (demandResponse.ok) {
            sessionStorage.setItem(demandKey, "1");
          } else {
            console.error("Search demand request failed:", demandResponse.status);
          }
        } catch (error) {
          console.error("Search demand request failed:", error);
        }
      }

      try {
        const botResponse = await fetch("/api/search/instant-bot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!botResponse.ok) {
          console.error("Instant search bot request failed:", botResponse.status);
        } else {
          const botResult = (await botResponse.json().catch(() => null)) as {
            noResults?: number;
            noResultsMessage?: string | null;
          } | null;
          if (botResult?.noResults) {
            setDemandMessage(
              "Şu an bu ürün için güvenilir kaynaklarda ilan bulunamadı. Takip ediyoruz.",
            );
          }
        }
      } catch (error) {
        console.error("Instant search bot request failed:", error);
      }

      refreshLater(5000);
      refreshLater(10000);
      const finalTimer = setTimeout(() => {
        if (!cancelled) {
          setDemandMessage(
            "Tarama devam ediyor. Birazdan tekrar kontrol edebilirsin.",
          );
          router.refresh();
        }
      }, 15000);
      timers.push(finalTimer);
    }

    void runInstantSearch();

    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [initialListings.length, query, router, shouldQueueSearchDemand]);

  const cities = useMemo(
    () => [...new Set(initialListings.map((listing) => listing.city))].sort(),
    [initialListings],
  );
  const sources = useMemo(
    () => [...new Set(initialListings.map((listing) => listing.source))].sort(),
    [initialListings],
  );

  const results = useMemo(() => {
    const min = minimumPrice === "" ? null : Number(minimumPrice);
    const max = maximumPrice === "" ? null : Number(maximumPrice);

    return initialListings
      .filter(
        (listing) =>
          (!city || listing.city === city) &&
          (!source || normalizeFilterValue(listing.source) === source) &&
          (!condition || listing.condition === condition) &&
          (min === null || listing.price >= min) &&
          (max === null || listing.price <= max),
      )
      .sort((a, b) => {
        if (sort === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.price - b.price;
      });
  }, [
    city,
    condition,
    initialListings,
    maximumPrice,
    minimumPrice,
    sort,
    source,
  ]);

  const prices = results.map((listing) => listing.price);
  const productSummaries = useMemo(
    () => buildProductSummaries(results, sort),
    [results, sort],
  );
  const cheapestProduct = productSummaries[0] ?? null;
  const marketRange = productSummaries.length
    ? {
        min: Math.min(...productSummaries.map((product) => product.lowestPrice)),
        max: Math.max(...productSummaries.map((product) => product.averagePrice)),
      }
    : null;
  const lowestPrice = prices.length ? Math.min(...prices) : 0;
  const highestPrice = prices.length ? Math.max(...prices) : 0;
  const averagePrice = prices.length
    ? Math.round(prices.reduce((total, price) => total + price, 0) / prices.length)
    : 0;
  const activeFilterCount = [
    city,
    source,
    condition,
    minimumPrice,
    maximumPrice,
    view !== "both" ? view : "",
  ].filter(Boolean).length;
  const favoriteIds = useMemo(
    () => new Set(favoriteListingIds),
    [favoriteListingIds],
  );
  const loginNext = query ? `/search?q=${encodeURIComponent(query)}` : "/search";

  function resetFilters() {
    setCity("");
    setSource("");
    setCondition("");
    setMinimumPrice("");
    setMaximumPrice("");
    setSort("price-asc");
    setView("both");
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`, {
      scroll: false,
    });
  }

  return (
    <section className="container-shell min-w-0 py-10 sm:py-14">
      <div className="mb-8">
        <p className="text-sm font-bold text-[#ff6b00]">Aranan ürün</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
          {query || "Bir ürün ara"}
        </h1>
        <p className="mt-2 text-black/45">
          {query
            ? `${results.length} ilan bulundu`
            : "Fiyatları karşılaştırmak için yukarıdaki kutudan arama yap."}
        </p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center text-amber-800">
          <h2 className="text-lg font-black">İlanlar şu anda gösterilemiyor.</h2>
          <p className="mt-2 text-sm">{loadError}</p>
        </div>
      ) : initialListings.length > 0 ? (
        <>
          {demandMessage && (
            <div className="mb-6 rounded-2xl border border-[#ff6b00]/20 bg-[#fff7f1] px-5 py-4 text-sm font-bold text-[#d95700]">
              {demandMessage}
            </div>
          )}

          <SearchSummary
            query={query}
            productCount={productSummaries.length}
            listingCount={results.length}
            cheapestProduct={cheapestProduct}
            marketRange={marketRange}
          />

          <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex flex-1 items-center justify-between rounded-xl border border-black/12 bg-white px-4 py-3.5 text-sm font-bold"
              aria-expanded={filtersOpen}
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal size={18} />
                Filtreler
                {activeFilterCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-[#ff6b00] text-[11px] text-white">
                    {activeFilterCount}
                  </span>
                )}
              </span>
              {filtersOpen ? <X size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          <div
            className={`mb-8 rounded-2xl border border-black/9 bg-[#fafaf8] p-4 sm:p-5 ${
              filtersOpen ? "block" : "hidden"
            } lg:block`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-black">
                <SlidersHorizontal size={18} className="text-[#ff6b00]" />
                Filtrele ve sırala
              </h2>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-[#ff6b00]"
                >
                  <RotateCcw size={14} />
                  Temizle
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
              <FilterSelect label="Şehir" value={city} onChange={setCity}>
                <option value="">Tüm şehirler</option>
                {cities.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </FilterSelect>

              <FilterSelect label="Kaynak" value={source} onChange={setSource}>
                <option value="">Tüm kaynaklar</option>
                {sources.map((item) => (
                  <option key={item} value={normalizeFilterValue(item)}>
                    {item}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Durum"
                value={condition}
                onChange={setCondition}
              >
                <option value="">Tüm durumlar</option>
                {LISTING_CONDITIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </FilterSelect>

              <FilterInput
                label="Minimum fiyat"
                value={minimumPrice}
                onChange={setMinimumPrice}
                placeholder="0 TL"
              />
              <FilterInput
                label="Maksimum fiyat"
                value={maximumPrice}
                onChange={setMaximumPrice}
                placeholder="50.000 TL"
              />

              <FilterSelect
                label="Sıralama"
                value={sort}
                onChange={(value) => setSort(value as SortOption)}
                wide
              >
                <option value="price-asc">En ucuz</option>
                <option value="most-listings">En çok ilan</option>
                <option value="confidence">En yüksek güven</option>
                <option value="newest">En yeni</option>
              </FilterSelect>

              <FilterSelect
                label="Görünüm"
                value={view}
                onChange={(value) => setView(value as ViewOption)}
                wide
              >
                <option value="both">İkisi birlikte</option>
                <option value="products">Ürün karşılaştırması</option>
                <option value="listings">İlan listesi</option>
              </FilterSelect>
            </div>

            <FilterSummary
              minimumPrice={minimumPrice}
              maximumPrice={maximumPrice}
              source={source}
              sources={sources}
              view={view}
            />
          </div>

          {view !== "listings" ? (
            <ProductComparisonSection products={productSummaries} />
          ) : null}

          {view !== "products" ? (
            <>
          <div className="mb-10 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Bulunan ilan" value={`${results.length}`} />
            <StatCard
              label="En düşük fiyat"
              value={results.length ? formatPrice(lowestPrice) : "—"}
              accent
            />
            <StatCard
              label="Ortalama fiyat"
              value={results.length ? formatPrice(averagePrice) : "—"}
            />
            <StatCard
              label="En yüksek fiyat"
              value={results.length ? formatPrice(highestPrice) : "—"}
            />
          </div>

          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-black tracking-[-0.03em] sm:text-2xl">
              İlanlar
            </h2>
            <span className="text-sm font-semibold text-black/45">
              {sort === "most-listings"
                ? "En çok ilana göre"
                : sort === "confidence"
                  ? "En yüksek güvene göre"
                : sort === "newest"
                  ? "En yeni"
                  : "En ucuz"}
            </span>
          </div>

          {results.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.map((listing) => (
                <article
                  key={listing.id}
                  className="flex min-w-0 flex-col rounded-2xl border border-black/9 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)]"
                >
                  <ListingImage
                    imageUrl={listing.imageUrl}
                    productName={listing.productName}
                    alt={listing.title}
                  />
                  <div className="mb-4 mt-4 flex items-start justify-between gap-4">
                    <Link
                      href={`/product/${createProductSlug(listing.productName)}`}
                      className="min-w-0 truncate rounded-full bg-[#fff1e7] px-3 py-1.5 text-xs font-bold text-[#d95700] hover:bg-[#ffe5d2]"
                      title={`${listing.productName} ürün detayına git`}
                    >
                      {listing.productName}
                    </Link>
                    <FavoriteButton
                      listingId={listing.id}
                      initialIsFavorite={favoriteIds.has(listing.id)}
                      isAuthenticated={isAuthenticated}
                      loginNext={loginNext}
                      compact
                    />
                  </div>

                  <h3 className="min-h-12 break-words text-base font-black leading-6">
                    {listing.title}
                  </h3>
                  <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#ff6b00]">
                    {formatPrice(listing.price)}
                  </p>
                  <SmartPriceRatingBadge
                    price={listing.price}
                    stats={
                      listing.productId
                        ? productPriceStats[listing.productId]
                        : undefined
                    }
                  />

                  <div className="mt-5 grid gap-2.5 border-t border-black/7 pt-4 text-sm text-black/55">
                    <p className="flex items-center gap-2">
                      <MapPin size={16} className="text-black/35" />
                      {listing.city}
                    </p>
                    <p className="flex items-center gap-2">
                      <Store size={16} className="text-black/35" />
                      {listing.source}
                    </p>
                    <p className="flex items-center gap-2">
                      <Tag size={16} className="text-black/35" />
                      <ConditionBadge condition={listing.condition} />
                    </p>
                    <p className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-black/35" />
                      {formatDate(listing.createdAt)}
                    </p>
                  </div>

                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="orange-button mt-5 w-full py-3"
                  >
                    İlana git
                    <ArrowUpRight size={17} />
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-16 text-center">
              <h2 className="text-xl font-black">Bu filtrelerle sonuç bulunamadı.</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm font-semibold text-black/50">
                Filtreleri temizlemeyi deneyin veya fiyat aralığını genişletin.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 text-sm font-bold text-[#ff6b00] hover:underline"
              >
                Filtreleri temizle
              </button>
            </div>
          )}
            </>
          ) : null}
        </>
      ) : query ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-16 text-center">
          <h2 className="text-xl font-black">
            Bu arama için henüz eşleşen ilan bulamadık.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-black/55">
            Araman izlemeye alındı. Güvenilir kaynaklarda yeni ilan buldukça sonuçlar burada güncellenecek.
          </p>
          {demandMessage && (
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold text-black/55">
              {demandMessage}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ConditionBadge({ condition }: { condition: string }) {
  return (
    <span
      className={
        condition === "Yenilenmiş"
          ? "rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700"
          : ""
      }
    >
      {condition}
    </span>
  );
}

function FilterSummary({
  minimumPrice,
  maximumPrice,
  source,
  sources,
  view,
}: {
  minimumPrice: string;
  maximumPrice: string;
  source: string;
  sources: string[];
  view: ViewOption;
}) {
  const visibleChips = [
    minimumPrice || maximumPrice
      ? `${minimumPrice ? formatFilterPrice(Number(minimumPrice)) : "0 TL"} - ${
          maximumPrice ? formatFilterPrice(Number(maximumPrice)) : "üst sınır yok"
        } arası`
      : "",
    source ? `Kaynak: ${getSourceLabel(source, sources)}` : "",
    `Görünüm: ${getViewLabel(view)}`,
  ].filter(Boolean);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {visibleChips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-black text-black/55"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function SearchSummary({
  query,
  productCount,
  listingCount,
  cheapestProduct,
  marketRange,
}: {
  query: string;
  productCount: number;
  listingCount: number;
  cheapestProduct: ProductSummary | null;
  marketRange: { min: number; max: number } | null;
}) {
  return (
    <div className="mb-8 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff6b00]">
            Arama özeti
          </p>
          <h2 className="mt-2 break-words text-2xl font-black tracking-[-0.04em] sm:text-3xl">
            “{query}” için ürün karşılaştırması
          </h2>
          <p className="mt-2 text-sm font-semibold text-black/45">
            Ürünleri ilan sayısı, fiyat aralığı ve güven skoruna göre hızlıca kıyasla.
          </p>
        </div>
        {cheapestProduct ? (
          <Link
            href={`/product/${cheapestProduct.slug}`}
            className="orange-button w-full justify-center py-3 lg:w-auto"
          >
            En ucuz ürüne git
            <ArrowUpRight size={17} />
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bulunan ürün" value={`${productCount}`} />
        <StatCard label="Toplam ilan" value={`${listingCount}`} />
        <StatCard
          label="En düşük fiyatlı ürün"
          value={
            cheapestProduct
              ? `${cheapestProduct.productName} · ${formatPrice(cheapestProduct.lowestPrice)}`
              : "—"
          }
          accent
        />
        <StatCard
          label="Piyasa aralığı"
          value={
            marketRange
              ? `${formatPrice(marketRange.min)} - ${formatPrice(marketRange.max)}`
              : "—"
          }
        />
      </div>
    </div>
  );
}

function ProductComparisonSection({ products }: { products: ProductSummary[] }) {
  return (
    <section className="mb-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff6b00]">
            Ürünler
          </p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.03em] sm:text-2xl">
            Ürün karşılaştırması
          </h2>
        </div>
        <span className="text-sm font-semibold text-black/45">
          {products.length} ürün
        </span>
      </div>

      {products.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.productId}
              className="min-w-0 rounded-2xl border border-black/9 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 break-words text-lg font-black leading-6">
                  {product.productName}
                </h3>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black ${getConfidenceClassName(product.confidenceLabel)}`}
                >
                  {product.confidenceLabel}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MiniMetric label="İlan" value={`${product.listingCount}`} />
                <MiniMetric label="Güven" value={product.confidenceScore === null ? "—" : `${product.confidenceScore}/100`} />
                <MiniMetric label="Ortalama" value={formatPrice(product.averagePrice)} />
                <MiniMetric label="En düşük" value={formatPrice(product.lowestPrice)} accent />
                <MiniMetric label="En yüksek" value={formatPrice(product.highestPrice)} />
                <MiniMetric label="Son ilan" value={formatDate(product.newestAt)} />
              </div>
              <Link
                href={`/product/${product.slug}`}
                className="orange-button mt-5 w-full justify-center py-3"
              >
                Detaya git
                <ArrowUpRight size={17} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-10 text-center text-sm font-semibold text-black/45">
          Karşılaştırılabilir ürün bulunamadı.
        </div>
      )}
    </section>
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
    <div className={`min-w-0 rounded-xl border p-3 ${accent ? "border-[#ff6b00]/20 bg-[#fff7f1]" : "border-black/8 bg-[#fafaf8]"}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.06em] text-black/35">
        {label}
      </p>
      <p className={`mt-1 truncate text-sm font-black ${accent ? "text-[#ff6b00]" : ""}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function SmartPriceRatingBadge({
  price,
  stats,
}: {
  price: number;
  stats: ProductPriceStats | undefined;
}) {
  const analysis = analyzeListingPrice(price, stats);

  return (
    <div className="mt-3">
      <span
        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${analysis.className}`}
        title={
          analysis.average
            ? `Ortalama fiyat: ${formatPrice(analysis.average)}`
            : "Karşılaştırma için en az 3 aktif ilan gerekli"
        }
      >
        {analysis.label}
        {analysis.differencePercent !== null
          ? ` · %${Math.abs(analysis.differencePercent)} ${
              analysis.differencePercent < 0 ? "ucuz" : "pahalı"
            }`
          : ""}
      </span>
    </div>
  );
}

function PriceRatingBadge({
  price,
  averagePrice,
  listingCount,
}: {
  price: number;
  averagePrice: number;
  listingCount: number;
}) {
  const rating = calculateOpportunityRating(price, averagePrice, listingCount);
  const stars = "★★★★★".slice(0, rating.stars);

  return (
    <div className="mt-3">
      <span
        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${rating.className}`}
        title={
          listingCount > 1
            ? `Piyasa değeri: ${formatPrice(Math.round(averagePrice))}`
            : "Karşılaştırılabilir tek ilan var"
        }
      >
        {stars} {rating.label}
        {listingCount > 1 && rating.percent !== 0
          ? ` · %${Math.abs(rating.percent)} ${
              rating.percent > 0 ? "ucuz" : "pahalı"
            }`
          : ""}
      </span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2 lg:col-span-1" : ""}>
      <span className="mb-1.5 block text-xs font-bold text-black/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field h-12 px-3 text-sm font-semibold"
      >
        {children}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold text-black/50">{label}</span>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field h-12 px-3 text-sm font-semibold"
      />
    </label>
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
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        accent
          ? "border-[#ff6b00]/20 bg-[#fff7f1]"
          : "border-black/8 bg-white"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-black/40">
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-black tracking-[-0.035em] sm:text-2xl ${
          accent ? "text-[#ff6b00]" : "text-black"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function buildProductSummaries(
  listings: Listing[],
  sort: SortOption,
): ProductSummary[] {
  const groups = new Map<string, Listing[]>();

  for (const listing of listings) {
    const key = listing.productId || createProductSlug(listing.productName);
    groups.set(key, [...(groups.get(key) ?? []), listing]);
  }

  const summaries = [...groups.entries()].map(([productId, productListings]) => {
    const prices = productListings
      .map((listing) => listing.price)
      .filter((price) => Number.isFinite(price) && price > 0);
    const total = prices.reduce((sum, price) => sum + price, 0);
    const averagePrice = prices.length ? Math.round(total / prices.length) : 0;
    const confidence = calculateProductConfidence(productListings, averagePrice);
    const newestAt = productListings
      .map((listing) => listing.createdAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    return {
      productId,
      productName: productListings[0]?.productName ?? "Ürün",
      slug: createProductSlug(productListings[0]?.productName ?? productId),
      listingCount: productListings.length,
      averagePrice,
      lowestPrice: prices.length ? Math.min(...prices) : 0,
      highestPrice: prices.length ? Math.max(...prices) : 0,
      newestAt,
      confidenceScore: confidence.score,
      confidenceLabel: confidence.label,
    };
  });

  return summaries.sort((a, b) => {
    if (sort === "most-listings") return b.listingCount - a.listingCount;
    if (sort === "confidence") {
      return (b.confidenceScore ?? -1) - (a.confidenceScore ?? -1);
    }
    if (sort === "newest") {
      return new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime();
    }
    return a.lowestPrice - b.lowestPrice;
  });
}

function calculateProductConfidence(
  listings: Listing[],
  averagePrice: number,
): { score: number | null; label: ProductSummary["confidenceLabel"] } {
  if (listings.length < 3 || !averagePrice) {
    return { score: null, label: "Veri yetersiz" };
  }

  const prices = listings.map((listing) => listing.price);
  const spread = Math.max(...prices) - Math.min(...prices);
  const spreadRatio = spread / averagePrice;
  const uniqueDays = new Set(listings.map((listing) => listing.createdAt.slice(0, 10))).size;
  let score = 48;

  score += Math.min(25, listings.length * 3);
  score += spreadRatio <= 0.15 ? 22 : spreadRatio <= 0.3 ? 12 : -10;
  score += uniqueDays >= 2 ? 8 : 0;

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: finalScore,
    label:
      finalScore >= 80
        ? "Yüksek güven"
        : finalScore >= 60
          ? "Orta güven"
          : "Düşük güven",
  };
}

function getConfidenceClassName(label: ProductSummary["confidenceLabel"]) {
  if (label === "Yüksek güven") return "border-green-200 bg-green-50 text-green-700";
  if (label === "Orta güven") return "border-amber-200 bg-amber-50 text-amber-700";
  if (label === "Düşük güven") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function parseSortOption(value: string | null): SortOption {
  return value === "most-listings" || value === "confidence" || value === "newest"
    ? value
    : "price-asc";
}

function parseViewOption(value: string | null): ViewOption {
  return value === "products" || value === "listings" ? value : "both";
}

function normalizeFilterValue(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getSourceLabel(source: string, sources: string[]) {
  return sources.find((item) => normalizeFilterValue(item) === source) ?? source;
}

function getViewLabel(view: ViewOption) {
  if (view === "products") return "Ürün karşılaştırması";
  if (view === "listings") return "İlan listesi";
  return "İkisi birlikte";
}
