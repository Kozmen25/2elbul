// Product recognition + category assignment from a listing title.
// The model may only choose from the category slugs we pass in; anything else
// is discarded, so the taxonomy in public.categories stays the single truth.

import { clipInput, runAiTask, type AiTaskResult } from "@/lib/ai/gateway";

export type CategoryChoice = {
  slug: string;
  name: string;
  /** Name of the parent category, for subcategories. */
  parentName: string | null;
};

export const PRODUCT_KINDS = ["primary_product", "accessory", "spare_part", "service"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export type ProductClassification = {
  categorySlug: string | null;
  brand: string | null;
  model: string | null;
  kind: ProductKind;
  canonicalName: string | null;
  confidence: number;
};

export type ClassifyOutcome =
  | { status: "ok"; classification: ProductClassification }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

const SYSTEM_INSTRUCTION = [
  "Sen Türkiye ikinci el pazarı için ürün tanıma ve sınıflandırma asistanısın.",
  "Kullanıcı bir ilan başlığı verir. Yalnızca JSON döndür.",
  "categorySlug alanı SADECE verilen kategori listesindeki bir slug olabilir; uygun kategori yoksa null yaz.",
  "Mümkün olan en özel (alt) kategoriyi seç.",
  "kind: primary_product (asıl ürün), accessory (kılıf, şarj aleti, kablo vb.), spare_part (yedek parça), service (hizmet).",
  "canonicalName: marka + model + varsa depolama/kapasite, kısa ve standart yazım (ör. \"Apple iPhone 13 128 GB\").",
  "Başlıkta olmayan bilgiyi uydurma. Emin değilsen confidence değerini düşük ver (0-1).",
].join("\n");

const SCHEMA = {
  type: "OBJECT",
  properties: {
    categorySlug: { type: "STRING", nullable: true },
    brand: { type: "STRING", nullable: true },
    model: { type: "STRING", nullable: true },
    kind: { type: "STRING", enum: [...PRODUCT_KINDS] },
    canonicalName: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
  },
  required: ["categorySlug", "brand", "model", "kind", "canonicalName", "confidence"],
};

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Validates the model's answer against what we allow; never trusts it blindly. */
export function parseClassification(json: unknown, categories: CategoryChoice[]): ProductClassification | null {
  if (!json || typeof json !== "object") return null;
  const raw = json as Record<string, unknown>;

  const confidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
    ? Math.min(1, Math.max(0, raw.confidence))
    : 0;
  const kind = PRODUCT_KINDS.find((candidate) => candidate === raw.kind);
  if (!kind) return null;

  const slug = textOrNull(raw.categorySlug);
  const categorySlug = slug && categories.some((category) => category.slug === slug) ? slug : null;

  return {
    categorySlug,
    brand: textOrNull(raw.brand),
    model: textOrNull(raw.model),
    kind,
    canonicalName: textOrNull(raw.canonicalName),
    confidence,
  };
}

function describeCategories(categories: CategoryChoice[]): string {
  return categories
    .map((category) => `${category.slug} = ${category.parentName ? `${category.parentName} > ` : ""}${category.name}`)
    .join("\n");
}

export async function classifyProductWithAi(
  title: string,
  categories: CategoryChoice[],
  run: (input: Parameters<typeof runAiTask>[0]) => Promise<AiTaskResult> = runAiTask,
): Promise<ClassifyOutcome> {
  const result = await run({
    feature: "classification",
    systemInstruction: SYSTEM_INSTRUCTION,
    userText: `Kategoriler:\n${describeCategories(categories)}\n\nİlan başlığı: ${clipInput(title)}`,
    responseSchema: SCHEMA,
  });

  if (result.status === "skipped") return { status: "skipped", reason: result.reason };
  if (result.status === "error") return { status: "error", error: result.error };

  const classification = parseClassification(result.json, categories);
  return classification
    ? { status: "ok", classification }
    : { status: "error", error: "Yanıt beklenen biçimde değildi." };
}
