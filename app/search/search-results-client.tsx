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
import {
  calculateProductIntelligence,
  type ProductIntelligence,
} from "@/lib/intelligence-engine";
import {
  buildMarketIntelligence,
  type MarketIntelligenceDecisionInsight,
  type MarketIntelligence,
  type MarketIntelligenceListing,
} from "@/lib/market-intelligence";
import {
  buildOpportunityAnalysis,
  type OpportunityAnalysis,
} from "@/lib/opportunity-engine";
import {
  calculatePriceAdvantagePercent,
  formatOpportunityLevel,
} from "@/lib/opportunity-engine/helpers";
import { LISTING_CONDITIONS, type Listing } from "@/lib/listings";
import {
  analyzeListingPrice,
  type ProductPriceStats,
} from "@/lib/price-analysis";
import { calculateOpportunityRating } from "@/lib/price-insights";
import { createProductSlug } from "@/lib/product-slug";
import { groupListingDuplicates, summarizeDuplicateGroups } from "@/lib/product-matcher";
import { formatCurrencyTRY, formatDateTR, formatNumberTR } from "@/lib/formatters";
import { getAbsoluteUrl } from "@/lib/site-url";
import { toConfidenceResult } from "@/lib/market-intelligence/helpers";
import { recordSearch } from "./actions";

type SortOption = "ai-recommended" | "best-opportunity" | "most-reliable" | "lowest-risk" | "newest" | "price-asc" | "most-listings" | "confidence";
type ViewOption = "products" | "listings" | "both";
type QuickFilterOption =
  | "all"
  | "strong-opportunities"
  | "low-risk"
  | "high-confidence"
  | "newly-added"
  | "falling-price"
  | "refurbished";

type ProductSummary = {
  productId: string;
  productName: string;
  slug: string;
  listingCount: number;
  newestAt: string;
  sourceCount: number;
  refurbishedListingCount: number;
  intelligence: ProductIntelligence;
  marketIntelligence: MarketIntelligence;
  opportunityAnalysis: OpportunityAnalysis;
  priceAdvantagePercent: number | null;
};

type SearchSuggestion = {
  id: string;
  name: string;
  listingCount: number;
  href: string;
};

type SearchResultsClientProps = {
  query: string;
  initialListings: Listing[];
  productPriceStats: Record<string, ProductPriceStats>;
  loadError?: string;
  favoriteListingIds: string[];
  isAuthenticated: boolean;
  shouldQueueSearchDemand: boolean;
  searchIntentLabel?: string | null;
};

const searchDemandMessage =
  "Bu ürün için piyasayı tarıyoruz. Yeni ilanlar geldikçe sonuçlar güncellenecek.";

const formatPrice = (price: number) => formatCurrencyTRY(price);

const formatFilterPrice = (price: number) =>
  `${formatNumberTR(price)} TL`;

const formatDate = (date: string) =>
  formatDateTR(date, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function SearchResultsClient({
  query,
  initialListings,
  productPriceStats,
  loadError = "",
  favoriteListingIds,
  isAuthenticated,
  shouldQueueSearchDemand,
  searchIntentLabel = null,
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
  const [signal, setSignal] = useState<QuickFilterOption>(() =>
    parseQuickFilterOption(searchParams.get("signal")),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [demandMessage, setDemandMessage] = useState(
    shouldQueueSearchDemand ? searchDemandMessage : "",
  );
  const [suggestedSearches, setSuggestedSearches] = useState<SearchSuggestion[]>([]);

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
    if (sort !== "ai-recommended") params.set("sort", sort);
    if (view !== "products") params.set("view", view);
    if (signal !== "all") params.set("signal", signal);

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
    signal,
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

  useEffect(() => {
    const shouldLoadSuggestions = !query || initialListings.length < 3;
    if (!shouldLoadSuggestions) {
      setSuggestedSearches([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setSuggestedSearches([]);
          return;
        }

        const data = (await response.json()) as {
          suggestions?: SearchSuggestion[];
        };
        setSuggestedSearches((data.suggestions ?? []).slice(0, 8));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Search recommendation request failed:", error);
        }
        setSuggestedSearches([]);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [initialListings.length, query]);

  const cities = useMemo(
    () => [...new Set(initialListings.map((listing) => listing.city))].sort(),
    [initialListings],
  );
  const sources = useMemo(
    () => [...new Set(initialListings.map((listing) => listing.source))].sort(),
    [initialListings],
  );

  const filteredListings = useMemo(() => {
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
      .slice();
  }, [
    city,
    condition,
    initialListings,
    maximumPrice,
    minimumPrice,
    source,
  ]);

  const productSummaries = useMemo(
    () => buildProductSummaries(filteredListings),
    [filteredListings],
  );
  const filteredProductSummaries = useMemo(
    () => filterProductSummariesBySignal(productSummaries, signal),
    [productSummaries, signal],
  );
  const sortedProductSummaries = useMemo(
    () => sortProductSummaries(filteredProductSummaries, sort),
    [filteredProductSummaries, sort],
  );
  const visibleProductIds = useMemo(
    () => new Set(sortedProductSummaries.map((product) => product.productId)),
    [sortedProductSummaries],
  );
  const productRankById = useMemo(
    () =>
      new Map(
        sortedProductSummaries.map((product, index) => [product.productId, index]),
      ),
    [sortedProductSummaries],
  );
  const visibleListings = useMemo(
    () =>
      sortListingsByDecision(
        filteredListings.filter((listing) =>
          visibleProductIds.has(getListingSummaryKey(listing)),
        ),
        sort,
        productRankById,
      ),
    [filteredListings, productRankById, sort, visibleProductIds],
  );
  const prices = visibleListings.map((listing) => listing.price);
  const featuredProduct =
    sortedProductSummaries.find(
      (product) => product.marketIntelligence.sampleSize >= 3,
    ) ?? sortedProductSummaries[0] ?? null;
  const cheapestProduct = [...sortedProductSummaries].sort(
    (a, b) =>
      (a.marketIntelligence.priceAnalysis.minPrice ?? Number.MAX_SAFE_INTEGER) -
      (b.marketIntelligence.priceAnalysis.minPrice ?? Number.MAX_SAFE_INTEGER),
  )[0] ?? null;
  const marketAveragePrices = sortedProductSummaries
    .map((product) => product.marketIntelligence.priceAnalysis.averagePrice)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const marketRange = marketAveragePrices.length
    ? {
        min: Math.min(...marketAveragePrices),
        max: Math.max(...marketAveragePrices),
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
    signal !== "all" ? signal : "",
    sort !== "ai-recommended" ? sort : "",
    view !== "products" ? view : "",
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
    setSignal("all");
    setSort("ai-recommended");
    setView("products");
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
            ? `${visibleListings.length} ilan bulundu`
            : "Fiyatları karşılaştırmak için yukarıdaki kutudan arama yap."}
        </p>
        {searchIntentLabel ? (
          <p className="mt-3 inline-flex rounded-full border border-[#ff6b00]/20 bg-[#fff7f1] px-4 py-2 text-sm font-black text-[#d95700]">
            {searchIntentLabel}
          </p>
        ) : null}
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

          {initialListings.length < 3 && suggestedSearches.length > 0 ? (
            <SuggestedSearchesSection
              title="Bunları deneyebilirsin"
              description="Benzer ve popüler ürün aramalarını hızlıca aç."
              suggestions={suggestedSearches}
            />
          ) : null}

          <SearchSummary
            query={query}
            productCount={sortedProductSummaries.length}
            listingCount={visibleListings.length}
            featuredProduct={featuredProduct}
            cheapestProduct={cheapestProduct}
            marketRange={marketRange}
            searchIntentLabel={searchIntentLabel}
          />

          <QuickFilterBar signal={signal} onChange={setSignal} />

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
                <option value="ai-recommended">AI önerilen</option>
                <option value="best-opportunity">En iyi fırsat</option>
                <option value="most-reliable">En güvenilir</option>
                <option value="lowest-risk">En düşük risk</option>
                <option value="newest">En güncel</option>
                <option value="price-asc">En ucuz</option>
                <option value="most-listings">En çok ilan</option>
                <option value="confidence">En yüksek güven</option>
              </FilterSelect>

              <FilterSelect
                label="Görünüm"
                value={view}
                onChange={(value) => setView(value as ViewOption)}
                wide
              >
                <option value="products">Karar kartları</option>
                <option value="listings">İlan listesi</option>
                <option value="both">İkisi birlikte</option>
              </FilterSelect>
            </div>

            <FilterSummary
              minimumPrice={minimumPrice}
              maximumPrice={maximumPrice}
              source={source}
              sources={sources}
              signal={signal}
              sort={sort}
              view={view}
            />
          </div>

          {view !== "listings" ? (
            <ProductComparisonSection products={sortedProductSummaries} />
          ) : null}

          {view !== "products" ? (
            <>
          <div className="mb-10 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Bulunan ilan" value={`${visibleListings.length}`} />
            <StatCard
              label="En düşük fiyat"
              value={visibleListings.length ? formatPrice(lowestPrice) : "—"}
              accent
            />
            <StatCard
              label="Ortalama fiyat"
              value={visibleListings.length ? formatPrice(averagePrice) : "—"}
            />
            <StatCard
              label="En yüksek fiyat"
              value={visibleListings.length ? formatPrice(highestPrice) : "—"}
            />
          </div>

          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-black tracking-[-0.03em] sm:text-2xl">
              İlanlar
            </h2>
            <span className="text-sm font-semibold text-black/45">
              {getSortLabel(sort)}
            </span>
          </div>

          {visibleListings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleListings.map((listing) => (
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
              {suggestedSearches.length > 0 ? (
                <div className="mx-auto mt-6 max-w-3xl text-left">
                  <SuggestedSearchesSection
                    title="Bunları deneyebilirsin"
                    description="Filtreleri genişletmeden önce yakın ürünleri de kontrol edebilirsin."
                    suggestions={suggestedSearches}
                    compact
                  />
                </div>
              ) : null}
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
          {suggestedSearches.length > 0 ? (
            <div className="mx-auto mt-8 max-w-4xl text-left">
              <SuggestedSearchesSection
                title="Bunları deneyebilirsin"
                description="Popüler ürünlerden biriyle aramaya devam edebilirsin."
                suggestions={suggestedSearches}
                compact
              />
            </div>
          ) : null}
        </div>
      ) : suggestedSearches.length > 0 ? (
        <SuggestedSearchesSection
          title="Popüler aramalar"
          description="En çok ilana sahip ürünlerden başlayabilirsin."
          suggestions={suggestedSearches}
        />
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

function SuggestedSearchesSection({
  title,
  description,
  suggestions,
  compact = false,
}: {
  title: string;
  description: string;
  suggestions: SearchSuggestion[];
  compact?: boolean;
}) {
  if (!suggestions.length) return null;

  return (
    <section
      className={`rounded-2xl border border-black/8 bg-white ${
        compact ? "p-4" : "mb-8 p-5 sm:p-6"
      }`}
    >
      <div className="mb-4">
        <h2 className="text-lg font-black tracking-[-0.03em]">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-black/45">{description}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {suggestions.map((suggestion) => (
          <Link
            key={suggestion.id}
            href={suggestion.href}
            className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-black/8 bg-[#fafaf8] px-4 py-3 transition hover:border-[#ff6b00]/35 hover:bg-[#fff4eb]"
          >
            <span className="min-w-0 truncate text-sm font-black">
              {suggestion.name}
            </span>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black text-black/45 group-hover:text-[#d95700]">
              {suggestion.listingCount} ilan
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FilterSummary({
  minimumPrice,
  maximumPrice,
  source,
  sources,
  signal,
  sort,
  view,
}: {
  minimumPrice: string;
  maximumPrice: string;
  source: string;
  sources: string[];
  signal: QuickFilterOption;
  sort: SortOption;
  view: ViewOption;
}) {
  const visibleChips = [
    minimumPrice || maximumPrice
      ? `${minimumPrice ? formatFilterPrice(Number(minimumPrice)) : "0 TL"} - ${
          maximumPrice ? formatFilterPrice(Number(maximumPrice)) : "üst sınır yok"
        } arası`
      : "",
    source ? `Kaynak: ${getSourceLabel(source, sources)}` : "",
    signal !== "all" ? `Odak: ${getSignalLabel(signal)}` : "",
    `Sıralama: ${getSortLabel(sort)}`,
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
  featuredProduct,
  cheapestProduct,
  marketRange,
  searchIntentLabel,
}: {
  query: string;
  productCount: number;
  listingCount: number;
  featuredProduct: ProductSummary | null;
  cheapestProduct: ProductSummary | null;
  marketRange: { min: number; max: number } | null;
  searchIntentLabel?: string | null;
}) {
  const hasDecisionData =
    Boolean(featuredProduct) && (featuredProduct?.marketIntelligence.sampleSize ?? 0) >= 3;
  const summaryText = buildSearchDecisionSummary(featuredProduct);
  const decisionTarget = featuredProduct ?? cheapestProduct;

  return (
    <div className="mb-8 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff6b00]">
            Karar ekranı
          </p>
          <h2 className="mt-2 break-words text-2xl font-black tracking-[-0.04em] sm:text-3xl">
            “{query}” için satın alma sinyalleri
          </h2>
          <p className="mt-2 text-sm font-semibold text-black/45">
            Ürünleri fırsat, risk, güven ve fiyat avantajına göre hızlıca kıyasla.
          </p>
          {searchIntentLabel ? (
            <p className="mt-3 inline-flex rounded-full border border-[#ff6b00]/20 bg-[#fff7f1] px-4 py-2 text-sm font-black text-[#d95700]">
              {searchIntentLabel}
            </p>
          ) : null}
        </div>
        {decisionTarget ? (
          <Link
            href={`/product/${decisionTarget.slug}`}
            className="orange-button w-full justify-center py-3 lg:w-auto"
          >
            {hasDecisionData ? "Karar kartına git" : "İlk sonuca git"}
            <ArrowUpRight size={17} />
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-2xl border border-[#ff6b00]/12 bg-[#fff7f1] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#d95700]">
            AI karar özeti
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-black/60">
            {summaryText}
          </p>

          {featuredProduct ? (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <DecisionPill
                  label={featuredProduct.marketIntelligence.opportunity.label}
                  tone="success"
                />
                <DecisionPill
                  label={formatOpportunityLevel(
                    featuredProduct.opportunityAnalysis.opportunityLevel,
                  )}
                  tone="accent"
                />
                <DecisionPill
                  label={featuredProduct.opportunityAnalysis.recommendation.label}
                  tone={getRecommendationTone(
                    featuredProduct.opportunityAnalysis.recommendation.action,
                  )}
                />
                <DecisionPill
                  label={`Confidence ${formatConfidenceLevelLabel(
                    featuredProduct.marketIntelligence.confidenceLevel,
                  )}`}
                  tone="info"
                />
                <DecisionPill
                  label={`Risk ${formatOpportunityLevel(
                    featuredProduct.opportunityAnalysis.riskLevel,
                  )}`}
                  tone="warning"
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 xl:grid-cols-4">
                <MiniMetric
                  label="Fırsat skoru"
                  value={`${featuredProduct.opportunityAnalysis.opportunityScore}/100`}
                />
                <MiniMetric
                  label="Güven skoru"
                  value={`${featuredProduct.marketIntelligence.confidenceScore}/100`}
                />
                <MiniMetric
                  label="Ortalama"
                  value={formatOptionalPrice(
                    featuredProduct.marketIntelligence.priceAnalysis.averagePrice,
                  )}
                />
                <MiniMetric
                  label="En düşük"
                  value={formatOptionalPrice(
                    featuredProduct.marketIntelligence.priceAnalysis.minPrice,
                  )}
                  accent
                />
                <MiniMetric
                  label="Analiz edilen ilan"
                  value={`${featuredProduct.marketIntelligence.sampleSize}`}
                />
                <MiniMetric
                  label="Kaynak sayısı"
                  value={`${featuredProduct.marketIntelligence.marketSummary.sourceCount}`}
                />
                <MiniMetric
                  label="Risk seviyesi"
                  value={formatOpportunityLevel(
                    featuredProduct.opportunityAnalysis.riskLevel,
                  )}
                />
                <MiniMetric
                  label="Son güncelleme"
                  value={formatDate(featuredProduct.marketIntelligence.analysisGeneratedAt)}
                />
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[#ff6b00]/20 bg-white px-4 py-5 text-sm font-semibold leading-6 text-black/50">
              Bu ürün için henüz yeterli piyasa verisi oluşmadı.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <StatCard label="Bulunan ürün" value={`${productCount}`} />
            <StatCard label="Toplam ilan" value={`${listingCount}`} />
            <StatCard
              label="En düşük fiyatlı ürün"
              value={
                cheapestProduct
                  ? `${cheapestProduct.productName} · ${formatOptionalPrice(
                      cheapestProduct.marketIntelligence.priceAnalysis.minPrice,
                    )}`
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
            AI önerileri
          </p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.03em] sm:text-2xl">
            Karar kartları
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-black/45">
            Ürünleri fırsat, güven, risk ve fiyat avantajına göre sırala.
          </p>
        </div>
        <span className="text-sm font-semibold text-black/45">
          {products.length} ürün
        </span>
      </div>

      {products.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const hasDecisionData = product.marketIntelligence.sampleSize >= 3;
            return (
              <article
                key={product.productId}
                className="min-w-0 rounded-2xl border border-black/9 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-black leading-6">
                      {product.productName}
                    </h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-black/45">
                      {buildSearchDecisionSummary(product)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${getOpportunityBadgeClassName(
                        product.marketIntelligence.opportunity.label,
                      )}`}
                    >
                      {product.marketIntelligence.opportunity.label}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${getRecommendationBadgeClassName(
                        product.opportunityAnalysis.recommendation.action,
                      )}`}
                    >
                      {product.opportunityAnalysis.recommendation.label}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${getConfidenceBadgeClassName(
                        product.marketIntelligence.confidenceLevel,
                      )}`}
                    >
                      Confidence {formatConfidenceLevelLabel(
                        product.marketIntelligence.confidenceLevel,
                      )}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${getRiskBadgeClassName(
                        product.opportunityAnalysis.riskLevel,
                      )}`}
                    >
                      Risk {formatOpportunityLevel(product.opportunityAnalysis.riskLevel)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 min-[420px]:grid-cols-3">
                  <MiniMetric
                    label="Fırsat skoru"
                    value={`${product.opportunityAnalysis.opportunityScore}/100`}
                  />
                  <MiniMetric
                    label="Güven skoru"
                    value={`${product.marketIntelligence.confidenceScore}/100`}
                  />
                  <MiniMetric
                    label="Ortalama"
                    value={formatOptionalPrice(
                      product.marketIntelligence.priceAnalysis.averagePrice,
                    )}
                  />
                  <MiniMetric
                    label="En düşük"
                    value={formatOptionalPrice(
                      product.marketIntelligence.priceAnalysis.minPrice,
                    )}
                    accent
                  />
                  <MiniMetric
                    label="Aktif ilan"
                    value={`${product.marketIntelligence.marketSummary.activeListingCount}`}
                  />
                  <MiniMetric
                    label="Kaynak"
                    value={`${product.marketIntelligence.marketSummary.sourceCount}`}
                  />
                  <MiniMetric
                    label="Analiz edilen ilan"
                    value={`${product.marketIntelligence.sampleSize}`}
                  />
                  <MiniMetric
                    label="Price advantage"
                    value={formatPriceAdvantage(product.priceAdvantagePercent)}
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-[#ff6b00]/12 bg-[#fff7f1] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#d95700]">
                    AI karar kutusu
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-black/60">
                    {hasDecisionData
                      ? product.opportunityAnalysis.recommendation.description
                      : "Yeterli veri oluştuğunda AI değerlendirmesi burada gösterilecek."}
                  </p>
                  {hasDecisionData ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.opportunityAnalysis.positiveSignals.slice(0, 3).map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-[11px] font-black text-black/60"
                        >
                          {signal}
                        </span>
                      ))}
                      {product.opportunityAnalysis.warningSignals.slice(0, 2).map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-800"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <Link
                  href={`/product/${product.slug}`}
                  className="orange-button mt-5 w-full justify-center py-3"
                >
                  Detaya git
                  <ArrowUpRight size={17} />
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-10 text-center text-sm font-semibold text-black/45">
          Karşılaştırılabilir ürün bulunamadı.
        </div>
      )}
    </section>
  );
}

function DecisionPill({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "accent" | "warning" | "info" | "danger";
}) {
  const toneClassName =
    tone === "success"
      ? "border-green-200 bg-green-50 text-green-800"
      : tone === "accent"
        ? "border-[#ff6b00]/20 bg-[#fff7f1] text-[#d95700]"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : tone === "danger"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-sky-200 bg-sky-50 text-sky-800";

  return (
    <span className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${toneClassName}`}>
      {label}
    </span>
  );
}

function formatConfidenceLevelLabel(level: MarketIntelligence["confidenceLevel"]) {
  if (level === "very-high") return "Çok yüksek";
  if (level === "high") return "Yüksek";
  if (level === "medium") return "Orta";
  if (level === "low") return "Düşük";
  return "Çok düşük";
}

function formatOptionalPrice(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? formatPrice(value)
    : "—";
}

function formatPriceAdvantage(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value > 0) return `Piyasanın %${Math.abs(Math.round(value))} altında`;
  if (value < 0) return `Piyasanın %${Math.abs(Math.round(value))} üstünde`;
  return "Piyasa ortalamasına yakın";
}

export function buildSearchDecisionSummary(product: ProductSummary | null) {
  if (!product || product.marketIntelligence.sampleSize < 3) {
    return "Bu ürün için henüz yeterli piyasa verisi oluşmadı.";
  }

  const pricePhrase = formatPriceAdvantage(product.priceAdvantagePercent);
  const confidencePhrase = formatConfidenceLevelLabel(
    product.marketIntelligence.confidenceLevel,
  ).toLowerCase();
  const riskPhrase = formatOpportunityLevel(product.opportunityAnalysis.riskLevel).toLowerCase();

  return `${pricePhrase}. Confidence ${confidencePhrase}. Risk ${riskPhrase}.`;
}

function getRecommendationTone(
  action: OpportunityAnalysis["recommendation"]["action"],
) {
  if (action === "buy_now") return "success";
  if (action === "watch") return "info";
  if (action === "wait") return "warning";
  if (action === "avoid") return "danger";
  return "accent";
}

function getOpportunityBadgeClassName(label: string) {
  if (label === "Güçlü fırsat") return "border-green-200 bg-green-50 text-green-800";
  if (label === "Takip etmeye değer") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (label === "Dikkatli incele") return "border-amber-200 bg-amber-50 text-amber-800";
  if (label === "Normal piyasa") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getRecommendationBadgeClassName(
  action: OpportunityAnalysis["recommendation"]["action"],
) {
  if (action === "buy_now") return "border-green-200 bg-green-50 text-green-800";
  if (action === "watch") return "border-sky-200 bg-sky-50 text-sky-800";
  if (action === "wait") return "border-amber-200 bg-amber-50 text-amber-800";
  if (action === "avoid") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getConfidenceBadgeClassName(
  level: MarketIntelligence["confidenceLevel"],
) {
  if (level === "very-high") return "border-green-200 bg-green-50 text-green-800";
  if (level === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (level === "medium") return "border-sky-200 bg-sky-50 text-sky-800";
  if (level === "low") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function getRiskBadgeClassName(level: OpportunityAnalysis["riskLevel"]) {
  if (level === "very-low") return "border-green-200 bg-green-50 text-green-800";
  if (level === "low") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  if (level === "high") return "border-orange-200 bg-orange-50 text-orange-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function getListingSummaryKey(listing: Listing) {
  return listing.productId || createProductSlug(listing.productName);
}

export function parseQuickFilterOption(value: string | null): QuickFilterOption {
  return value === "strong-opportunities" ||
    value === "low-risk" ||
    value === "high-confidence" ||
    value === "newly-added" ||
    value === "falling-price" ||
    value === "refurbished"
    ? value
    : "all";
}

function getSortLabel(sort: SortOption) {
  if (sort === "ai-recommended") return "AI önerilen";
  if (sort === "best-opportunity") return "En iyi fırsat";
  if (sort === "most-reliable") return "En güvenilir";
  if (sort === "lowest-risk") return "En düşük risk";
  if (sort === "newest") return "En güncel";
  if (sort === "most-listings") return "En çok ilana göre";
  if (sort === "confidence") return "En yüksek güvene göre";
  return "En ucuz";
}

export function getSignalLabel(signal: QuickFilterOption) {
  if (signal === "strong-opportunities") return "Güçlü Fırsatlar";
  if (signal === "low-risk") return "Risk Düşük";
  if (signal === "high-confidence") return "Confidence Yüksek";
  if (signal === "newly-added") return "Yeni Eklenenler";
  if (signal === "falling-price") return "Fiyatı Düşenler";
  if (signal === "refurbished") return "Yenilenmiş";
  return "Tümü";
}

export function filterProductSummariesBySignal(
  products: ProductSummary[],
  signal: QuickFilterOption,
) {
  if (signal === "all") return products;

  const now = Date.now();
  return products.filter((product) => {
    if (signal === "strong-opportunities") {
      return (
        product.opportunityAnalysis.opportunityLevel === "very-high" ||
        product.opportunityAnalysis.opportunityLevel === "high"
      );
    }

    if (signal === "low-risk") {
      return (
        product.opportunityAnalysis.riskLevel === "very-low" ||
        product.opportunityAnalysis.riskLevel === "low"
      );
    }

    if (signal === "high-confidence") {
      return (
        product.marketIntelligence.confidenceLevel === "very-high" ||
        product.marketIntelligence.confidenceLevel === "high"
      );
    }

    if (signal === "newly-added") {
      const newestTime = new Date(product.newestAt).getTime();
      return Number.isFinite(newestTime) && now - newestTime <= 7 * 86_400_000;
    }

    if (signal === "falling-price") {
      return product.intelligence.trend.direction === "falling";
    }

    if (signal === "refurbished") {
      return product.refurbishedListingCount > 0;
    }

    return true;
  });
}

export function sortProductSummaries(products: ProductSummary[], sort: SortOption) {
  return [...products].sort((a, b) => {
    if (sort === "newest") {
      return new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime();
    }

    if (sort === "price-asc") {
      return (
        (a.marketIntelligence.priceAnalysis.minPrice ?? Number.MAX_SAFE_INTEGER) -
          (b.marketIntelligence.priceAnalysis.minPrice ?? Number.MAX_SAFE_INTEGER) ||
        b.opportunityAnalysis.opportunityScore - a.opportunityAnalysis.opportunityScore ||
        b.marketIntelligence.confidenceScore - a.marketIntelligence.confidenceScore
      );
    }

    if (sort === "most-listings") {
      return (
        b.listingCount - a.listingCount ||
        b.sourceCount - a.sourceCount ||
        (a.marketIntelligence.priceAnalysis.minPrice ?? Number.MAX_SAFE_INTEGER) -
          (b.marketIntelligence.priceAnalysis.minPrice ?? Number.MAX_SAFE_INTEGER)
      );
    }

    if (sort === "confidence") {
      return (
        b.marketIntelligence.confidenceScore - a.marketIntelligence.confidenceScore ||
        b.sourceCount - a.sourceCount ||
        b.opportunityAnalysis.opportunityScore - a.opportunityAnalysis.opportunityScore
      );
    }

    if (sort === "best-opportunity") {
      return (
        b.opportunityAnalysis.opportunityScore - a.opportunityAnalysis.opportunityScore ||
        compareRiskLevels(a.opportunityAnalysis.riskLevel, b.opportunityAnalysis.riskLevel) ||
        (b.priceAdvantagePercent ?? Number.NEGATIVE_INFINITY) -
          (a.priceAdvantagePercent ?? Number.NEGATIVE_INFINITY)
      );
    }

    if (sort === "most-reliable") {
      return (
        b.marketIntelligence.confidenceScore - a.marketIntelligence.confidenceScore ||
        b.marketIntelligence.marketSummary.sourceCount - a.marketIntelligence.marketSummary.sourceCount ||
        b.marketIntelligence.sampleSize - a.marketIntelligence.sampleSize
      );
    }

    if (sort === "lowest-risk") {
      return (
        compareRiskLevels(a.opportunityAnalysis.riskLevel, b.opportunityAnalysis.riskLevel) ||
        b.marketIntelligence.confidenceScore - a.marketIntelligence.confidenceScore ||
        b.opportunityAnalysis.opportunityScore - a.opportunityAnalysis.opportunityScore
      );
    }

    return (
      b.opportunityAnalysis.opportunityScore - a.opportunityAnalysis.opportunityScore ||
      b.marketIntelligence.confidenceScore - a.marketIntelligence.confidenceScore ||
      compareRiskLevels(a.opportunityAnalysis.riskLevel, b.opportunityAnalysis.riskLevel) ||
      b.marketIntelligence.sampleSize - a.marketIntelligence.sampleSize ||
      b.sourceCount - a.sourceCount
    );
  });
}

function sortListingsByDecision(
  listings: Listing[],
  sort: SortOption,
  productRankById: Map<string, number>,
) {
  return [...listings].sort((a, b) => {
    if (sort === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    if (sort === "price-asc") {
      return a.price - b.price || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    const rankA = productRankById.get(getListingSummaryKey(a)) ?? Number.MAX_SAFE_INTEGER;
    const rankB = productRankById.get(getListingSummaryKey(b)) ?? Number.MAX_SAFE_INTEGER;

    return (
      rankA - rankB ||
      a.price - b.price ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });
}

function compareRiskLevels(
  left: OpportunityAnalysis["riskLevel"],
  right: OpportunityAnalysis["riskLevel"],
) {
  return riskLevelRank(left) - riskLevelRank(right);
}

function riskLevelRank(level: OpportunityAnalysis["riskLevel"]) {
  if (level === "very-low") return 0;
  if (level === "low") return 1;
  if (level === "medium") return 2;
  if (level === "high") return 3;
  return 4;
}

function QuickFilterBar({
  signal,
  onChange,
}: {
  signal: QuickFilterOption;
  onChange: (value: QuickFilterOption) => void;
}) {
  const filters: Array<{
    value: QuickFilterOption;
    tone: "success" | "warning" | "info" | "accent" | "danger" | "neutral";
  }> = [
    { value: "all", tone: "neutral" },
    { value: "strong-opportunities", tone: "success" },
    { value: "low-risk", tone: "warning" },
    { value: "high-confidence", tone: "info" },
    { value: "newly-added", tone: "accent" },
    { value: "falling-price", tone: "danger" },
    { value: "refurbished", tone: "neutral" },
  ];

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
      {filters.map((filter) => (
        <button
          key={filter.value}
          type="button"
          aria-pressed={signal === filter.value}
          onClick={() => onChange(filter.value)}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition ${
            signal === filter.value
              ? "border-[#ff6b00] bg-[#ff6b00] text-white"
              : "border-black/10 bg-white text-black/60 hover:border-[#ff6b00]/35 hover:bg-[#fff7f1] hover:text-[#d95700]"
          }`}
        >
          {getSignalLabel(filter.value)}
        </button>
      ))}
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

export function buildProductSummaries(listings: Listing[]): ProductSummary[] {
  const analyzedAt = new Date();
  const groups = new Map<string, Listing[]>();

  for (const listing of listings) {
    const key = listing.productId || createProductSlug(listing.productName);
    groups.set(key, [...(groups.get(key) ?? []), listing]);
  }

  return [...groups.entries()].map(([productId, productListings]) => {
    const productName = productListings[0]?.productName ?? "Ürün";
    const slug = createProductSlug(productName || productId);
    const newestAt =
      [...productListings].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0]?.createdAt ?? analyzedAt.toISOString();
    const marketIntelligenceListings: MarketIntelligenceListing[] = productListings.map(
      (listing) => ({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        source: listing.source,
        city: listing.city,
        condition: listing.condition,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt ?? null,
        productId: listing.productId ?? productId,
        productName: listing.productName,
        status: "published",
      }),
    );
    const duplicateSummary = buildDuplicateSummary(productListings);
    const intelligence = calculateProductIntelligence({
      listings: productListings.map((listing) => ({
        price: listing.price,
        createdAt: listing.createdAt,
      })),
    });
    const decisionInsight = buildSearchDecisionInsight(intelligence);
    const marketIntelligence = buildMarketIntelligence({
      scope: {
        productId,
        productName,
        slug,
        url: getAbsoluteUrl(`/product/${slug}`),
        category: null,
      },
      listings: marketIntelligenceListings,
      intelligence,
      decisionInsight,
      duplicateSummary,
      analyzedAt,
    });
    const opportunityAnalysis = buildOpportunityAnalysis({
      marketIntelligence,
      intelligence,
      duplicateSummary,
      analyzedAt,
      latestListingAt: newestAt,
    });

    return {
      productId,
      productName,
      slug,
      listingCount: productListings.length,
      newestAt,
      sourceCount: marketIntelligence.marketSummary.sourceCount,
      refurbishedListingCount: productListings.filter(
        (listing) => listing.condition === "Yenilenmiş",
      ).length,
      intelligence,
      marketIntelligence,
      opportunityAnalysis,
      priceAdvantagePercent: calculatePriceAdvantagePercent(
        marketIntelligence.priceAnalysis.averagePrice,
        marketIntelligence.priceAnalysis.minPrice,
      ),
    };
  });
}

function buildDuplicateSummary(listings: Listing[]): {
  threshold: number;
  itemCount: number;
  groupCount: number;
  matchedGroupCount: number;
  duplicatePairCount: number;
  duplicateItemCount: number;
  maxGroupSize: number;
  topGroups: Array<{
    canonicalId: string | number;
    canonicalTitle: string;
    duplicateCount: number;
    maxScore: number;
    sampleTitles: string[];
  }>;
} {
  const duplicateGroups = groupListingDuplicates(
    listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      source: listing.source,
      condition: listing.condition,
    })),
    70,
  );

  return summarizeDuplicateGroups(duplicateGroups, listings.length, 70);
}

function buildSearchDecisionInsight(
  intelligence: ProductIntelligence,
): MarketIntelligenceDecisionInsight | null {
  if (intelligence.marketValue.listingCount < 3 || intelligence.decisionSupport.label === "Veri Az") {
    return null;
  }

  const confidenceScore = Math.round(
    20 +
      intelligence.decisionSupport.buyScore * 0.35 +
      intelligence.decisionSupport.liquidityScore * 0.35 +
      (100 - intelligence.decisionSupport.volatilityScore) * 0.2 +
      intelligence.opportunity.score * 0.1,
  );
  const reasons = [
    intelligence.marketValue.listingCount >= 8
      ? "İlan sayısı güçlü."
      : intelligence.marketValue.listingCount >= 3
        ? "İlan sayısı yeterli."
        : "İlan sayısı sınırlı.",
    intelligence.decisionSupport.liquidityLevel === "high"
      ? "Likidite yüksek."
      : intelligence.decisionSupport.liquidityLevel === "medium"
        ? "Likidite dengeli."
        : "Likidite sınırlı.",
    intelligence.decisionSupport.volatilityLevel === "high"
      ? "Volatilite yüksek."
      : intelligence.decisionSupport.volatilityLevel === "medium"
        ? "Volatilite orta."
        : "Volatilite kontrollü.",
    intelligence.opportunity.explanation,
  ];

  return {
    confidence: toConfidenceResult(confidenceScore, reasons),
    smartPrice: {
      summary: intelligence.recommendation.description,
      details: [
        intelligence.opportunity.explanation,
        intelligence.trend.explanation,
        intelligence.decisionSupport.explanation,
      ],
      warnings:
        intelligence.recommendation.action === "buy_now"
          ? []
          : [intelligence.recommendation.description],
    },
  };
}

export function parseSortOption(value: string | null): SortOption {
  return value === "ai-recommended" ||
    value === "best-opportunity" ||
    value === "most-reliable" ||
    value === "lowest-risk" ||
    value === "newest" ||
    value === "price-asc" ||
    value === "most-listings" ||
    value === "confidence"
    ? value
    : "ai-recommended";
}

export function parseViewOption(value: string | null): ViewOption {
  return value === "products" || value === "listings" || value === "both"
    ? value
    : "products";
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
