import { SearchBar } from "@/components/search-bar";
import type {
  Listing,
  ListingCondition,
  ListingSource,
} from "@/lib/listings";
import { createSupabaseClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SearchResultsClient } from "./search-results-client";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

const listingColumns =
  "id, product_id, title, price, city, source, url, condition, created_at";

type ListingRow = {
  id: string | number;
  product_id: string | number;
  title: string;
  price: string | number;
  city: string;
  source: ListingSource;
  url: string;
  condition: ListingCondition;
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

  const serverSupabase = await createSupabaseServerClient();
  const { data: authData } = (await serverSupabase?.auth.getUser()) ?? {
    data: { user: null },
  };
  const isAuthenticated = Boolean(authData.user);

  if (!supabase) {
    loadError =
      "Supabase bağlantısı yapılandırılmamış. Ortam değişkenlerini kontrol edin.";
  } else if (query) {
    const searchPattern = `%${query}%`;
    const [matchingProductsResult, titleListingsResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, name")
        .ilike("name", searchPattern),
      supabase
        .from("listings")
        .select(listingColumns)
        .ilike("title", searchPattern),
    ]);

    if (matchingProductsResult.error) {
      console.error(
        "Supabase product name search failed:",
        matchingProductsResult.error,
      );
    }
    if (titleListingsResult.error) {
      console.error(
        "Supabase listing title search failed:",
        titleListingsResult.error,
      );
    }

    if (matchingProductsResult.error || titleListingsResult.error) {
      loadError = "İlanlar aranırken bir sorun oluştu. Lütfen tekrar deneyin.";
    } else {
      const matchingProductIds = (matchingProductsResult.data ?? []).map(
        (product) => product.id,
      );
      const productListingsResult = matchingProductIds.length
        ? await supabase
            .from("listings")
            .select(listingColumns)
            .in("product_id", matchingProductIds)
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
          ...((titleListingsResult.data ?? []) as ListingRow[]),
          ...((productListingsResult.data ?? []) as ListingRow[]),
        ]) {
          rowsById.set(String(row.id), row);
        }

        const rows = [...rowsById.values()];
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
            (productsResult.data ?? []).map((product) => [
              String(product.id),
              String(product.name),
            ]),
          );

          listings = rows
            .map((row) => ({
              id: String(row.id),
              title: String(row.title),
              productName:
                productNames.get(String(row.product_id)) ?? "Diğer",
              price: Number(row.price),
              city: String(row.city),
              source: row.source,
              url: String(row.url),
              condition: row.condition,
              createdAt: String(row.created_at),
            }))
            .sort((a, b) => a.price - b.price);
        }
      }
    }
  }

  const productTotals = listings.reduce<
    Record<string, { total: number; count: number }>
  >((totals, listing) => {
    const current = totals[listing.productName] ?? { total: 0, count: 0 };
    totals[listing.productName] = {
      total: current.total + listing.price,
      count: current.count + 1,
    };
    return totals;
  }, {});

  const productAverages = Object.fromEntries(
    Object.entries(productTotals).map(([productName, value]) => [
      productName,
      value.total / value.count,
    ]),
  );
  const productCounts = Object.fromEntries(
    Object.entries(productTotals).map(([productName, value]) => [
      productName,
      value.count,
    ]),
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
        productAverages={productAverages}
        productCounts={productCounts}
        loadError={loadError}
        favoriteListingIds={favoriteListingIds}
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
