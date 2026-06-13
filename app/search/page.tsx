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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] ?? "" : params.q?.trim() ?? "";
  const normalizedQuery = query.toLocaleLowerCase("tr-TR");
  const supabase = createSupabaseClient();

  let listings: Listing[] = [];
  let loadError = "";
  let isAuthenticated = false;
  let favoriteListingIds: string[] = [];

  const serverSupabase = await createSupabaseServerClient();
  const { data: authData } = (await serverSupabase?.auth.getUser()) ?? {
    data: { user: null },
  };
  isAuthenticated = Boolean(authData.user);

  if (!supabase) {
    loadError =
      "Supabase bağlantısı yapılandırılmamış. Ortam değişkenlerini kontrol edin.";
  } else if (normalizedQuery) {
    const [productsResult, listingsResult] = await Promise.all([
      supabase.from("products").select("id, name"),
      supabase
        .from("listings")
        .select(
          "id, product_id, title, price, city, source, url, condition, created_at",
        ),
    ]);

    if (productsResult.error) {
      console.error("Supabase products query failed:", productsResult.error);
    }

    if (listingsResult.error) {
      console.error("Supabase listings query failed:", listingsResult.error);
    }

    if (productsResult.error || listingsResult.error) {
      loadError = "İlanlar yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.";
    } else {
      const productNames = new Map(
        (productsResult.data ?? []).map((product) => [
          String(product.id),
          String(product.name),
        ]),
      );

      listings = (listingsResult.data ?? [])
        .map((row) => ({
          id: String(row.id),
          title: String(row.title),
          productName: productNames.get(String(row.product_id)) ?? "",
          price: Number(row.price),
          city: String(row.city),
          source: row.source as ListingSource,
          url: String(row.url),
          condition: row.condition as ListingCondition,
          createdAt: String(row.created_at),
        }))
        .filter((listing) => listing.productName);
    }
  }

  const results = normalizedQuery
    ? listings.filter(
        (listing) =>
          listing.productName.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
          listing.title.toLocaleLowerCase("tr-TR").includes(normalizedQuery),
      )
    : [];

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
          <div className="mx-auto max-w-4xl">
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
        initialListings={results}
        productAverages={productAverages}
        productCounts={productCounts}
        loadError={loadError}
        favoriteListingIds={favoriteListingIds}
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
