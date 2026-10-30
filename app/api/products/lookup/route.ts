import { NextResponse, type NextRequest } from "next/server";
import { rankProducts, type ProductCandidate } from "@/lib/listing-submission/product-match";
import { isPublicDemoProductName } from "@/lib/public-data-cleanup";
import { buildIlikeOrFilter } from "@/lib/search/ilike-filter";
import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const MAX_TERMS = 6;
const CANDIDATE_LIMIT = 40;
const RESULT_LIMIT = 8;

/**
 * Product search for the add-listing wizard: GET /api/products/lookup?q=...
 * Works with a few letters ("iph") and with a whole listing title ("Kutulu
 * iPhone 13 128 GB"); candidates matching any word are ranked by how much of
 * the product name the query covers (lib/listing-submission/product-match.ts).
 */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 200);
  // Unicode-aware split: ilike is case-insensitive but not accent-insensitive,
  // so the terms keep their Turkish letters.
  const terms = [...new Set(query.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length >= MIN_QUERY_LENGTH))].slice(0, MAX_TERMS);
  if (terms.length === 0) return NextResponse.json({ products: [] });

  const supabase = createSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Arama şu an kullanılamıyor." }, { status: 503 });

  const { data, error } = await supabase
    .from("products")
    .select("id, name, category")
    .or(buildIlikeOrFilter("name", terms))
    .order("name", { ascending: true })
    .limit(CANDIDATE_LIMIT);

  if (error) {
    console.error("Product lookup failed:", error);
    return NextResponse.json({ error: "Ürünler aranamadı." }, { status: 500 });
  }

  const candidates: ProductCandidate[] = (data ?? [])
    .filter((product) => !isPublicDemoProductName(product.name))
    .map((product) => ({ id: String(product.id), name: product.name, category: product.category }));

  // A query shorter than a word (prefix typing) has no full-word overlap, so
  // fall back to alphabetical order instead of an empty list.
  const ranked = rankProducts(query, candidates, RESULT_LIMIT);
  return NextResponse.json({ products: ranked.length > 0 ? ranked : candidates.slice(0, RESULT_LIMIT) });
}
