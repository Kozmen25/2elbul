import { AI_LIMITS, DEFAULT_MODEL } from "@/lib/ai/config";

export type AiSettingsInput = {
  enabled: boolean;
  /** Empty string keeps the stored key; a value replaces it. */
  apiKey: string;
  keyLabel: string;
  projectName: string;
  projectNumber: string;
  model: string;
  featureSearch: boolean;
  featureClassification: boolean;
  featureMatching: boolean;
  minConfidence: number;
  dailyRequestLimit: number;
  timeoutMs: number;
};

export type ValidAiSettings = Omit<AiSettingsInput, "apiKey"> & {
  /** null = keep the stored key. */
  apiKey: string | null;
};

export type AiSettingsErrors = Partial<Record<keyof AiSettingsInput, string>>;

export type AiSettingsValidation =
  | { ok: true; value: ValidAiSettings }
  | { ok: false; errors: AiSettingsErrors };

const MODEL_PATTERN = /^[a-z0-9][a-z0-9._-]{1,80}$/i;
const PROJECT_NUMBER_PATTERN = /^\d{4,20}$/;
/** Google API keys are one token of URL-safe characters; whitespace means a bad paste. */
const API_KEY_PATTERN = /^[A-Za-z0-9._-]{20,300}$/;
const TEXT_FIELD_MAX = 120;

function inRange(value: number, limits: { min: number; max: number }) {
  return Number.isFinite(value) && value >= limits.min && value <= limits.max;
}

export function validateAiSettingsInput(
  input: AiSettingsInput,
  context: { hasStoredKey: boolean },
): AiSettingsValidation {
  const errors: AiSettingsErrors = {};

  const apiKey = input.apiKey.trim();
  if (apiKey && !API_KEY_PATTERN.test(apiKey)) {
    errors.apiKey = "Anahtar boşluk içermemeli; Google'dan kopyaladığınız değeri olduğu gibi yapıştırın.";
  }

  const model = input.model.trim() || DEFAULT_MODEL;
  if (!MODEL_PATTERN.test(model)) errors.model = "Geçerli bir model adı girin (ör. gemini-3.5-flash-lite).";

  const projectNumber = input.projectNumber.trim();
  if (projectNumber && !PROJECT_NUMBER_PATTERN.test(projectNumber)) {
    errors.projectNumber = "Proje numarası yalnızca rakamlardan oluşur.";
  }

  for (const field of ["keyLabel", "projectName"] as const) {
    if (input[field].trim().length > TEXT_FIELD_MAX) errors[field] = `En fazla ${TEXT_FIELD_MAX} karakter.`;
  }

  if (!inRange(input.minConfidence, AI_LIMITS.minConfidence)) {
    errors.minConfidence = `${AI_LIMITS.minConfidence.min} ile ${AI_LIMITS.minConfidence.max} arasında olmalı.`;
  }
  if (!Number.isInteger(input.dailyRequestLimit) || !inRange(input.dailyRequestLimit, AI_LIMITS.dailyRequests)) {
    errors.dailyRequestLimit = `${AI_LIMITS.dailyRequests.min} ile ${AI_LIMITS.dailyRequests.max} arasında tam sayı olmalı.`;
  }
  if (!Number.isInteger(input.timeoutMs) || !inRange(input.timeoutMs, AI_LIMITS.timeoutMs)) {
    errors.timeoutMs = `${AI_LIMITS.timeoutMs.min} ile ${AI_LIMITS.timeoutMs.max} ms arasında olmalı.`;
  }

  if (input.enabled && !apiKey && !context.hasStoredKey) {
    errors.apiKey = "AI'ı açmak için bir API anahtarı girin (ya da GEMINI_API_KEY ortam değişkenini tanımlayın).";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      ...input,
      apiKey: apiKey || null,
      keyLabel: input.keyLabel.trim(),
      projectName: input.projectName.trim(),
      projectNumber,
      model,
    },
  };
}
