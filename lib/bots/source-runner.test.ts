import { vi, describe, it, expect, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

// --- Recovery mocks (used inside catch block and success block) ---
vi.mock("@/lib/recovery", () => ({
  RecoveryMetricsService: vi.fn(function () {
    return { record: vi.fn() };
  }),
}));

// --- Listing-sync mocks ---
vi.mock("@/lib/bots/listing-sync", () => ({
  normalizeSyncStatus: vi.fn().mockReturnValue("published"),
  syncListingsForSource: vi.fn().mockResolvedValue({
    imported: 1,
    updated: 0,
    inactive: 0,
    reactivated: 0,
    skipped: 0,
    errorCount: 0,
    errors: [],
    matchedProducts: 0,
    duplicateSummary: null,
  }),
}));

// --- Connectors mock ---
import type { StandardAdapterResult } from "@/lib/bots/adapters/types";

const FAKE_ADAPTER_RESULT: StandardAdapterResult = {
  listings: [
    {
      external_id: "ext-1",
      title: "Test Product",
      price: 100,
      currency: "TRY",
      url: "https://example.com/p1",
      image_url: null,
      source_id: 1,
      source_name: "test",
      location: "İstanbul",
      condition: "Yenilenmiş",
      listed_at: null,
      raw_payload: { product_name: "Test" },
    },
  ],
  found: 1,
  imported: 0,
  updated: 0,
  skipped: 0,
  matched_product_count: 0,
  errors: [],
  duration_ms: 1500,
};

const mockSync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/bots/connectors", () => ({
  SCRAPE_READY_SLUGS: ["test-source"],
  getStandardSourceAdapter: vi.fn().mockReturnValue({ sync: mockSync }),
}));

// --- isRecord mock needed by isMissingColumn ---
vi.mock("@/lib/records", () => ({
  isRecord: vi.fn(
    (val: unknown): val is Record<string, unknown> =>
      val !== null && typeof val === "object",
  ),
}));

import { runSourceScrapeBot } from "./source-runner";
import { syncListingsForSource } from "@/lib/bots/listing-sync";
import type { SourceRunRecord } from "./source-runner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSupabaseMock(): {
  supabase: { from: ReturnType<typeof vi.fn> };
  mockSingle: ReturnType<typeof vi.fn>;
  mockSelect: ReturnType<typeof vi.fn>;
  mockInsert: ReturnType<typeof vi.fn>;
  mockUpdateEq: ReturnType<typeof vi.fn>;
  mockUpdate: ReturnType<typeof vi.fn>;
  mockFrom: ReturnType<typeof vi.fn>;
} {
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 42 }, error: null });
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
  const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

  const mockFrom = vi.fn((table: string) => {
    if (table === "bot_runs") {
      return { insert: mockInsert, update: mockUpdate, eq: vi.fn() };
    }
    if (table === "sources") {
      return { update: mockUpdate, eq: vi.fn() };
    }
    return { insert: vi.fn(), update: vi.fn(), eq: vi.fn() };
  });

  return {
    supabase: { from: mockFrom } as ReturnType<typeof buildSupabaseMock>["supabase"] & { from: ReturnType<typeof vi.fn> },
    mockSingle,
    mockSelect,
    mockInsert,
    mockUpdateEq,
    mockUpdate,
    mockFrom,
  };
}

const DEFAULT_SOURCE: SourceRunRecord = {
  id: 1,
  name: "Test Source",
  slug: "test-source",
  scrape_url: "https://example.com",
  total_imported: 0,
  fetch_limit: 10,
  product_limit: null,
  bot_import_mode: null,
  bot_listing_status: null,
};

const DEFAULT_OPTIONS = {
  runType: "real_test" as const,
  maxLimit: undefined,
  forceStatus: undefined,
  skipInactiveMarking: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// H4 — per-source timeout
// ---------------------------------------------------------------------------
describe("H4 — per-source 120s timeout", () => {
  it("rejects with 'timed out' error when adapter.sync() hangs beyond 120s", async () => {
    vi.useFakeTimers();
    const { supabase } = buildSupabaseMock();

    // sync() never resolves
    mockSync.mockReturnValue(new Promise<never>(() => {}));

    const promise = runSourceScrapeBot(supabase as never, DEFAULT_SOURCE, DEFAULT_OPTIONS);

    // Advance past the 120s timeout
    await vi.advanceTimersByTimeAsync(120_001);
    const result = await promise;

    expect(result.status).toBe("failed");
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("timed out");
    expect(result.errorCount).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it("passes through normally when adapter.sync() completes within the 120s window", async () => {
    vi.useFakeTimers();
    const { supabase } = buildSupabaseMock();

    mockSync.mockResolvedValue(FAKE_ADAPTER_RESULT);

    const promise = runSourceScrapeBot(supabase as never, DEFAULT_SOURCE, DEFAULT_OPTIONS);

    // Let the sync resolve immediately (no timer advancement needed — mock is resolved)
    // But we still need to advance fake timers for any internal setTimeout
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.status).toBe("success");
    expect(result.ok).toBe(true);
    expect(result.found).toBeGreaterThanOrEqual(1);
    expect(result.durationMs).toBe(1500);
    expect(result.errorMessage).toBeNull();

    vi.useRealTimers();
  });

  it("reports correct duration in milliseconds on success", async () => {
    vi.useFakeTimers();
    const { supabase } = buildSupabaseMock();

    mockSync.mockResolvedValue({ ...FAKE_ADAPTER_RESULT, duration_ms: 3200 });

    const promise = runSourceScrapeBot(supabase as never, DEFAULT_SOURCE, DEFAULT_OPTIONS);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.durationMs).toBe(3200);

    vi.useRealTimers();
  });

  it("does not call syncListingsForSource when timeout fires", async () => {
    vi.useFakeTimers();
    const { supabase } = buildSupabaseMock();

    mockSync.mockReturnValue(new Promise<never>(() => {}));

    const promise = runSourceScrapeBot(supabase as never, DEFAULT_SOURCE, DEFAULT_OPTIONS);
    await vi.advanceTimersByTimeAsync(120_001);
    await promise;

    expect(syncListingsForSource).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
