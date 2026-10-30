import { cache } from "react";
import { getNavigationCategoryTree, type CategoryWithChildren } from "@/lib/categories";
import { calculateMarketStats } from "@/lib/price-insights";
import { createProductSlug } from "@/lib/product-slug";
import { isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { createSupabaseClient } from "@/lib/supabase";
import { toBigintIds } from "@/lib/supabase-ids";

// Data for the /ikinci-el-fiyatlari landing page: every model with live
// listings, its lowest and average price, grouped by main category.

/** Upper bound of models on the page (one product_price_stats row each). */
const MAX_PRICE_LIST_MODELS = 1000;
/** Product ids per `in (...)` query, keeps the request URL short. */
const PRODUCT_QUERY_BATCH_SIZE = 200;

export type PriceListModel = {
  id: string;
  name: string;
  slug: string;
  listingCount: number;
  minPrice: number;
  averagePrice: number;
};

export type PriceListSection = {
  /** Main category slug; null for products whose category is not visible. */
  slug: string | null;
  name: string;
  listingCount: number;
  models: PriceListModel[];
};

export type PriceListProductRow = {
  id: string | number;
  name: string;
  slug?: string | null;
  category_id: number | null;
};

export type PriceListStatRow = {
  product_id: string | number | null;
  prices: Array<number | string> | null;
};

const UNCATEGORIZED_SECTION_NAME = "Diğer";

/** Pure grouping step: stats + products + category tree → ordered sections. */
export function buildPriceListSections(
  products: PriceListProductRow[],
  stats: PriceListStatRow[],
  tree: CategoryWithChildren[],
): PriceListSection[] {
  const mainByCategoryId = new Map<number, CategoryWithChildren>();
  for (const main of tree) {
    mainByCategoryId.set(main.id, main);
    for (const child of main.children) mainByCategoryId.set(child.id, main);
  }

  const pricesByProduct = new Map<string, number[]>();
  for (const row of stats) {
    if (row.product_id == null || !row.prices) continue;
    pricesByProduct.set(String(row.product_id), row.prices.map(Number));
  }

  const modelsBySection = new Map<string, PriceListModel[]>();
  for (const product of products) {
    if (isPublicDemoProductName(product.name)) continue;
    const marketStats = calculateMarketStats(pricesByProduct.get(String(product.id)) ?? []);
    if (!marketStats) continue;

    const main = product.category_id == null ? undefined : mainByCategoryId.get(product.category_id);
    const key = main?.slug ?? "";
    const models = modelsBySection.get(key) ?? [];
    models.push({
      id: String(product.id),
      name: product.name,
      slug: product.slug || createProductSlug(product.name),
      listingCount: marketStats.count,
      minPrice: marketStats.lowest,
      averagePrice: marketStats.average,
    });
    modelsBySection.set(key, models);
  }

  const toSection = (slug: string | null, name: string): PriceListSection | null => {
    const models = modelsBySection.get(slug ?? "");
    if (!models?.length) return null;
    models.sort(
      (a, b) => b.listingCount - a.listingCount || a.name.localeCompare(b.name, "tr"),
    );
    return {
      slug,
      name,
      listingCount: models.reduce((total, model) => total + model.listingCount, 0),
      models,
    };
  };

  return [
    ...tree.map((main) => toSection(main.slug, main.name)),
    toSection(null, UNCATEGORIZED_SECTION_NAME),
  ].filter((section): section is PriceListSection => section !== null);
}

async function fetchProducts(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productIds: string[],
): Promise<PriceListProductRow[]> {
  const batches: string[][] = [];
  for (let index = 0; index < productIds.length; index += PRODUCT_QUERY_BATCH_SIZE) {
    batches.push(productIds.slice(index, index + PRODUCT_QUERY_BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((ids) =>
      supabase.from("products").select("id, name, slug, category_id").in("id", toBigintIds(ids)),
    ),
  );

  const rows: PriceListProductRow[] = [];
  for (const result of results) {
    if (result.error) {
      console.error("Price list product query failed:", result.error);
      continue;
    }
    rows.push(...(result.data ?? []));
  }
  return rows;
}

export const getPriceListSections = cache(async (): Promise<PriceListSection[]> => {
  const supabase = createSupabaseClient();
  if (!supabase) return [];

  const statsResult = await supabase
    .from("product_price_stats")
    .select("product_id, prices")
    .order("listing_count", { ascending: false })
    .limit(MAX_PRICE_LIST_MODELS);

  if (statsResult.error) {
    console.error("Price list stats query failed:", statsResult.error);
    return [];
  }

  const stats = statsResult.data ?? [];
  const productIds = stats
    .map((row) => (row.product_id == null ? "" : String(row.product_id)))
    .filter(Boolean);
  if (!productIds.length) return [];

  const [products, tree] = await Promise.all([
    fetchProducts(supabase, productIds),
    getNavigationCategoryTree(),
  ]);
  return buildPriceListSections(products, stats, tree);
});
