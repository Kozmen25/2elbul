// Second opinion on "which existing product is this listing?". Suggestion
// only: nothing here writes data. The model may only name one of the
// candidates it was given.

import { clipInput, runAiTask, type AiTaskResult } from "@/lib/ai/gateway";

export type MatchCandidate = { id: string; name: string };

export type MatchJudgement = {
  /** Id of the chosen candidate, or null when none fits. */
  matchedId: string | null;
  confidence: number;
  reason: string;
};

export type JudgeOutcome =
  | { status: "ok"; judgement: MatchJudgement }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

const MAX_REASON_CHARS = 240;

const SYSTEM_INSTRUCTION = [
  "Sen ikinci el ilanlarını ürün kataloğuyla eşleştiren bir asistansın.",
  "Bir ilan başlığı ve numaralı aday ürünler verilir. Yalnızca JSON döndür.",
  "Aynı ürün demek: aynı marka, aynı model ve aynı varyant (depolama, boyut, nesil). Farklı varyant eşleşme değildir.",
  "Kılıf/şarj aleti gibi aksesuarlar asıl ürünle eşleşmez.",
  "Hiçbir aday uymuyorsa matchedId için null yaz. Aday listesinde olmayan bir id uydurma.",
  "reason: tek kısa Türkçe cümle.",
].join("\n");

const SCHEMA = {
  type: "OBJECT",
  properties: {
    matchedId: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
    reason: { type: "STRING" },
  },
  required: ["matchedId", "confidence", "reason"],
};

export function parseJudgement(json: unknown, candidates: MatchCandidate[]): MatchJudgement | null {
  if (!json || typeof json !== "object") return null;
  const raw = json as Record<string, unknown>;

  const id = typeof raw.matchedId === "string" ? raw.matchedId.trim() : null;
  const matchedId = id && candidates.some((candidate) => candidate.id === id) ? id : null;
  const confidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
    ? Math.min(1, Math.max(0, raw.confidence))
    : 0;
  const reason = typeof raw.reason === "string" ? raw.reason.trim().slice(0, MAX_REASON_CHARS) : "";

  return { matchedId, confidence, reason };
}

export async function judgeProductMatch(
  title: string,
  candidates: MatchCandidate[],
  run: (input: Parameters<typeof runAiTask>[0]) => Promise<AiTaskResult> = runAiTask,
): Promise<JudgeOutcome> {
  if (candidates.length === 0) {
    return { status: "ok", judgement: { matchedId: null, confidence: 1, reason: "Karşılaştırılacak aday ürün yok." } };
  }

  const list = candidates.map((candidate) => `${candidate.id}: ${candidate.name}`).join("\n");
  const result = await run({
    feature: "matching",
    systemInstruction: SYSTEM_INSTRUCTION,
    userText: `Aday ürünler:\n${list}\n\nİlan başlığı: ${clipInput(title)}`,
    responseSchema: SCHEMA,
  });

  if (result.status === "skipped") return { status: "skipped", reason: result.reason };
  if (result.status === "error") return { status: "error", error: result.error };

  const judgement = parseJudgement(result.json, candidates);
  return judgement ? { status: "ok", judgement } : { status: "error", error: "Yanıt beklenen biçimde değildi." };
}
