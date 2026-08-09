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
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";
import { analyzeProduct } from "@/lib/product-understanding";
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
  productType?: string | null;
};

export async function dryRunProductMatch({
  supabase,
  title,
  productName,
  category,
  source,
  resolver,
  attributes,
}: FindOrCreateMatchedProductInput): Promise<ProductMatcherDryRunResult> {
  const state = prepareMatcherState(title, productName, resolver, attributes);
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
  attributes,
}: FindOrCreateMatchedProductInput): Promise<MatchedProduct> {
  const state = prepareMatcherState(title, productName, resolver, attributes);
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
    const ensuredAttributes = await ensureProductUnderstanding(
      supabase,
      matchedProduct.id,
      matchedProduct.attributes,
      title,
      category,
    );
    return {
      id: matchedProduct.id,
      name: matchedProduct.name,
      signals: state.signals,
      created: false,
      attributes: ensuredAttributes,
      ...confidence,
    };
  }

  const insertPayload: Record<string, unknown> = {
    name: state.canonicalName,
    normalized_key: state.canonicalKey,
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
      .select("id, name, attributes")
      .eq("name", state.canonicalName)
      .maybeSingle();
    if (duplicateLookup.error) throw duplicateLookup.error;
    if (duplicateLookup.data) {
      const ensuredAttributes = await ensureProductUnderstanding(
        supabase,
        duplicateLookup.data.id,
        "attributes" in duplicateLookup.data
          ? (duplicateLookup.data as { attributes?: unknown }).attributes
          : undefined,
        title,
        category,
      );
      return {
        id: duplicateLookup.data.id,
        name: String(duplicateLookup.data.name),
        signals: state.signals,
        created: false,
        attributes: ensuredAttributes,
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
    attributes: await ensureProductUnderstanding(
      supabase,
      createdProduct.id,
      undefined,
      title,
      category,
    ),
    ...confidence,
  };
}

function prepareMatcherState(
  title: string,
  productName: string | null | undefined,
  resolver?: ICategoryResolver,
  attributes?: unknown,
): MatcherState {
  const combinedTitle = `${productName ?? ""} ${title}`.trim();
  const normalizedTitle = normalizeProductTitle(combinedTitle);
  const signals = extractProductSignals(combinedTitle, resolver);
  const canonicalName = createCanonicalProductName(signals, productName || title);
  const canonicalKey = signals.normalizedKey;
  const productType = extractProductTypeFromAttributes(attributes);

  return {
    normalizedTitle,
    signals,
    canonicalName,
    canonicalKey,
    productType,
  };
}

async function ensureProductUnderstanding(
  supabase: SupabaseClient,
  productId: string | number,
  existingAttributes: unknown,
  title: string,
  category: string | null | undefined,
) {
  const hasUnderstanding = hasProductUnderstanding(existingAttributes);
  if (hasUnderstanding) return existingAttributes;

  const understanding = analyzeProduct({
    title,
    marketplaceCategory: category ?? undefined,
  });

  const { error } = await supabase
    .from("products")
    .update({ attributes: understanding })
    .eq("id", productId);

  if (error) {
    console.warn(
      `[Product Matcher] Failed to backfill attributes for product ${productId}: ${error.message}`,
    );
    return existingAttributes ?? understanding;
  }

  return understanding;
}

function hasProductUnderstanding(attributes: unknown) {
  if (!attributes || typeof attributes !== "object") return false;
  const record = attributes as Record<string, unknown>;
  return "productUnderstanding" in record;
}

export async function batchFindOrCreateMatchedProducts(
  supabase: SupabaseClient,
  inputs: BatchMatcherInput[],
  resolver?: ICategoryResolver,
): Promise<(MatchedProduct | null)[]> {
  if (inputs.length === 0) return [];

  const states = inputs.map((input) =>
    prepareMatcherState(input.title, input.productName, resolver, input.attributes),
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
      const ensuredAttributes = await ensureProductUnderstanding(
        supabase,
        existing.id,
        existing.attributes,
        inputs[i].title,
        inputs[i].category || state.signals.category,
      );
      results.push({
        id: existing.id,
        name: existing.name,
        signals: state.signals,
        created: false,
        attributes: ensuredAttributes,
        ...confidence,
      });
    } else {
      results.push(null);
      unmatchedIndices.push(i);
      const payload: Record<string, unknown> = {
        name: state.canonicalName,
        normalized_key: state.canonicalKey,
      };
      const category = inputs[i].category || state.signals.category;
      if (category) payload.category = category;
      unmatchedPayloads.push(payload);
    }
  }

  if (unmatchedIndices.length === 0) return results;

  // Deduplicate by canonicalName to prevent creating duplicate rows
  // for the same product appearing multiple times in a single batch
  const seenNames = new Set<string>();
  const dedupedPayloads: { payload: Record<string, unknown>; originalIndex: number }[] = [];
  for (let j = 0; j < unmatchedIndices.length; j++) {
    const i = unmatchedIndices[j];
    const name = states[i].canonicalName;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    dedupedPayloads.push({ payload: unmatchedPayloads[j], originalIndex: i });
  }

  const { data: createdProducts, error: insertError } = await supabase
    .from("products")
    .insert(dedupedPayloads.map((d) => d.payload))
    .select("id, name");

  if (insertError && isDuplicateError(insertError)) {
    const dedupedNames = dedupedPayloads.map((d) => states[d.originalIndex].canonicalName);
    const { data: retryProducts, error: retryError } = await supabase
      .from("products")
      .select("id, name")
      .in("name", dedupedNames);
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

    for (const d of dedupedPayloads) {
      const i = d.originalIndex;
      const { state, confidence } = confidenceResults[i];
      const product = retryByName.get(state.canonicalName);
      if (product) {
        const ensuredAttributes = await ensureProductUnderstanding(
          supabase,
          product.id,
          "attributes" in product ? (product as { attributes?: unknown }).attributes : undefined,
          inputs[i].title,
          inputs[i].category || state.signals.category,
        );
        results[i] = {
          id: product.id,
          name: product.name,
          signals: state.signals,
          created: false,
          attributes: ensuredAttributes,
          ...confidence,
        };
      }
    }
  } else if (insertError) {
    throw insertError;
  } else if (createdProducts) {
    for (let j = 0; j < dedupedPayloads.length; j++) {
      const i = dedupedPayloads[j].originalIndex;
      const { state, confidence } = confidenceResults[i];
      const cp = createdProducts[j];
      if (cp) {
        const ensuredAttributes = await ensureProductUnderstanding(
          supabase,
          cp.id,
          "attributes" in cp ? (cp as { attributes?: unknown }).attributes : undefined,
          inputs[i].title,
          inputs[i].category || state.signals.category,
        );
        results[i] = {
          id: cp.id,
          name: String(cp.name),
          signals: state.signals,
          created: true,
          attributes: ensuredAttributes,
          ...confidence,
        };
      }
    }
  }

  return results;
}
