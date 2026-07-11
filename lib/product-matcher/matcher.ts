import type { ICategoryResolver } from "@/lib/taxonomy/integration";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeProductTitle } from "./helpers";
import { extractProductSignals } from "./signals";
import { createCanonicalProductName } from "./canonical";
import { buildProductConfidenceMetadata } from "./confidence";
import {
  batchFindExistingMatchedProducts,
  findExistingMatchedProduct,
} from "./repository";
import { isDuplicateError } from "./helpers";
import type {
  BatchMatchCandidate,
  BatchMatcherInput,
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

export async function batchFindOrCreateMatchedProducts(
  supabase: SupabaseClient,
  inputs: BatchMatcherInput[],
  resolver?: ICategoryResolver,
): Promise<(MatchedProduct | null)[]> {
  if (inputs.length === 0) return [];

  const states = inputs.map((input) =>
    prepareMatcherState(input.title, input.productName, resolver),
  );

  const candidates: BatchMatchCandidate[] = states.map((s) => ({
    canonicalName: s.canonicalName,
    canonicalKey: s.canonicalKey,
  }));

  const matchedMap = await batchFindExistingMatchedProducts(supabase, candidates);

  const confidenceResults = inputs.map((input, i) => ({
    state: states[i],
    confidence: buildProductConfidenceMetadata(states[i].signals, {
      normalizedTitle: states[i].normalizedTitle,
      canonicalTitle: states[i].canonicalName,
      source: input.source ?? null,
      category: input.category || states[i].signals.category,
    }),
  }));

  const results: (MatchedProduct | null)[] = [];
  const unmatchedIndices: number[] = [];
  const unmatchedPayloads: Record<string, unknown>[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const { state, confidence } = confidenceResults[i];
    const existing = matchedMap.get(state.canonicalName);

    if (existing) {
      results.push({
        id: existing.id,
        name: existing.name,
        signals: state.signals,
        created: false,
        ...confidence,
      });
    } else {
      results.push(null);
      unmatchedIndices.push(i);
      const payload: Record<string, unknown> = { name: state.canonicalName };
      const category = inputs[i].category || state.signals.category;
      if (category) payload.category = category;
      unmatchedPayloads.push(payload);
    }
  }

  if (unmatchedIndices.length === 0) return results;

  const { data: createdProducts, error: insertError } = await supabase
    .from("products")
    .insert(unmatchedPayloads)
    .select("id, name");

  if (insertError && isDuplicateError(insertError)) {
    const unmatchedNames = unmatchedIndices.map((i) => states[i].canonicalName);
    const { data: retryProducts, error: retryError } = await supabase
      .from("products")
      .select("id, name")
      .in("name", unmatchedNames);
    if (retryError) throw retryError;

    const retryByName = new Map<string, { id: string | number; name: string }>();
    if (retryProducts) {
      for (const p of retryProducts) {
        const pn = String(p.name);
        if (!retryByName.has(pn)) {
          retryByName.set(pn, { id: p.id, name: pn });
        }
      }
    }

    for (let j = 0; j < unmatchedIndices.length; j++) {
      const i = unmatchedIndices[j];
      const { state, confidence } = confidenceResults[i];
      const product = retryByName.get(state.canonicalName);
      if (product) {
        results[i] = {
          id: product.id,
          name: product.name,
          signals: state.signals,
          created: false,
          ...confidence,
        };
      }
    }
  } else if (insertError) {
    throw insertError;
  } else if (createdProducts) {
    for (let j = 0; j < unmatchedIndices.length; j++) {
      const i = unmatchedIndices[j];
      const { state, confidence } = confidenceResults[i];
      const cp = createdProducts[j];
      if (cp) {
        results[i] = {
          id: cp.id,
          name: String(cp.name),
          signals: state.signals,
          created: true,
          ...confidence,
        };
      }
    }
  }

  return results;
}
