"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import {
  applyCategory,
  buildCategoryChoices,
  loadFallbackProducts,
  REVIEW_BATCH_SIZE,
  suggestCategories,
  type CategorySuggestion,
} from "@/lib/ai/classification-review";
import { classifyProductWithAi, type ProductClassification } from "@/lib/ai/features/classify-product";
import { getSearchInterpretation, type SearchInterpretation } from "@/lib/ai/features/interpret-search";
import { judgeProductMatch, type MatchJudgement } from "@/lib/ai/features/judge-match";
import { pingGemini } from "@/lib/ai/gateway";
import { recordAiTestResult, saveAiSettings } from "@/lib/ai/settings";
import type { AiSettingsErrors, AiSettingsInput } from "@/lib/ai/settings-validation";
import { logAdminAction } from "@/lib/auth/audit";
import { CACHE_TAGS, invalidateCacheTag } from "@/lib/cache-policy";
import { getAllCategories } from "@/lib/categories";
import { rankProducts } from "@/lib/listing-submission/product-match";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const AI_ADMIN_PATH = "/admin/ai";
const MATCH_CANDIDATE_POOL = 300;
const MATCH_CANDIDATE_LIMIT = 8;

export type AiActionResult = {
  ok: boolean;
  message: string;
  detail?: string;
  errors?: AiSettingsErrors;
};

const SKIP_MESSAGES: Record<string, string> = {
  disabled: "AI kapalı. Ayarlardan açın.",
  feature_off: "Bu özellik ayarlardan kapatılmış.",
  no_key: "API anahtarı tanımlı değil.",
  budget: "Günlük istek sınırına ulaşıldı.",
  unavailable: "Veritabanı bağlantısı yok.",
  paused: "AI art arda hata aldığı için 5 dakika duraklatıldı (Bağlantıyı test et ile açılır).",
};

export async function saveAiSettingsAction(input: AiSettingsInput): Promise<AiActionResult> {
  const admin = await requireAdminUser(AI_ADMIN_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

  const result = await saveAiSettings(supabase, input, admin.id);
  if (!result.ok) return { ok: false, message: result.message, errors: result.errors };

  invalidateCacheTag(CACHE_TAGS.aiSettings);
  // Only non-secret facts are recorded; the key never reaches the audit log.
  await logAdminAction(supabase, admin.id, {
    action: "AI_SETTINGS_UPDATED",
    metadata: {
      enabled: input.enabled,
      model: input.model.trim(),
      features: [input.featureSearch, input.featureClassification, input.featureMatching],
      dailyRequestLimit: input.dailyRequestLimit,
      credentialChanged: input.apiKey.trim() !== "",
    },
  });
  return {
    ok: true,
    message: input.enabled
      ? "Ayarlar kaydedildi ve AI açık."
      : "Ayarlar kaydedildi. AI kapalı; açmak için \"AI'ı etkinleştir\" seçeneğini işaretleyin.",
  };
}

/** Sends one tiny request with the saved key and model and records the outcome. */
export async function testGeminiAction(): Promise<AiActionResult> {
  const admin = await requireAdminUser(AI_ADMIN_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

  const result = await pingGemini();
  await recordAiTestResult(supabase, result.ok, result.ok ? null : result.error);
  await logAdminAction(supabase, admin.id, { action: "AI_CONNECTION_TESTED", metadata: { ok: result.ok } });

  return result.ok
    ? { ok: true, message: `Bağlantı başarılı. Model: ${result.model} (${result.latencyMs} ms).` }
    : { ok: false, message: "Gemini bağlantısı başarısız.", detail: result.error };
}

export type PlaygroundKind = "classify" | "search" | "match";

export type PlaygroundResult =
  | { ok: true; kind: "classify"; classification: ProductClassification; categoryLabel: string | null }
  | { ok: true; kind: "search"; interpretation: SearchInterpretation }
  | { ok: true; kind: "match"; judgement: MatchJudgement; matchedName: string | null; candidates: string[] }
  | { ok: false; message: string };

/** Lets an admin try each AI feature on free text and see exactly what comes back. */
export async function runPlaygroundAction(kind: PlaygroundKind, text: string): Promise<PlaygroundResult> {
  await requireAdminUser(AI_ADMIN_PATH);
  const input = text.trim();
  if (!input) return { ok: false, message: "Bir metin girin." };

  if (kind === "classify") {
    const choices = buildCategoryChoices(await getAllCategories());
    const outcome = await classifyProductWithAi(input, choices);
    if (outcome.status === "skipped") return { ok: false, message: SKIP_MESSAGES[outcome.reason] ?? "Çağrı atlandı." };
    if (outcome.status === "error") return { ok: false, message: outcome.error };

    const choice = choices.find((candidate) => candidate.slug === outcome.classification.categorySlug);
    return {
      ok: true,
      kind,
      classification: outcome.classification,
      categoryLabel: choice ? (choice.parentName ? `${choice.parentName} › ${choice.name}` : choice.name) : null,
    };
  }

  if (kind === "search") {
    const interpretation = await getSearchInterpretation(input);
    return interpretation
      ? { ok: true, kind, interpretation }
      : { ok: false, message: "Yorum alınamadı (AI kapalı, sınır dolu ya da çağrı başarısız). Ayrıntı için kayıtlara bakın." };
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };
  const { data, error } = await supabase.from("products").select("id, name, category").limit(MATCH_CANDIDATE_POOL);
  if (error) return { ok: false, message: "Ürünler okunamadı." };

  const candidates = rankProducts(
    input,
    (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      category: row.category ? String(row.category) : null,
    })),
    MATCH_CANDIDATE_LIMIT,
  );
  const outcome = await judgeProductMatch(
    input,
    candidates.map((candidate) => ({ id: candidate.id, name: candidate.name })),
  );
  if (outcome.status === "skipped") return { ok: false, message: SKIP_MESSAGES[outcome.reason] ?? "Çağrı atlandı." };
  if (outcome.status === "error") return { ok: false, message: outcome.error };

  return {
    ok: true,
    kind,
    judgement: outcome.judgement,
    matchedName: candidates.find((candidate) => candidate.id === outcome.judgement.matchedId)?.name ?? null,
    candidates: candidates.map((candidate) => candidate.name),
  };
}

export type ReviewActionResult =
  | { ok: true; suggestions: CategorySuggestion[]; unplaced: string[]; stoppedReason: string | null; reviewed: number }
  | { ok: false; message: string };

/** Asks the model about the next batch of products sitting in "Diğer". */
export async function reviewFallbackProductsAction(): Promise<ReviewActionResult> {
  await requireAdminUser(AI_ADMIN_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

  const categories = await getAllCategories();
  const products = await loadFallbackProducts(supabase, categories, REVIEW_BATCH_SIZE);
  if (products.length === 0) return { ok: false, message: "\"Diğer\" kategorisinde ürün yok." };

  const review = await suggestCategories(products, categories);
  return { ok: true, ...review, reviewed: products.length };
}

export async function applySuggestionAction(productId: number, categorySlug: string): Promise<AiActionResult> {
  const admin = await requireAdminUser(AI_ADMIN_PATH);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, message: "Supabase bağlantısı yapılandırılmamış." };

  const result = await applyCategory(supabase, await getAllCategories(), productId, categorySlug);
  if (!result.ok) return { ok: false, message: result.message };

  await logAdminAction(supabase, admin.id, {
    action: "AI_CATEGORY_APPLIED",
    metadata: { productId, categorySlug },
  });
  // Counts and menus are cached; expire them so the move shows up everywhere.
  invalidateCacheTag(CACHE_TAGS.categories);
  revalidatePath("/", "layout");
  return { ok: true, message: `Kategori güncellendi: ${result.categoryLabel}.` };
}
