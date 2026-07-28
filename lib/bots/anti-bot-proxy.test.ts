import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const { mockSafeFetchHtml, mockIsAvailable, mockRecordSuccess, mockRecordFailure } = vi.hoisted(() => {
  const mockSafeFetchHtml = vi.fn();
  const mockIsAvailable = vi.fn().mockReturnValue(true);
  const mockRecordSuccess = vi.fn();
  const mockRecordFailure = vi.fn();
  return { mockSafeFetchHtml, mockIsAvailable, mockRecordSuccess, mockRecordFailure };
});

vi.mock("@/lib/bots/html-utils", () => ({
  safeFetchHtml: mockSafeFetchHtml,
}));

vi.mock("@/lib/recovery/circuit-breaker", () => ({
  CircuitBreakerRegistry: {
    getInstance: () => ({
      isAvailable: mockIsAvailable,
      recordSuccess: mockRecordSuccess,
      recordFailure: mockRecordFailure,
    }),
  },
}));

import { fetchViaAntiBotProxy } from "./anti-bot-proxy";

const ORIGINAL_ENV = process.env;

describe("fetchViaAntiBotProxy", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SCRAPINGFISH_API_KEY;
    mockSafeFetchHtml.mockReset();
    mockIsAvailable.mockReturnValue(true);
    mockRecordSuccess.mockReset();
    mockRecordFailure.mockReset();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("throws when SCRAPINGFISH_API_KEY is missing", async () => {
    await expect(
      fetchViaAntiBotProxy("https://example.com"),
    ).rejects.toThrow("SCRAPINGFISH_API_KEY");
  });

  it("falls back to safeFetchHtml on non-ok response from ScrapingFish", async () => {
    process.env.SCRAPINGFISH_API_KEY = "test-key-123";
    mockSafeFetchHtml.mockResolvedValue({
      html: "fallback content",
      finalUrl: "https://example.com",
      status: 200,
    });

    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("rate limited", {
        status: 429,
        statusText: "Too Many Requests",
      }),
    );

    const result = await fetchViaAntiBotProxy("https://example.com");

    expect(result.html).toBe("fallback content");
    expect(result.status).toBe(200);
    expect(mockSafeFetchHtml).toHaveBeenCalledTimes(1);
    expect(mockRecordFailure).toHaveBeenCalledWith("scrapingfish");

    mockFetch.mockRestore();
  });

  it("re-throws 401/403 from ScrapingFish (no fallback)", async () => {
    process.env.SCRAPINGFISH_API_KEY = "test-key-123";

    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("unauthorized", {
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    await expect(
      fetchViaAntiBotProxy("https://example.com"),
    ).rejects.toThrow("ScrapingFish API HTTP 401");

    expect(mockSafeFetchHtml).not.toHaveBeenCalled();

    mockFetch.mockRestore();
  });

  it("falls back on Cloudflare challenge page from ScrapingFish", async () => {
    process.env.SCRAPINGFISH_API_KEY = "test-key-123";
    mockSafeFetchHtml.mockResolvedValue({
      html: "direct content",
      finalUrl: "https://www.sahibinden.com/cep-telefonu",
      status: 200,
    });

    const cloudflareHtml = `<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>
      <script nonce="abc">window._cf_chl_opt = {cRay: "abc123"};</script>
      <noscript><span id="challenge-error-text">Enable JavaScript and cookies to continue</span></noscript>
    </body></html>`;

    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(cloudflareHtml, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await fetchViaAntiBotProxy(
      "https://www.sahibinden.com/cep-telefonu",
    );

    expect(result.html).toBe("direct content");
    expect(mockSafeFetchHtml).toHaveBeenCalledTimes(1);
    expect(mockRecordFailure).toHaveBeenCalledWith("scrapingfish");

    mockFetch.mockRestore();
  });

  it("returns HTML when ScrapingFish succeeds", async () => {
    process.env.SCRAPINGFISH_API_KEY = "test-key-123";
    mockSafeFetchHtml.mockResolvedValue({
      html: "unused",
      finalUrl: "unused",
      status: 200,
    });

    const realHtml = `<!DOCTYPE html><html><head><title>Cep Telefonu</title></head><body>
      <div>Real content</div>
    </body></html>`;

    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(realHtml, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await fetchViaAntiBotProxy(
      "https://www.sahibinden.com/cep-telefonu",
    );

    expect(result.html).toBe(realHtml);
    expect(result.finalUrl).toBe("https://www.sahibinden.com/cep-telefonu");
    expect(result.status).toBe(200);
    expect(mockSafeFetchHtml).not.toHaveBeenCalled();
    expect(mockRecordSuccess).toHaveBeenCalledWith("scrapingfish");

    mockFetch.mockRestore();
  });

  it("falls back on ScrapingFish timeout", async () => {
    process.env.SCRAPINGFISH_API_KEY = "test-key-123";
    mockSafeFetchHtml.mockResolvedValue({
      html: "timeout fallback",
      finalUrl: "https://www.sahibinden.com/cep-telefonu",
      status: 200,
    });

    const mockFetch = vi.spyOn(globalThis, "fetch").mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        }),
    );

    const result = await fetchViaAntiBotProxy(
      "https://www.sahibinden.com/cep-telefonu",
      { timeoutMs: 100 },
    );

    expect(result.html).toBe("timeout fallback");
    expect(mockSafeFetchHtml).toHaveBeenCalledTimes(1);
    expect(mockRecordFailure).toHaveBeenCalledWith("scrapingfish");

    mockFetch.mockRestore();
  });

  it("skips ScrapingFish entirely when circuit is open and goes direct to safeFetchHtml", async () => {
    process.env.SCRAPINGFISH_API_KEY = "test-key-123";
    mockIsAvailable.mockReturnValue(false);
    mockSafeFetchHtml.mockResolvedValue({
      html: "circuit open fallback",
      finalUrl: "https://example.com",
      status: 200,
    });

    const mockFetch = vi.spyOn(globalThis, "fetch");

    const result = await fetchViaAntiBotProxy("https://example.com");

    expect(result.html).toBe("circuit open fallback");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockSafeFetchHtml).toHaveBeenCalledTimes(1);

    mockFetch.mockRestore();
  });

  it("uses provided apiKey over env var", async () => {
    process.env.SCRAPINGFISH_API_KEY = "wrong-key";
    mockSafeFetchHtml.mockResolvedValue({
      html: "unused",
      finalUrl: "unused",
      status: 200,
    });

    const mockFetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async (input: RequestInfo | URL) => {
        const url = input.toString();
        expect(url).toContain("correct-key");
        return new Response("<html><body>OK</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      });

    const result = await fetchViaAntiBotProxy("https://example.com", {
      apiKey: "correct-key",
    });
    expect(result.html).toContain("OK");

    mockFetch.mockRestore();
  });
});
