import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAiRuntimeSettings: vi.fn(),
  resolveApiKey: vi.fn(),
  countRecentCalls: vi.fn(),
  recordAiCall: vi.fn(),
  callGemini: vi.fn(),
  admin: {} as object | null,
}));

vi.mock("@/lib/ai/settings", () => ({
  getAiRuntimeSettings: mocks.getAiRuntimeSettings,
  resolveApiKey: mocks.resolveApiKey,
}));
vi.mock("@/lib/ai/usage", () => ({
  countRecentCalls: mocks.countRecentCalls,
  recordAiCall: mocks.recordAiCall,
}));
vi.mock("@/lib/ai/gemini-client", () => ({ callGemini: mocks.callGemini }));
vi.mock("@/lib/supabase-admin", () => ({ createSupabaseAdminClient: () => mocks.admin }));

import { clipInput, pingGemini, resetAiCircuitBreaker, runAiTask } from "./gateway";

const runtime = {
  enabled: true,
  model: "gemini-3.5-flash-lite",
  features: { search: true, classification: true, matching: false },
  minConfidence: 0.7,
  dailyRequestLimit: 10,
  timeoutMs: 5000,
  hasKey: true,
};

const task = { feature: "search" as const, systemInstruction: "s", userText: "  10 bin   altı telefon ", responseSchema: {} };

beforeEach(() => {
  vi.clearAllMocks();
  resetAiCircuitBreaker();
  mocks.admin = {};
  mocks.getAiRuntimeSettings.mockResolvedValue(runtime);
  mocks.resolveApiKey.mockResolvedValue({ ok: true, key: "secret-key-value", source: "panel" });
  mocks.countRecentCalls.mockResolvedValue(0);
  mocks.callGemini.mockResolvedValue({ ok: true, text: "{}", json: { a: 1 }, usage: { promptTokens: 5, outputTokens: 2 }, latencyMs: 40 });
});

describe("runAiTask", () => {
  it("skips without calling the model when AI or the feature is off", async () => {
    mocks.getAiRuntimeSettings.mockResolvedValue({ ...runtime, enabled: false });
    expect(await runAiTask(task)).toEqual({ status: "skipped", reason: "disabled" });

    mocks.getAiRuntimeSettings.mockResolvedValue(runtime);
    expect(await runAiTask({ ...task, feature: "matching" })).toEqual({ status: "skipped", reason: "feature_off" });
    expect(mocks.callGemini).not.toHaveBeenCalled();
  });

  it("skips when no key is configured or the budget is used up", async () => {
    mocks.getAiRuntimeSettings.mockResolvedValue({ ...runtime, hasKey: false });
    expect(await runAiTask(task)).toEqual({ status: "skipped", reason: "no_key" });

    mocks.getAiRuntimeSettings.mockResolvedValue(runtime);
    mocks.countRecentCalls.mockResolvedValue(10);
    expect(await runAiTask(task)).toEqual({ status: "skipped", reason: "budget" });
    expect(mocks.callGemini).not.toHaveBeenCalled();
  });

  it("treats an unreadable usage count as budget exhausted", async () => {
    mocks.countRecentCalls.mockResolvedValue(Number.POSITIVE_INFINITY);
    expect(await runAiTask(task)).toEqual({ status: "skipped", reason: "budget" });
  });

  it("calls the model with the clipped input and logs a successful call", async () => {
    const result = await runAiTask(task);

    expect(result).toMatchObject({ status: "ok", json: { a: 1 }, model: "gemini-3.5-flash-lite" });
    expect(mocks.callGemini).toHaveBeenCalledWith(
      expect.objectContaining({ userText: "10 bin altı telefon", timeoutMs: 5000, apiKey: "secret-key-value" }),
    );
    expect(mocks.recordAiCall).toHaveBeenCalledWith(
      mocks.admin,
      expect.objectContaining({ feature: "search", ok: true, promptTokens: 5, outputTokens: 2, input: "10 bin altı telefon" }),
    );
  });

  it("returns and logs a failure without exposing the key", async () => {
    mocks.callGemini.mockResolvedValue({ ok: false, error: "Erişim reddedildi.", status: 403, latencyMs: 12 });
    const result = await runAiTask(task);

    expect(result).toEqual({ status: "error", error: "Erişim reddedildi." });
    const logged = JSON.stringify(mocks.recordAiCall.mock.calls);
    expect(logged).not.toContain("secret-key-value");
    expect(mocks.recordAiCall).toHaveBeenCalledWith(mocks.admin, expect.objectContaining({ ok: false, error: "Erişim reddedildi." }));
  });

  it("reports a key that cannot be decrypted as an error, not a skip", async () => {
    mocks.resolveApiKey.mockResolvedValue({ ok: false, reason: "decrypt_failed", message: "çözülemedi" });
    expect(await runAiTask(task)).toEqual({ status: "error", error: "çözülemedi" });
  });
});

describe("circuit breaker", () => {
  it("pauses after a permanent refusal and a successful test lifts the pause", async () => {
    mocks.callGemini.mockResolvedValue({ ok: false, error: "Erişim reddedildi.", status: 403, latencyMs: 5 });
    expect(await runAiTask(task)).toMatchObject({ status: "error" });

    mocks.callGemini.mockClear();
    expect(await runAiTask(task)).toEqual({ status: "skipped", reason: "paused" });
    expect(mocks.callGemini).not.toHaveBeenCalled();

    mocks.callGemini.mockResolvedValue({ ok: true, text: "tamam", json: null, usage: { promptTokens: 1, outputTokens: 1 }, latencyMs: 5 });
    await pingGemini();
    expect(await runAiTask(task)).toMatchObject({ status: "ok" });
  });

  it("does not pause for transient failures", async () => {
    mocks.callGemini.mockResolvedValue({ ok: false, error: "Yanıt zaman aşımına uğradı.", status: null, latencyMs: 5 });
    await runAiTask(task);
    mocks.callGemini.mockResolvedValue({ ok: true, text: "{}", json: {}, usage: { promptTokens: 1, outputTokens: 1 }, latencyMs: 5 });
    expect(await runAiTask(task)).toMatchObject({ status: "ok" });
  });
});

describe("pingGemini", () => {
  it("ignores the switches and budget but still logs the test", async () => {
    mocks.getAiRuntimeSettings.mockResolvedValue({ ...runtime, enabled: false });
    mocks.countRecentCalls.mockResolvedValue(999);

    expect(await pingGemini()).toMatchObject({ ok: true, model: "gemini-3.5-flash-lite" });
    expect(mocks.recordAiCall).toHaveBeenCalledWith(mocks.admin, expect.objectContaining({ feature: "test" }));
  });
});

describe("clipInput", () => {
  it("collapses whitespace and limits the length", () => {
    expect(clipInput(" a   b ")).toBe("a b");
    expect(clipInput("x".repeat(1000))).toHaveLength(300);
  });
});
