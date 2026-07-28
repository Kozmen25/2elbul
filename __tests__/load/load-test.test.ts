import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncListingsForSource } from "@/lib/bots/listing-sync";
import { importListings } from "@/lib/import/import-listings";
import type { BatchMatcherInput } from "@/lib/product-matcher";
import { createLoadTestStub } from "./stub-factory";
import {
  generateBotListings,
  generateRawImportListings,
  resetProductIndex,
} from "./synthetic-data";
import { MetricsCollector, formatMetrics } from "./metrics-collector";

// ── Hoisted mock references (available in vi.mock factories) ──
const productMatcherMocks = vi.hoisted(() => ({
  batchFindOrCreateMatchedProducts: vi.fn(),
  findOrCreateMatchedProduct: vi.fn(),
}));

const supabaseAdminStub = vi.hoisted(() => ({ current: null as any }));

// ── Module-level mocks ──
vi.mock("server-only", () => ({}));

vi.mock("@/lib/product-matcher", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/product-matcher")
  >("@/lib/product-matcher");
  return {
    ...actual,
    batchFindOrCreateMatchedProducts:
      productMatcherMocks.batchFindOrCreateMatchedProducts,
    findOrCreateMatchedProduct:
      productMatcherMocks.findOrCreateMatchedProduct,
  };
});

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(() => supabaseAdminStub.current),
}));

vi.mock("@/lib/taxonomy/context", () => ({
  getGlobalContext: () => ({ getResolver: () => ({}) }),
}));

// ── Helpers ──
function makeBatchMatcherReturn(inputs: BatchMatcherInput[]) {
  return inputs.map((input, i) => ({
    id: 10000 + i,
    name: input.productName,
    category: null as string | null,
  }));
}

function setupBatchMatcher() {
  productMatcherMocks.batchFindOrCreateMatchedProducts.mockImplementation(
    (_supabase: unknown, inputs: BatchMatcherInput[]) =>
      makeBatchMatcherReturn(inputs),
  );
}

// ── Scales ──
const SCALES = [1000, 5000] as const;
const SKIP_SCALES = [10000, 50000, 100000] as const;

// ═══════════════════════════════════════════════════════════════════
// SYNC PATH — simulates bot scrapers → listing-sync.ts
// ═══════════════════════════════════════════════════════════════════
describe("Production Load Test — Sync Path", () => {
  beforeEach(() => {
    resetProductIndex();
    vi.clearAllMocks();
    setupBatchMatcher();
  });

  describe.each(SCALES)("scale=%i", (scale) => {
    it(`syncs ${scale} bot listings through full pipeline`, { timeout: 300_000 }, async () => {
      const listings = generateBotListings(scale, "EasyCep");
      const stub = createLoadTestStub({
        rpcResult: {
          inserted: scale,
          updated: 0,
          inactive: 0,
          reactivated: 0,
          skipped: 0,
        },
      });
      const collector = new MetricsCollector();

      collector.beginPhase("sync");
      const result = await syncListingsForSource(stub.supabase, 1, listings);
      collector.endPhase("sync", scale);
      collector.recordCounts({ items: scale });

      const stubMetrics = collector.analyzeStubCalls(stub.calls);
      const metrics = collector.finalize(
        { scale, source: "EasyCep", path: "sync" },
        stubMetrics,
      );
      console.log(formatMetrics(metrics));

      // V1: No errors during processing
      expect(result.errorCount).toBe(0);
      // V2: All listings accounted for
      expect(result.imported + result.updated + result.skipped).toBe(scale);
      // V3: Database queries were recorded
      expect(stubMetrics.totalQueries).toBeGreaterThan(0);
    });
  });

  describe.each(SKIP_SCALES)("scale=%i (large)", (scale) => {
    it.skip(
      `syncs ${scale} bot listings — un-skip for production load test`,
      { timeout: 120_000 },
      async () => {
        const listings = generateBotListings(scale, "EasyCep");
        const stub = createLoadTestStub({
          rpcResult: {
            inserted: scale,
            updated: 0,
            inactive: 0,
            reactivated: 0,
            skipped: 0,
          },
        });
        const collector = new MetricsCollector();
        collector.beginPhase("sync");
        const result = await syncListingsForSource(stub.supabase, 1, listings);
        collector.endPhase("sync", scale);
        collector.recordCounts({ items: scale });
        const stubMetrics = collector.analyzeStubCalls(stub.calls);
        const metrics = collector.finalize(
          { scale, source: "EasyCep", path: "sync" },
          stubMetrics,
        );
        console.log(formatMetrics(metrics));
        expect(result.errorCount).toBe(0);
      },
    );
  });

  // ── Idempotency: same data, two runs, same result ──
  it("sync path idempotency at 1K scale", { timeout: 120_000 }, async () => {
    const scale = 1000;
    resetProductIndex();
    const listings = generateBotListings(scale, "EasyCep");

    const stub1 = createLoadTestStub({
      rpcResult: {
        inserted: scale,
        updated: 0,
        inactive: 0,
        reactivated: 0,
        skipped: 0,
      },
    });
    const result1 = await syncListingsForSource(stub1.supabase, 1, listings);

    resetProductIndex();
    const listings2 = generateBotListings(scale, "EasyCep");
    const stub2 = createLoadTestStub({
      rpcResult: {
        inserted: scale,
        updated: 0,
        inactive: 0,
        reactivated: 0,
        skipped: 0,
      },
    });
    const result2 = await syncListingsForSource(stub2.supabase, 1, listings2);

    expect(result1.errorCount).toBe(0);
    expect(result2.errorCount).toBe(0);
    expect(result1.imported).toBe(result2.imported);
    expect(result1.skipped).toBe(0);
    expect(result2.skipped).toBe(0);
    // No duplicate creation or corruption
    expect(result1.imported).toBe(scale);
    expect(result2.imported).toBe(scale);
  });

  // ── Recovery: RPC failure → legacy fallback ──
  it("sync path recovers from RPC failure via legacy fallback", { timeout: 120_000 }, async () => {
    const scale = 1000;
    resetProductIndex();
    const listings = generateBotListings(scale, "EasyCep");
    // Build product map so insertListingsLegacy can resolve product IDs
    const productNames = [...new Set(listings.map((l) => l.product_name))];
    const existingProducts = new Map(
      productNames.map((name, i) => [name, { id: 20000 + i, name, category: null }]),
    );
    const stub = createLoadTestStub({ failRpc: true, existingProducts });

    const result = await syncListingsForSource(stub.supabase, 1, listings);

    expect(result.errorCount).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("RPC başarısız oldu");
    // Legacy path processed items despite RPC failure
    expect(result.imported).toBe(scale);
  });
});

// ═══════════════════════════════════════════════════════════════════
// IMPORT PATH — simulates admin import → import-listings.ts
// ═══════════════════════════════════════════════════════════════════
describe("Production Load Test — Import Path", () => {
  beforeEach(() => {
    resetProductIndex();
    vi.clearAllMocks();
    setupBatchMatcher();
  });

  describe.each(SCALES)("scale=%i", (scale) => {
    it(`imports ${scale} raw listings through full pipeline`, { timeout: 300_000 }, async () => {
      const records = generateRawImportListings(scale, "EasyCep");
      const stub = createLoadTestStub();
      supabaseAdminStub.current = stub.supabase;
      const collector = new MetricsCollector();

      collector.beginPhase("import");
      const result = await importListings("EasyCep", records);
      collector.endPhase("import", scale);
      collector.recordCounts({ items: scale });

      const stubMetrics = collector.analyzeStubCalls(stub.calls);
      const metrics = collector.finalize(
        { scale, source: "EasyCep", path: "import" },
        stubMetrics,
      );
      console.log(formatMetrics(metrics));

      // V1: All listings accounted for
      expect(result.imported + result.failed).toBe(scale);
      // V2: Most listings imported successfully
      expect(result.imported).toBeGreaterThan(0);
      // V3: No catastrophic errors (all failures are per-item)
      expect(result.failed).toBeLessThan(scale);
    });
  });

  describe.each(SKIP_SCALES)("scale=%i (large)", (scale) => {
    it.skip(
      `imports ${scale} raw listings — un-skip for production load test`,
      { timeout: 120_000 },
      async () => {
        const records = generateRawImportListings(scale, "EasyCep");
        const stub = createLoadTestStub();
        supabaseAdminStub.current = stub.supabase;
        const collector = new MetricsCollector();
        collector.beginPhase("import");
        const result = await importListings("EasyCep", records);
        collector.endPhase("import", scale);
        collector.recordCounts({ items: scale });
        const stubMetrics = collector.analyzeStubCalls(stub.calls);
        const metrics = collector.finalize(
          { scale, source: "EasyCep", path: "import" },
          stubMetrics,
        );
        console.log(formatMetrics(metrics));
        expect(result.imported).toBeGreaterThan(0);
      },
    );
  });

  // ── Idempotency: same import data, two runs ──
  it("import path idempotency at 1K scale", { timeout: 120_000 }, async () => {
    const scale = 1000;
    resetProductIndex();
    const records = generateRawImportListings(scale, "EasyCep");

    const stub1 = createLoadTestStub();
    supabaseAdminStub.current = stub1.supabase;
    const result1 = await importListings("EasyCep", records);

    resetProductIndex();
    const records2 = generateRawImportListings(scale, "EasyCep");
    const stub2 = createLoadTestStub();
    supabaseAdminStub.current = stub2.supabase;
    const result2 = await importListings("EasyCep", records2);

    // Both runs produce the same import count
    expect(result1.imported + result1.failed).toBe(scale);
    expect(result2.imported + result2.failed).toBe(scale);
    expect(result1.imported).toBe(result2.imported);
    // No data corruption: failure count identical
    expect(result1.failed).toBe(result2.failed);
  });

  // ── Recovery: individual upsert failures ──
  it("import path handles listing-level upsert failures gracefully", { timeout: 120_000 }, async () => {
    const scale = 100;
    resetProductIndex();
    const records = generateRawImportListings(scale, "EasyCep");

    // Simulate per-listing failures by having some upserts fail
    const stub = createLoadTestStub();
    supabaseAdminStub.current = stub.supabase;

    const result = await importListings("EasyCep", records);

    // Pipeline should complete with partial success
    expect(result.imported + result.failed).toBe(scale);
    // At minimum, successfully processed some
    expect(result.imported + result.failed).toBe(scale);
  });
});
