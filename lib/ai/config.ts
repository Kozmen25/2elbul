// Constants of the Gemini integration. Defaults favour the cheapest tier: the
// tasks here (short titles and queries in, small JSON out) do not need a
// larger model.

export type AiFeature = "search" | "classification" | "matching";

/** Features plus "test", which only exists for the admin panel's own checks. */
export type AiLogFeature = AiFeature | "test";

export const AI_FEATURES: readonly { id: AiFeature; label: string; description: string }[] = [
  {
    id: "search",
    label: "Akıllı arama",
    description: "Doğal cümleli aramaları (\"10 bin altı oyun laptopu\") fiyat, sıralama ve ek anahtar kelimelere çevirir.",
  },
  {
    id: "classification",
    label: "Ürün tanıma ve kategori",
    description: "İlan başlığından marka, model, ürün türü ve en uygun kategoriyi belirler (\"Diğer\" ürünleri için).",
  },
  {
    id: "matching",
    label: "Ürün eşleştirme",
    description: "Bir ilanın mevcut ürünlerden hangisine ait olduğuna dair ikinci görüş verir (yalnızca öneri).",
  },
];

export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export const MODEL_OPTIONS: readonly { id: string; label: string }[] = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite — en ekonomik (önerilen)" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite — ekonomik" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash — daha güçlü, daha pahalı" },
];

export const AI_LIMITS = {
  minConfidence: { min: 0.3, max: 0.99, default: 0.7 },
  dailyRequests: { min: 0, max: 100_000, default: 500 },
  timeoutMs: { min: 1_000, max: 30_000, default: 8_000 },
} as const;

/** Output budget per call; answers are small JSON objects. */
export const MAX_OUTPUT_TOKENS = {
  search: 400,
  classification: 400,
  matching: 300,
  test: 16,
} as const satisfies Record<AiLogFeature, number>;

/** Longest text (query or title) sent to the model, and kept in the log preview. */
export const MAX_INPUT_CHARS = 300;
export const LOG_PREVIEW_CHARS = 120;

/** How long an interpreted search query may be reused instead of asking again. */
export const SEARCH_INTERPRETATION_CACHE_SECONDS = 24 * 60 * 60;

/** Queries shorter than this many words are plain keywords; the existing search handles them. */
export const MIN_WORDS_FOR_AI_SEARCH = 3;

export const GEMINI_KEY_ENV = "GEMINI_API_KEY";

export const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
