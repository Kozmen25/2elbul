import { describe, expect, it } from "vitest";
import { validateAiSettingsInput, type AiSettingsInput } from "./settings-validation";

const valid: AiSettingsInput = {
  enabled: false,
  apiKey: "",
  keyLabel: "2elbulkey",
  projectName: "projects/828979570202",
  projectNumber: "828979570202",
  model: "gemini-3.5-flash-lite",
  featureSearch: true,
  featureClassification: true,
  featureMatching: true,
  minConfidence: 0.7,
  dailyRequestLimit: 500,
  timeoutMs: 8000,
};

describe("validateAiSettingsInput", () => {
  it("accepts a complete form and keeps the stored key when the field is empty", () => {
    const result = validateAiSettingsInput(valid, { hasStoredKey: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.apiKey).toBeNull();
  });

  it("requires a key before AI can be switched on", () => {
    const result = validateAiSettingsInput({ ...valid, enabled: true }, { hasStoredKey: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.apiKey).toBeDefined();
    expect(validateAiSettingsInput({ ...valid, enabled: true }, { hasStoredKey: true }).ok).toBe(true);
  });

  it("rejects a key with whitespace or too short", () => {
    expect(validateAiSettingsInput({ ...valid, apiKey: "abc def" }, { hasStoredKey: false }).ok).toBe(false);
    expect(validateAiSettingsInput({ ...valid, apiKey: "short" }, { hasStoredKey: false }).ok).toBe(false);
    const ok = validateAiSettingsInput({ ...valid, apiKey: "  AQ.Ab8RN6K9fiFJ5-cbguMpBU2BStsKPG6e  " }, { hasStoredKey: false });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.apiKey).toBe("AQ.Ab8RN6K9fiFJ5-cbguMpBU2BStsKPG6e");
  });

  it("validates numeric limits and the project number", () => {
    const result = validateAiSettingsInput(
      { ...valid, minConfidence: 0.1, dailyRequestLimit: -1, timeoutMs: 10, projectNumber: "abc" },
      { hasStoredKey: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["dailyRequestLimit", "minConfidence", "projectNumber", "timeoutMs"]);
    }
  });

  it("falls back to the default model when empty and rejects malformed names", () => {
    const empty = validateAiSettingsInput({ ...valid, model: "  " }, { hasStoredKey: true });
    expect(empty.ok && empty.value.model).toBe("gemini-3.5-flash-lite");
    expect(validateAiSettingsInput({ ...valid, model: "bad model!" }, { hasStoredKey: true }).ok).toBe(false);
  });
});
