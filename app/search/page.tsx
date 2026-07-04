import { SearchBar } from "@/components/search-bar";
import type {
  Listing,
  ListingCondition,
  ListingSource,
} from "@/lib/listings";
import { isMissingStatusColumn } from "@/lib/listing-status";
import { buildProductPriceStats } from "@/lib/price-analysis";
import { isPublicDemoListing, isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { resolveSearchIntent, scoreSearchResult } from "@/lib/search-intent";
import { createSupabaseClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SearchResultsClient } from "./search-results-client";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

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
  let searchIntentLabel: string | null = null;

  const serverSupabase = await createSupabaseServerClient();
  const { data: authData } = (await serverSupabase?.auth.getUser()) ?? {
    data: { user: null },
  };
  const isAuthenticated = Boolean(authData.user);

  if (!supabase) {
    loadError =
      "Supabase bağlantısı yapılandırılmamış. Ortam değişkenlerini kontrol edin.";
  } else if (query) {
    const intent = resolveSearchIntent(query);
    searchIntentLabel = intent.label;
    const searchTerms = intent.terms.slice(0, 48);
    const [matchingProductsResults, titleListingsResults] = await Promise.all([
      Promise.all(
        searchTerms.map((term) =>
          supabase
            .from("products")
            .select("id, name")
            .ilike("name", `%${term.term}%`),
        ),
      ),
      Promise.all(
        searchTerms.map((term) =>
          searchPublishedListingsByTitle(supabase, `%${term.term}%`),
        ),
      ),
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
      const matchingProductsById = new Map<string, { id: string | number; name: string }>();
      for (const result of matchingProductsResults) {
        for (const product of result.data ?? []) {
          matchingProductsById.set(String(product.id), {
            id: product.id,
            name: String(product.name),
          });
        }
      }
      const matchingProductIds = [...matchingProductsById.values()]
        .filter((product) => !isPublicDemoProductName(String(product.name)))
        .map((product) => product.id);
      const productListingsResult = matchingProductIds.length
        ? await searchPublishedListingsByProduct(
            supabase,
            matchingProductIds,
          )
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
          ? await supabase
              .from("products")
              .select("id, name")
              .in("id", productIds)
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

          listings = rows
            .map((row) => ({
              id: String(row.id),
              productId: String(row.product_id),
              title: String(row.title),
              productName:
                productNames.get(String(row.product_id)) ?? "Diğer",
              price: Number(row.price),
              city: String(row.city),
              source: row.source,
              url: String(row.url),
              condition: row.condition,
              imageUrl: row.image_url ? String(row.image_url) : null,
              createdAt: String(row.created_at),
            }))
            .sort((a, b) => {
              const scoreDifference =
                scoreSearchResult(intent, {
                  title: b.title,
                  productName: b.productName,
                }) -
                scoreSearchResult(intent, {
                  title: a.title,
                  productName: a.productName,
                });
              if (scoreDifference !== 0) return scoreDifference;
              return a.price - b.price;
            });
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
        loadError={loadError}
        favoriteListingIds={favoriteListingIds}
        isAuthenticated={isAuthenticated}
        shouldQueueSearchDemand={Boolean(query && listings.length < 3 && !loadError)}
        searchIntentLabel={searchIntentLabel}
      />
    </>
  );
}

async function searchPublishedListingsByTitle(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  pattern: string,
) {
  const result = await supabase
    .from("listings")
    .select(listingColumns)
    .in("status", ["published", "active"])
    .ilike("title", pattern);
  if (!result.error || !isMissingStatusColumn(result.error)) return result;

  return supabase
    .from("listings")
    .select(listingColumns)
    .ilike("title", pattern);
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
