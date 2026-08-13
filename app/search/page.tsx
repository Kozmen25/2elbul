import { SearchBar } from "@/components/search-bar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import type {
  Listing,
  ListingCondition,
  ListingSource,
} from "@/lib/listings";
import { isMissingAttributesColumn, isMissingStatusColumn } from "@/lib/listing-status";
import { buildProductPriceStats } from "@/lib/price-analysis";
import { isPublicDemoListing, isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";
import { detectQueryIntent } from "@/lib/search/query-intent-detector";
import { rankListingsByPue } from "@/lib/search/pue-ranking";
import { getExpandedSearchTerms } from "@/lib/category-taxonomy";
import { createSupabaseClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMetadataBase, getAbsoluteUrl } from "@/lib/site-url";
import { SearchResultsClient } from "./search-results-client";
import type { Metadata } from "next";
import { cacheGet, cacheSet, cacheKeyFrom } from "@/lib/cache";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    page?: string;
  }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = (
    Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? ""
  ).trim();

  if (!query) {
    return {
      title: "İkinci el ilanlarında ara | 2ElBul",
      description: "Telefon, bilgisayar, konsol ve daha fazlası için ikinci el piyasasında arama yapın.",
      robots: { index: false, follow: true },
      metadataBase: getMetadataBase(),
    };
  }

  const searchTitle = `${query} fiyatları — ikinci el piyasası | 2ElBul`;
  return {
    title: searchTitle,
    description: `${query} için ikinci el piyasa fiyatlarını karşılaştırın, en ucuz ilanları bulun, ortalama fiyatı ve fiyat geçmişini görün.`,
    alternates: { canonical: getAbsoluteUrl(`/search?q=${encodeURIComponent(query)}`) },
    metadataBase: getMetadataBase(),
    openGraph: {
      title: searchTitle,
      description: `${query} ikinci el fiyatlarını tek yerde karşılaştırın.`,
      locale: "tr_TR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: searchTitle,
      description: `${query} ikinci el fiyatlarını tek yerde karşılaştırın.`,
    },
  };
}

const listingColumns =
  "id, product_id, title, price, city, source, url, condition, image_url, created_at";

type ListingRow = {
  id: string | number;
  product_id: string | number;
  title: string;
  price: string | number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
  image_url: string | null;
  created_at: string;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = (
    Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? ""
  ).trim();
  const supabase = createSupabaseClient();

  let listings: Listing[] = [];
  let loadError = "";
  let favoriteListingIds: string[] = [];
  let productCategory: Map<string, string | null> = new Map();
  let productAttributes = new Map<string, { attributes?: unknown }>();

  const serverSupabase = await createSupabaseServerClient();
  const { data: authData } = (await serverSupabase?.auth.getUser()) ?? {
    data: { user: null },
  };
  const isAuthenticated = Boolean(authData.user);

  if (!supabase) {
    loadError =
      "Supabase bağlantısı yapılandırılmamış. Ortam değişkenlerini kontrol edin.";
  } else if (query) {
    const expandedTerms = [...new Set(
      getExpandedSearchTerms(query)
        .map(t => t.toLowerCase().trim())
        .filter(Boolean)
    )];
    const searchTerms = expandedTerms.length > 0 ? expandedTerms : [query.toLowerCase().trim()];

    const productOrFilter = searchTerms.map(t => "name.ilike.%" + t + "%").join(",");
    const titleOrFilter = searchTerms.map(t => "title.ilike.%" + t + "%").join(",");

    const [matchingProductsResults, titleListingsResults] = await Promise.all([
      (async () => {
        const cacheKey = cacheKeyFrom({ type: "product-search", terms: searchTerms });
        const cached = cacheGet<{ id: string | number; name: string; category: string | null }[]>(cacheKey);
        if (cached) return [{ data: cached, error: null }];
        const result = await supabase
          .from("products")
          .select("id, name, category")
          .or(productOrFilter);
        if (!result.error) cacheSet(cacheKey, result.data ?? [], 30_000);
        return [result];
      })(),
      (async () => {
        const cacheKey = cacheKeyFrom({ type: "listing-title-search", terms: searchTerms });
        const cached = cacheGet<{ id: string | number; title: string; product_id: string | number; price: string | number; city: string; source: ListingSource; url: string; condition: ListingCondition; image_url: string | null; created_at: string }[]>(cacheKey);
        if (cached) return [{ data: cached, error: null }];
        const result = await searchPublishedListingsByTitle(supabase, titleOrFilter);
        if (!result.error) cacheSet(cacheKey, result.data ?? [], 15_000);
        return [result];
      })(),
    ]);
    const productSearchError = matchingProductsResults.find((result) => result.error)
      ?.error;
    const titleSearchError = titleListingsResults.find((result) => result.error)
      ?.error;

    if (productSearchError) {
      console.error(
        "Supabase product name search failed:",
        productSearchError,
      );
    }
    if (titleSearchError) {
      console.error(
        "Supabase listing title search failed:",
        titleSearchError,
      );
    }

    if (productSearchError || titleSearchError) {
      loadError = "İlanlar aranırken bir sorun oluştu. Lütfen tekrar deneyin.";
    } else {
      const matchingProductsById = new Map<string, { id: string | number; name: string; category: string | null }>();
      for (const result of matchingProductsResults) {
        for (const product of result.data ?? []) {
          matchingProductsById.set(String(product.id), {
            id: product.id,
            name: String(product.name),
            category: 'category' in product ? String(product.category) : null,
          });
        }
      }
      const matchingProductIds = [...matchingProductsById.values()]
        .filter((product) => !isPublicDemoProductName(String(product.name)))
        .map((product) => product.id);
      const productListingsResult = matchingProductIds.length
        ? await (async () => {
            const cacheKey = cacheKeyFrom({ type: "product-listings", ids: matchingProductIds.sort() });
            const cached = cacheGet<ListingRow[]>(cacheKey);
            if (cached) return { data: cached, error: null };
            const result = await searchPublishedListingsByProduct(supabase, matchingProductIds);
            if (!result.error) cacheSet(cacheKey, result.data ?? [], 30_000);
            return result;
          })()
        : { data: [], error: null };

      if (productListingsResult.error) {
        console.error(
          "Supabase product listings search failed:",
          productListingsResult.error,
        );
        loadError = "İlanlar aranırken bir sorun oluştu. Lütfen tekrar deneyin.";
      } else {
        const rowsById = new Map<string, ListingRow>();
        for (const row of [
          ...titleListingsResults.flatMap(
            (result) => (result.data ?? []) as ListingRow[],
          ),
          ...((productListingsResult.data ?? []) as ListingRow[]),
        ]) {
          rowsById.set(String(row.id), row);
        }

        const rows = [...rowsById.values()].filter(
          (row) => !isPublicDemoListing(row),
        );
        const productIds = [
          ...new Set(rows.map((row) => String(row.product_id))),
        ];
        const productsResult = productIds.length
          ? await (async () => {
              const cacheKey = cacheKeyFrom({ type: "product-names", ids: productIds });
              const cached = cacheGet<{ id: string | number; name: string; category: string | null; attributes?: unknown }[]>(cacheKey);
              if (cached) return { data: cached, error: null };
              const result = await supabase
                .from("products")
                .select("id, name, category, attributes")
                .in("id", productIds);
              if (!result.error || !isMissingAttributesColumn(result.error)) {
                if (!result.error) cacheSet(cacheKey, result.data ?? [], 60_000);
                return result;
              }
              const fallback = await supabase
                .from("products")
                .select("id, name, category")
                .in("id", productIds);
              if (!fallback.error) cacheSet(cacheKey, fallback.data ?? [], 60_000);
              return fallback;
            })()
          : { data: [], error: null };

        if (productsResult.error) {
          console.error(
            "Supabase search product details failed:",
            productsResult.error,
          );
          loadError =
            "İlanlar aranırken bir sorun oluştu. Lütfen tekrar deneyin.";
        } else {
          const productNames = new Map(
            (productsResult.data ?? [])
              .filter((product) => !isPublicDemoProductName(String(product.name)))
              .map((product) => [
                String(product.id),
                String(product.name),
              ]),
          );

          productCategory = new Map(
            (productsResult.data ?? [])
              .filter((product) => !isPublicDemoProductName(String(product.name)))
              .map((product) => [
                String(product.id),
                'category' in product ? String(product.category) : null,
              ]),
          );

          productAttributes = new Map<string, { attributes?: unknown }>(
            (productsResult.data ?? [])
              .filter((product) => !isPublicDemoProductName(String(product.name)))
              .filter((product) => (product as { attributes?: unknown }).attributes != null)
              .map((product) => [
                String(product.id),
                { attributes: (product as { attributes?: unknown }).attributes },
              ]),
          );

          const intent = detectQueryIntent(query);
          const pueListings = rows.map((row) => ({
            id: String(row.id),
            productId: String(row.product_id),
            title: String(row.title),
            productName:
              productNames.get(String(row.product_id)) ?? "Diğer",
            category:
              productCategory.get(String(row.product_id)) ?? null,
            price: Number(row.price),
            city: String(row.city),
            source: row.source,
            url: String(row.url),
            condition: row.condition,
            imageUrl: row.image_url ? String(row.image_url) : null,
            createdAt: String(row.created_at),
          }));
          const scored = rankListingsByPue(
            intent,
            pueListings.map((l) => ({ productId: l.productId, price: l.price, title: l.title })),
            productAttributes,
          );
          const scoredIndex = new Map(scored.map((s, i) => [`${s.productId}:${s.price}:${s.title}`, i]));
          listings = [...pueListings].sort(
            (a, b) => (scoredIndex.get(`${a.productId}:${a.price}:${a.title}`) ?? 0) - (scoredIndex.get(`${b.productId}:${b.price}:${b.title}`) ?? 0)
          );
        }
      }
    }
  }

  const productPriceStats = buildProductPriceStats(
    listings.map((listing) => ({
      productId: listing.productId,
      price: listing.price,
    })),
  );

  if (serverSupabase && authData.user) {
    const { data, error } = await serverSupabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", authData.user.id);

    if (error) {
      console.error("Supabase favorites query failed:", error);
    } else {
      favoriteListingIds = (data ?? []).map((favorite) =>
        String(favorite.listing_id),
      );
    }
  }

  return (
    <>
      <section className="border-b border-black/8 bg-[#fafaf8] py-8 sm:py-10">
        <div className="container-shell">
          {query && (
            <div className="mx-auto w-full max-w-4xl mb-6">
              <Breadcrumbs
                items={[
                  { label: "Ana Sayfa", href: "/" },
                  { label: `"${query}" araması` },
                ]}
              />
            </div>
          )}
          <div className="mx-auto w-full max-w-4xl">
            <SearchBar
              compact
              initialQuery={query}
              actionPath="/search"
              showLocation={false}
            />
          </div>
        </div>
      </section>

      <SearchResultsClient
        query={query}
        initialListings={listings}
        productPriceStats={productPriceStats}
        productCategories={Object.fromEntries(productCategory)}
        productAttributes={Object.fromEntries(productAttributes)}
        loadError={loadError}
        favoriteListingIds={favoriteListingIds}
        isAuthenticated={isAuthenticated}
        shouldQueueSearchDemand={Boolean(query && listings.length < 3 && !loadError)}
      />
    </>
  );
}

async function searchPublishedListingsByTitle(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  orFilter: string,
) {
  const result = await supabase
    .from("listings")
    .select(listingColumns)
    .in("status", ["published", "active"])
    .or(orFilter);
  if (!result.error || !isMissingStatusColumn(result.error)) return result;

  return supabase
    .from("listings")
    .select(listingColumns)
    .or(orFilter);
}

async function searchPublishedListingsByProduct(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productIds: (string | number)[],
) {
  const result = await supabase
    .from("listings")
    .select(listingColumns)
    .in("status", ["published", "active"])
    .in("product_id", productIds);
  if (!result.error || !isMissingStatusColumn(result.error)) return result;

  return supabase
    .from("listings")
    .select(listingColumns)
    .in("product_id", productIds);
}
