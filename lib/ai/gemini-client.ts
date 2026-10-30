// Minimal Gemini REST client (generateContent with a JSON response schema).
// No SDK: one fetch call keeps the bundle small and the behaviour explicit.
// The API key is sent in a header and never logged or echoed in errors.

import { GEMINI_API_BASE } from "@/lib/ai/config";

export type GeminiSchema = Record<string, unknown>;

export type GeminiRequest = {
  apiKey: string;
  model: string;
  systemInstruction: string;
  userText: string;
  /** JSON schema of the answer; omit for plain text (connection test). */
  responseSchema?: GeminiSchema;
  maxOutputTokens: number;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export type GeminiUsage = { promptTokens: number | null; outputTokens: number | null };

export type GeminiSuccess = { ok: true; text: string; json: unknown; usage: GeminiUsage; latencyMs: number };
export type GeminiFailure = { ok: false; error: string; status: number | null; latencyMs: number };
export type GeminiResult = GeminiSuccess | GeminiFailure;

type GeminiResponseBody = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { code?: number; message?: string; status?: string };
};

const HTTP_MESSAGES: Record<number, string> = {
  400: "İstek reddedildi (API anahtarı geçersiz olabilir).",
  401: "API anahtarı geçersiz.",
  403: "Erişim reddedildi. Google projesinde bu modele izin yok ya da proje kısıtlı.",
  404: "Model bulunamadı ya da yeni kullanıcılara kapalı. Panelden başka bir model seçin.",
  429: "İstek kotası doldu. Biraz sonra tekrar deneyin.",
  500: "Google tarafında geçici bir hata oluştu.",
  503: "Google servisi şu an yoğun.",
};

/** Turkish explanation plus Google's own message, which names the real cause. */
export function describeHttpFailure(status: number, googleMessage: string | undefined): string {
  const base = HTTP_MESSAGES[status] ?? `Beklenmeyen yanıt (HTTP ${status}).`;
  return googleMessage ? `${base} Google: ${googleMessage}` : base;
}

/** Model answers sometimes arrive wrapped in a markdown code fence. */
export function parseJsonAnswer(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

export async function callGemini(request: GeminiRequest): Promise<GeminiResult> {
  const startedAt = Date.now();
  const fetchImpl = request.fetchImpl ?? fetch;
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(request.model)}:generateContent`;

  const generationConfig: Record<string, unknown> = {
    temperature: 0,
    maxOutputTokens: request.maxOutputTokens,
  };
  if (request.responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = request.responseSchema;
  }

  const failure = (error: string, status: number | null): GeminiFailure => ({
    ok: false,
    error,
    status,
    latencyMs: Date.now() - startedAt,
  });

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": request.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: request.userText }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(request.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return failure(timedOut ? "Yanıt zaman aşımına uğradı." : "Google servisine bağlanılamadı.", null);
  }

  let body: GeminiResponseBody | null = null;
  try {
    body = (await response.json()) as GeminiResponseBody;
  } catch {
    body = null;
  }

  if (!response.ok) {
    return failure(describeHttpFailure(response.status, body?.error?.message), response.status);
  }

  const text = (body?.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
  if (!text) {
    const reason = body?.candidates?.[0]?.finishReason;
    return failure(reason ? `Boş yanıt döndü (${reason}).` : "Boş yanıt döndü.", response.status);
  }

  const usage: GeminiUsage = {
    promptTokens: body?.usageMetadata?.promptTokenCount ?? null,
    outputTokens: body?.usageMetadata?.candidatesTokenCount ?? null,
  };

  if (!request.responseSchema) {
    return { ok: true, text, json: null, usage, latencyMs: Date.now() - startedAt };
  }
  try {
    return { ok: true, text, json: parseJsonAnswer(text), usage, latencyMs: Date.now() - startedAt };
  } catch {
    return failure("Yanıt geçerli JSON değildi.", response.status);
  }
}
