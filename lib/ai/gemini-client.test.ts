import { describe, expect, it, vi } from "vitest";
import { callGemini, describeHttpFailure, parseJsonAnswer } from "./gemini-client";

const base = {
  apiKey: "test-key-abcdefghijklmnop",
  model: "gemini-3.5-flash-lite",
  systemInstruction: "sys",
  userText: "hello",
  maxOutputTokens: 50,
  timeoutMs: 1000,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("callGemini", () => {
  it("sends the key in a header, never in the URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: "tamam" }] } }] }),
    );
    await callGemini({ ...base, fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/models/gemini-3.5-flash-lite:generateContent");
    expect(String(url)).not.toContain(base.apiKey);
    expect((init as RequestInit).headers).toMatchObject({ "x-goog-api-key": base.apiKey });
  });

  it("parses a structured answer and token usage", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 4 },
      }),
    );
    const result = await callGemini({ ...base, responseSchema: { type: "OBJECT" }, fetchImpl });

    expect(result).toMatchObject({ ok: true, json: { a: 1 }, usage: { promptTokens: 12, outputTokens: 4 } });
    const body = JSON.parse(String((fetchImpl.mock.calls[0][1] as RequestInit).body));
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", temperature: 0 });
  });

  it("explains an access denial with Google's own message and no key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: 403, message: "Your project has been denied access." } }, 403),
    );
    const result = await callGemini({ ...base, fetchImpl });

    expect(result).toMatchObject({ ok: false, status: 403 });
    if (!result.ok) {
      expect(result.error).toContain("Erişim reddedildi");
      expect(result.error).toContain("denied access");
      expect(result.error).not.toContain(base.apiKey);
    }
  });

  it("reports an invalid JSON answer and an empty answer", async () => {
    const invalid = await callGemini({
      ...base,
      responseSchema: {},
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text: "not json" }] } }] })),
    });
    expect(invalid).toMatchObject({ ok: false, error: "Yanıt geçerli JSON değildi." });

    const empty = await callGemini({
      ...base,
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ candidates: [{ finishReason: "SAFETY" }] })),
    });
    expect(empty).toMatchObject({ ok: false });
  });

  it("maps network failures and timeouts to a message", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    expect(await callGemini({ ...base, fetchImpl: vi.fn().mockRejectedValue(timeout) })).toMatchObject({
      ok: false,
      error: "Yanıt zaman aşımına uğradı.",
    });
    expect(await callGemini({ ...base, fetchImpl: vi.fn().mockRejectedValue(new Error("x")) })).toMatchObject({
      ok: false,
      error: "Google servisine bağlanılamadı.",
    });
  });
});

describe("helpers", () => {
  it("strips markdown fences from JSON answers", () => {
    expect(parseJsonAnswer('```json\n{"x":2}\n```')).toEqual({ x: 2 });
  });

  it("falls back to a generic message for unknown statuses", () => {
    expect(describeHttpFailure(418, undefined)).toContain("418");
  });
});
