import { createSupabaseClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { attachPueScore } from "@/lib/search/pue-ranking";
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";
import { isMissingAttributesColumn, isMissingStatusColumn } from "@/lib/listing-status";
import { createProductSlug } from "@/lib/product-slug";
import { isPublicDemoListing, isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getProductDetail } from "@/lib/product-detail";
import { buildSearchPlan } from "@/lib/search/ai/planner";
import {
  buildSearchExplanation,
  type GroundedProductSummary,
} from "@/lib/search/ai/explanation";
import type { ListingCondition, ListingSource } from "@/lib/listings";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RATE_LIMIT_ANON = { limit: 10, windowMs: 60 * 60 * 1000 };
const RATE_LIMIT_AUTH = { limit: 100, windowMs: 60 * 60 * 1000 };

const LISTING_COLUMNS =
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

type AiListingHit = {
  id: string;
  title: string;
  price: number;
  city: string;
  source: ListingSource;
  condition: ListingCondition;
  imageUrl: string | null;
  url: string;
  createdAt: string;
  productId: string;
  productName: string;
  productSlug: string | null;
  category: string | null;
  productType: string | null;
  score: number;
};

/** Max products we fetch grounded detail for (explanation only reads the top 3). */
const MAX_SUMMARY_PRODUCTS = 8;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const { searchParams } = request.nextUrl;
  const query = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim();

  // ---- Rate limit first (security §12): anon vs auth split, never blocks the
  // ---- deterministic pipeline — it just asks the client to fall back.
  const rateKey = await resolveRateKey(request);
  const limit = rateKey.isAuthenticated ? RATE_LIMIT_AUTH : RATE_LIMIT_ANON;
  const rateCheck = checkRateLimit(rateKey.key, limit.limit, limit.windowMs);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, fallback: true, error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)) },
      },
    );
  }

  if (!query) {
    return NextResponse.json(
      {
        ok: true,
        plan: buildSearchPlan("").plan,
        products: [],
        explanation:
          "Aramanıza dair bir soru yazın (ör. '10 bin altı telefon', 'oyun için laptop', 'en ucuz PS5').",
      },
      { status: 200 },
    );
  }

  try {
    const { plan, expandedTerms } = buildSearchPlan(query);

    // fast_search: the AI intent layer found nothing structured — hand back a
    // minimal envelope so the client keeps using the existing pipeline as-is
    // (zero new behavior/cost on simple keywords).
    if (plan.mode === "fast_search") {
      console.log(
        `[ai-search] fast_search mode=fast_search query="${query}" resultCount=0 latency=${Date.now() - startedAt}ms`,
      );
      return NextResponse.json(
        { ok: true, plan, products: [], explanation: "" },
        { status: 200 },
      );
    }

    const supabase = createSupabaseClient();
    if (!supabase) {
      throw new Error("supabase_not_configured");
    }

    // ---- Existing pipeline, verbatim shape: run expansion terms through the
    // ---- same product-title + published-listings queries the live search uses.
    const terms = dedupe([query, ...expandedTerms].filter((t): t is string => !!t));
    const [matchingProductsResults, titleListingsResults] = await Promise.all([
      Promise.all(
        terms.map((term) =>
          supabase
            .from("products")
            .select("id, name, category, attributes")
            .ilike("name", `%${term}%`),
        ),
      ),
      Promise.all(
        terms.map((term) => searchPublishedListingsByTitle(supabase, `%${term}%`)),
      ),
    ]);

    const productSearchError = matchingProductsResults.find((r) => r.error)?.error;
    const titleSearchError = titleListingsResults.find((r) => r.error)?.error;
    if (productSearchError || titleSearchError) {
      throw productSearchError ?? titleSearchError;
    }

    const matchingProductsById = new Map<
      string,
      { id: string | number; name: string; category: string | null; attributes?: unknown }
    >();
    for (const result of matchingProductsResults) {
      for (const product of result.data ?? []) {
        matchingProductsById.set(String(product.id), {
          id: product.id,
          name: String(product.name),
          category: "category" in product ? String(product.category) : null,
          attributes: (product as { attributes?: unknown }).attributes,
        });
      }
    }

    const matchingProductIds = [...matchingProductsById.values()]
      .filter((product) => !isPublicDemoProductName(product.name))
      .map((product) => product.id);

    const productListingsResult = matchingProductIds.length
      ? await searchPublishedListingsByProduct(supabase, matchingProductIds)
      : { data: [], error: null };
    if (productListingsResult.error) throw productListingsResult.error;

    const rowsById = new Map<string, ListingRow>();
    for (const row of [
      ...(titleListingsResults.flatMap((r) => (r.data ?? []) as ListingRow[])),
      ...((productListingsResult.data ?? []) as ListingRow[]),
    ]) {
      rowsById.set(String(row.id), row as ListingRow);
    }

    const rows = [...rowsById.values()].filter((row) => !isPublicDemoListing(row));
    const productIds = [...new Set(rows.map((row) => String(row.product_id)))];
    const productsResult = productIds.length
      ? await supabase
          .from("products")
          .select("id, name, slug, category, attributes")
          .in("id", productIds)
          .then((result) => {
            if (!result.error || !isMissingAttributesColumn(result.error)) return result;
            return supabase
              .from("products")
              .select("id, name, slug, category")
              .in("id", productIds);
          })
      : { data: [], error: null };

    if (productsResult.error) throw productsResult.error;

    const productData = new Map(
      (productsResult.data ?? [])
        .filter((p) => !isPublicDemoProductName(String(p.name)))
        .map((p) => [
          String(p.id),
          {
            name: String(p.name),
            slug: p.slug ? String(p.slug) : createProductSlug(String(p.name)),
            category: "category" in p ? String(p.category) : null,
          },
        ]),
    );

    const productLookup = new Map<string, { attributes?: unknown }>(
      (productsResult.data ?? [])
        .filter((p) => !isPublicDemoProductName(String(p.name)))
        .filter((p) => (p as { attributes?: unknown }).attributes != null)
        .map((p) => [
          String(p.id),
          { attributes: (p as { attributes?: unknown }).attributes },
        ]),
    );

    let allListings: AiListingHit[] = rows
      .map((row): AiListingHit | null => {
        const product = productData.get(String(row.product_id));
        if (!product) return null;
        const lookup = productLookup.get(String(row.product_id));
        return {
          id: String(row.id),
          title: String(row.title),
          price: Number(row.price),
          city: String(row.city),
          source: row.source,
          condition: row.condition,
          imageUrl: row.image_url ? String(row.image_url) : null,
          url: String(row.url),
          createdAt: String(row.created_at),
          productId: String(row.product_id),
          productName: product.name,
          productSlug: product.slug,
          category: product.category ?? null,
          productType: lookup
            ? extractProductTypeFromAttributes(lookup.attributes)
            : null,
          score: attachPueScore(plan.intent, String(row.product_id), productLookup),
        };
      })
      .filter(Boolean) as AiListingHit[];

    // ---- Apply the plan as REAL filters over REAL prices (§ no fabrication).

    // Only gate by product type when the live intent actually asserted one; a
    // null intent must never layer a forced type (§21 PUE override / force-typing).
    if (plan.intent.productType != null) {
      const expected = plan.intent.productType;
      allListings = allListings.filter((l) => l.productType === expected);
    }

    // Exclusions: drop listings whose title mentions a part/service term.
    if (plan.exclusions.length > 0) {
      const lc = (s: string) => s.toLocaleLowerCase("tr");
      allListings = allListings.filter((l) => {
        const hay = `${lc(l.productName)} ${lc(l.title)}`;
        return !plan.exclusions.some((term) => hay.includes(lc(term)));
      });
    }

    // Price band: min / max / target±tolerance, all applied to real listing prices.
    const { min, max, target, tolerance } = plan.priceRange;
    if (target != null) {
      const tol = tolerance ?? 0.1;
      const lo = Math.floor(target * (1 - tol));
      const hi = Math.ceil(target * (1 + tol));
      allListings = allListings.filter((l) => l.price >= lo && l.price <= hi);
    } else {
      if (min != null) allListings = allListings.filter((l) => l.price >= min!);
      if (max != null) allListings = allListings.filter((l) => l.price <= max!);
    }

    // Reference product (§20 "iPhone 15 Pro'dan ucuz telefon"): resolve the
    // reference's REAL market value from existing system output and apply it as a
    // grounded ceiling/floor. Never invent a number. Skip silently if unresolvable.
    if (plan.referenceProduct) {
      const refValue = await resolveReferenceMarketValue(supabase, plan.referenceProduct.name);
      if (refValue != null && refValue > 0) {
        allListings =
          plan.referenceProduct.relation === "cheaper_than"
            ? allListings.filter((l) => l.price < refValue)
            : allListings.filter((l) => l.price > refValue);
      }
    }

    // ---- Sort via the existing client vocabulary.
    allListings.sort(listingComparator(plan.sort));

    // ---- Aggregate to product-level results, ordered by best listing score.
    const products = aggregateProducts(allListings);

    // ---- Grounded summaries for the explanation (top products only).
    const topSlugs = products.slice(0, MAX_SUMMARY_PRODUCTS).map((p) => p.slug);
    const grounded = await buildGroundedSummaries(topSlugs);
    const productsForExplanation: GroundedProductSummary[] = products
      .slice(0, MAX_SUMMARY_PRODUCTS)
      .map((p, i) => grounded.get(p.slug) ?? { name: p.name, slug: p.slug });

    const explanation = buildSearchExplanation({
      plan,
      products: productsForExplanation,
    });

    console.log(
      `[ai-search] ${plan.mode} mode=${plan.mode} query="${query}" resultCount=${products.length} latency=${Date.now() - startedAt}ms`,
    );

    return NextResponse.json({ ok: true, plan, products, explanation }, { status: 200 });
  } catch (err) {
    // Fail-open: the AI layer never blanks a page. Return a structured envelope
    // that tells the client to keep its existing deterministic search.
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error(`[ai-search] fallback query="${query}" error=${message}`);
    return NextResponse.json(
      {
        ok: false,
        fallback: true,
        reason: message,
        products: [],
        explanation: "",
      },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------

/** Auth-aware rate-limit key; anonymous and authenticated searches are separate. */
async function resolveRateKey(
  request: NextRequest,
): Promise<{ key: string; isAuthenticated: boolean }> {
  const ip = getClientIp(request);
  const serverSupabase = await createSupabaseServerClient();
  if (serverSupabase) {
    const { data: auth } = await serverSupabase.auth.getUser();
    if (auth?.user) {
      return { key: `ai-search:auth:${auth.user.id}`, isAuthenticated: true };
    }
  }
  return { key: `ai-search:anon:${ip}`, isAuthenticated: false };
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

async function searchPublishedListingsByTitle(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  pattern: string,
) {
  const result = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .in("status", ["published", "active"])
    .ilike("title", pattern);
  if (!result.error || !isMissingStatusColumn(result.error)) return result;

  return supabase.from("listings").select(LISTING_COLUMNS).ilike("title", pattern);
}

async function searchPublishedListingsByProduct(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  productIds: (string | number)[],
) {
  const result = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .in("status", ["published", "active"])
    .in("product_id", productIds);
  if (!result.error || !isMissingStatusColumn(result.error)) return result;

  return supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .in("product_id", productIds);
}

/**
 * Grounded reference price: find a product whose name contains the reference
 * label, then read its REAL market value via the existing product-detail system.
 * Returns null when unresolvable so the caller skips the filter (never invents).
 */
async function resolveReferenceMarketValue(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  referenceName: string,
): Promise<number | null> {
  const { data: rows } = await supabase
    .from("products")
    .select("id, name, slug")
    .ilike("name", `%${referenceName}%`)
    .limit(20);
  if (!rows || rows.length === 0) return null;

  const target = rows
    .filter((r) => !isPublicDemoProductName(String(r.name)))
    .sort((a, b) => String(a.name).length - String(b.name).length)[0];
  if (!target) return null;

  const slug = target.slug ? String(target.slug) : createProductSlug(String(target.name));
  const detail = await getProductDetail(slug);
  const value = detail?.marketIntelligence?.priceAnalysis?.marketValue;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Aggregate per-listing hits into product-level summaries, ordered by score. */
function aggregateProducts(listings: AiListingHit[]) {
  const byId = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string;
      category: string | null;
      productType: string | null;
      listingCount: number;
      minPrice: number;
      maxPrice: number;
      averagePrice: number;
      bestScore: number;
    }
  >();
  for (const l of listings) {
    const cur = byId.get(l.productId);
    if (cur) {
      cur.listingCount += 1;
      cur.minPrice = Math.min(cur.minPrice, l.price);
      cur.maxPrice = Math.max(cur.maxPrice, l.price);
      cur.bestScore = Math.max(cur.bestScore, l.score);
      continue;
    }
    byId.set(l.productId, {
      id: l.productId,
      name: l.productName,
      slug: l.productSlug ?? createProductSlug(l.productName),
      category: l.category,
      productType: l.productType,
      listingCount: 1,
      minPrice: l.price,
      maxPrice: l.price,
      averagePrice: l.price,
      bestScore: l.score,
    });
  }
  const products = [...byId.values()];
  products.sort(
    (a, b) => b.bestScore - a.bestScore || a.averagePrice - b.averagePrice,
  );
  for (const p of products) {
    p.averagePrice = Math.round(
      listings
        .filter((l) => l.productId === p.id)
        .reduce((sum, l) => sum + l.price, 0) / p.listingCount,
    );
  }
  return products;
}

/** Sort the per-listing list using only the existing client sort vocabulary. */
function listingComparator(sort: string | null) {
  switch (sort) {
    case "price-asc":
      return (a: AiListingHit, b: AiListingHit) => a.price - b.price;
    case "newest":
      return (a: AiListingHit, b: AiListingHit) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    case "most-listings":
      return (a: AiListingHit, b: AiListingHit) => b.score - a.score || a.price - b.price;
    case "confidence":
    case "most-reliable":
    case "ai-recommended":
    case "best-opportunity":
    case "lowest-risk":
      return (a: AiListingHit, b: AiListingHit) =>
        b.score - a.score || a.price - b.price;
    default:
      return (a: AiListingHit, b: AiListingHit) =>
        b.score - a.score || a.price - b.price;
  }
}

async function buildGroundedSummaries(slugs: string[]): Promise<Map<string, GroundedProductSummary>> {
  const out = new Map<string, GroundedProductSummary>();
  const unique = dedupe(slugs);
  // Bound concurrency so N+1 detail fetches never hammer the DB.
  for (const slug of unique) {
    const detail = await getProductDetail(slug);
    if (!detail) continue;
    out.set(slug, {
      name: detail.product.name,
      slug,
      decisionInsight: detail.decisionInsight,
      marketSummary: detail.marketIntelligence?.marketSummary ?? null,
      opportunity: detail.marketIntelligence?.opportunity ?? null,
      priceAnalysis: detail.marketIntelligence?.priceAnalysis ?? null,
    });
  }
  return out;
}
