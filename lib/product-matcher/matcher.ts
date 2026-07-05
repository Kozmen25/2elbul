import type { ICategoryResolver } from "@/lib/taxonomy/integration";
import { normalizeProductTitle } from "./helpers";
import { extractProductSignals } from "./signals";
import { createCanonicalProductName } from "./canonical";
import { buildProductConfidenceMetadata } from "./confidence";
import { findExistingMatchedProduct } from "./repository";
import { isDuplicateError } from "./helpers";
import type {
  FindOrCreateMatchedProductInput,
  MatchedProduct,
  ProductMatcherDryRunResult,
} from "./types";

type MatcherState = {
  normalizedTitle: string;
  signals: ReturnType<typeof extractProductSignals>;
  canonicalName: string;
  canonicalKey: string;
};

export async function dryRunProductMatch({
  supabase,
  title,
  productName,
  category,
  source,
  resolver,
}: FindOrCreateMatchedProductInput): Promise<ProductMatcherDryRunResult> {
  const state = prepareMatcherState(title, productName, resolver);
  const matchedProduct = await findExistingMatchedProduct(
    supabase,
    state.canonicalName,
    state.canonicalKey,
  );

  return {
    inputTitle: title,
    normalizedTitle: state.normalizedTitle,
    signals: {
      ...state.signals,
      category: category || state.signals.category,
    },
    productKey: state.canonicalKey,
    matchedProduct: matchedProduct
      ? {
          id: matchedProduct.id,
          name: matchedProduct.name,
        }
      : null,
    wouldCreate: !matchedProduct,
    suggestedName: state.canonicalName,
    ...buildProductConfidenceMetadata(state.signals, {
      normalizedTitle: state.normalizedTitle,
      canonicalTitle: state.canonicalName,
      source: source ?? null,
      category: category || state.signals.category,
    }),
  };
}

export async function findOrCreateMatchedProduct({
  supabase,
  title,
  productName,
  category,
  source,
  resolver,
}: FindOrCreateMatchedProductInput): Promise<MatchedProduct> {
  const state = prepareMatcherState(title, productName, resolver);
  const confidence = buildProductConfidenceMetadata(state.signals, {
    normalizedTitle: state.normalizedTitle,
    canonicalTitle: state.canonicalName,
    source: source ?? null,
    category: category || state.signals.category,
  });

  const matchedProduct = await findExistingMatchedProduct(
    supabase,
    state.canonicalName,
    state.canonicalKey,
  );
  if (matchedProduct) {
    return {
      id: matchedProduct.id,
      name: matchedProduct.name,
      signals: state.signals,
      created: false,
      ...confidence,
    };
  }

  const insertPayload: Record<string, unknown> = {
    name: state.canonicalName,
  };
  const productCategory = category || state.signals.category;
  if (productCategory) insertPayload.category = productCategory;

  const { data: createdProduct, error: insertError } = await supabase
    .from("products")
    .insert(insertPayload)
    .select("id, name")
    .single();
  if (insertError && isDuplicateError(insertError)) {
    const duplicateLookup = await supabase
      .from("products")
      .select("id, name")
      .eq("name", state.canonicalName)
      .maybeSingle();
    if (duplicateLookup.error) throw duplicateLookup.error;
    if (duplicateLookup.data) {
      return {
        id: duplicateLookup.data.id,
        name: String(duplicateLookup.data.name),
        signals: state.signals,
        created: false,
        ...confidence,
      };
    }
  }
  if (insertError || !createdProduct) {
    throw new Error(insertError?.message ?? "Ürün oluşturulamadı.");
  }

  return {
    id: createdProduct.id,
    name: String(createdProduct.name),
    signals: state.signals,
    created: true,
    ...confidence,
  };
}

function prepareMatcherState(
  title: string,
  productName: string | null | undefined,
  resolver?: ICategoryResolver,
): MatcherState {
  const combinedTitle = `${productName ?? ""} ${title}`.trim();
  const normalizedTitle = normalizeProductTitle(combinedTitle);
  const signals = extractProductSignals(combinedTitle, resolver);
  const canonicalName = createCanonicalProductName(signals, productName || title);
  const canonicalKey = signals.normalizedKey;

  return {
    normalizedTitle,
    signals,
    canonicalName,
    canonicalKey,
  };
}
