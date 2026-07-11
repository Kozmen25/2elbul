import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importAdminListings } from "@/app/admin/import/actions";
import { insertListingsLegacy, syncListingsForSource } from "@/lib/bots/listing-sync";
import type { BotAdapterListing } from "@/lib/bots/types";
import type { ImportSource } from "./types";
import { importListings } from "./import-listings";

type QueryResult<T> = {
  data: T;
  error: unknown | null;
};

type CallRecord = {
  table: string;
  method: string;
  args: unknown[];
};

type TableConfig = {
  defaultResult: QueryResult<unknown>;
  singleResult?: QueryResult<unknown>;
};

type TableChain = {
  select: (...args: unknown[]) => TableChain;
  upsert: (...args: unknown[]) => TableChain;
  insert: (...args: unknown[]) => TableChain;
  update: (...args: unknown[]) => TableChain;
  eq: (...args: unknown[]) => TableChain;
  in: (...args: unknown[]) => TableChain;
  limit: (...args: unknown[]) => TableChain;
  order: (...args: unknown[]) => TableChain;
  range: (...args: unknown[]) => TableChain;
  single: (...args: unknown[]) => Promise<QueryResult<unknown>>;
  maybeSingle: (...args: unknown[]) => Promise<QueryResult<unknown>>;
  then: PromiseLike<QueryResult<unknown>>["then"];
};

const {
  createSupabaseAdminClientMock,
  findOrCreateMatchedProductMock,
  getGlobalContextMock,
  recordListingPriceHistoryMock,
  requireAdminUserMock,
} = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn(),
  findOrCreateMatchedProductMock: vi.fn(),
  getGlobalContextMock: vi.fn(),
  recordListingPriceHistoryMock: vi.fn(),
  requireAdminUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("@/lib/product-matcher", async () => {
  const actual = await vi.importActual<typeof import("@/lib/product-matcher")>(
    "@/lib/product-matcher",
  );
  return {
    ...actual,
    findOrCreateMatchedProduct: findOrCreateMatchedProductMock,
  };
});

vi.mock("@/lib/taxonomy/context", () => ({
  getGlobalContext: getGlobalContextMock,
}));

vi.mock("@/lib/admin", () => ({
  requireAdminUser: requireAdminUserMock,
}));

vi.mock("@/lib/price-history", () => ({
  recordListingPriceHistory: recordListingPriceHistoryMock,
}));

vi.mock("server-only", () => ({}));

describe("double product creation guard", () => {
  beforeEach(() => {
    createSupabaseAdminClientMock.mockReset();
    findOrCreateMatchedProductMock.mockReset();
    getGlobalContextMock.mockReset();
    recordListingPriceHistoryMock.mockReset();
    requireAdminUserMock.mockReset();

    getGlobalContextMock.mockReturnValue({
      getResolver: () => ({}),
    });
    requireAdminUserMock.mockResolvedValue(undefined);
    recordListingPriceHistoryMock.mockResolvedValue(undefined);
    findOrCreateMatchedProductMock.mockImplementation(async () =>
      matchedProduct(101),
    );
  });

  describe("importListings", () => {
    it("creates no products directly for a single listing", async () => {
      const stub = createSupabaseStub({
        tables: {
          listings: {
            defaultResult: { data: [], error: null },
            singleResult: { data: { id: 1 }, error: null },
          },
        },
      });
      createSupabaseAdminClientMock.mockReturnValue(
        stub.supabase as unknown as SupabaseClient,
      );

      const result = await importListings("EasyCep", [
        makeImportRecord(),
      ]);

      expect(result.imported).toBe(1);
      expect(hasDirectProductWrite(stub.calls)).toBe(false);
      expect(findOrCreateMatchedProductMock).toHaveBeenCalledTimes(1);
    });

    it("passes the matched product id into listing upsert", async () => {
      const stub = createSupabaseStub({
        tables: {
          listings: {
            defaultResult: { data: [], error: null },
            singleResult: { data: { id: 7 }, error: null },
          },
        },
      });
      createSupabaseAdminClientMock.mockReturnValue(
        stub.supabase as unknown as SupabaseClient,
      );
      findOrCreateMatchedProductMock.mockResolvedValueOnce(matchedProduct(401));

      await importListings("EasyCep", [makeImportRecord()]);

      const upsertCall = stub.calls.find(
        (call) => call.table === "listings" && call.method === "upsert",
      );
      expect(upsertCall?.args[0]).toMatchObject({
        product_id: 401,
      });
    });

    it("does not create products directly for multiple listings", async () => {
      const stub = createSupabaseStub({
        tables: {
          listings: {
            defaultResult: { data: [], error: null },
            singleResult: { data: { id: 1 }, error: null },
          },
        },
      });
      createSupabaseAdminClientMock.mockReturnValue(
        stub.supabase as unknown as SupabaseClient,
      );
      findOrCreateMatchedProductMock
        .mockResolvedValueOnce(matchedProduct(11))
        .mockResolvedValueOnce(matchedProduct(12));

      const result = await importListings("EasyCep", [
        makeImportRecord({
          externalId: "import-1",
          title: "iPhone 15 Pro Max 256GB",
          product_name: "iPhone 15 Pro Max",
          url: "https://easycep.com/iphone-15-pro-max-256gb",
        }),
        makeImportRecord({
          externalId: "import-2",
          title: "iPhone 15 Pro 128GB",
          product_name: "iPhone 15 Pro",
          url: "https://easycep.com/iphone-15-pro-128gb",
        }),
      ]);

      expect(result.imported).toBe(2);
      expect(hasDirectProductWrite(stub.calls)).toBe(false);
      expect(findOrCreateMatchedProductMock).toHaveBeenCalledTimes(2);
    });

    it("forwards listing title and product name to the matcher", async () => {
      const stub = createSupabaseStub({
        tables: {
          listings: {
            defaultResult: { data: [], error: null },
            singleResult: { data: { id: 1 }, error: null },
          },
        },
      });
      createSupabaseAdminClientMock.mockReturnValue(
        stub.supabase as unknown as SupabaseClient,
      );

      await importListings("EasyCep", [makeImportRecord()]);

      expect(findOrCreateMatchedProductMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "iPhone 15 Pro Max 256GB",
          productName: "iPhone 15 Pro Max",
          source: "EasyCep",
        }),
      );
    });
  });

  describe("admin import", () => {
    it("creates no products directly for a single admin import", async () => {
      const stub = createSupabaseStub({
        tables: {
          listings: {
            defaultResult: { data: [], error: null },
            singleResult: { data: { id: 10 }, error: null },
          },
        },
      });
      createSupabaseAdminClientMock.mockReturnValue(
        stub.supabase as unknown as SupabaseClient,
      );

      const formData = new FormData();
      formData.set("json", JSON.stringify([makeImportRecord()]));

      const result = await importAdminListings(
        {
          status: "idle",
          message: "",
          imported: 0,
          existing: 0,
          failed: 0,
          errors: [],
        },
        formData,
      );

      expect(result.imported).toBe(1);
      expect(hasDirectProductWrite(stub.calls)).toBe(false);
      expect(findOrCreateMatchedProductMock).toHaveBeenCalledTimes(1);
    });

    it("uses the matched product id for admin listing insert", async () => {
      const stub = createSupabaseStub({
        tables: {
          listings: {
            defaultResult: { data: [], error: null },
            singleResult: { data: { id: 20 }, error: null },
          },
        },
      });
      createSupabaseAdminClientMock.mockReturnValue(
        stub.supabase as unknown as SupabaseClient,
      );
      findOrCreateMatchedProductMock.mockResolvedValueOnce(matchedProduct(777));

      const formData = new FormData();
      formData.set("json", JSON.stringify([makeImportRecord()]));

      await importAdminListings(
        {
          status: "idle",
          message: "",
          imported: 0,
          existing: 0,
          failed: 0,
          errors: [],
        },
        formData,
      );

      const insertCall = stub.calls.find(
        (call) => call.table === "listings" && call.method === "insert",
      );
      expect(insertCall?.args[0]).toMatchObject({
        product_id: 777,
      });
    });

    it("skips duplicate admin imports without touching products", async () => {
      const stub = createSupabaseStub({
        tables: {
          listings: {
            defaultResult: { data: [{ id: "existing" }], error: null },
          },
        },
      });
      createSupabaseAdminClientMock.mockReturnValue(
        stub.supabase as unknown as SupabaseClient,
      );

      const formData = new FormData();
      formData.set("json", JSON.stringify([makeImportRecord()]));

      const result = await importAdminListings(
        {
          status: "idle",
          message: "",
          imported: 0,
          existing: 0,
          failed: 0,
          errors: [],
        },
        formData,
      );

      expect(result.existing).toBe(1);
      expect(findOrCreateMatchedProductMock).not.toHaveBeenCalled();
      expect(hasDirectProductWrite(stub.calls)).toBe(false);
    });
  });

  describe("listing sync", () => {
    it("does not directly insert or upsert products during sync", async () => {
      const stub = createSupabaseStub({
        tables: {
          products: {
            defaultResult: { data: [], error: null },
          },
        },
        rpcResult: {
          data: {
            inserted: 1,
            updated: 0,
            inactive: 0,
            reactivated: 0,
            skipped: 0,
          },
          error: null,
        },
      });

      findOrCreateMatchedProductMock
        .mockResolvedValueOnce(matchedProduct(501))
        .mockResolvedValueOnce(matchedProduct(502));

      const result = await syncListingsForSource(
        stub.supabase as unknown as SupabaseClient,
        7,
        [
          makeBotListing({
            external_id: "sync-1",
            product_name: "iPhone 15 Pro Max",
            title: "iPhone 15 Pro Max 256GB",
            url: "https://easycep.com/sync-1",
          }),
          makeBotListing({
            external_id: "sync-2",
            product_name: "iPhone 15 Pro",
            title: "iPhone 15 Pro 128GB",
            url: "https://easycep.com/sync-2",
          }),
        ],
      );

      expect(result.imported).toBe(1);
      expect(result.matchedProducts).toBe(2);
      expect(hasDirectProductWrite(stub.calls)).toBe(false);
    });

    it("keeps matched product ids in the RPC payload", async () => {
      const rpcResult = {
        data: {
          inserted: 2,
          updated: 0,
          inactive: 0,
          reactivated: 0,
          skipped: 0,
        },
        error: null,
      } as const;
      const stub = createSupabaseStub({
        tables: {
          products: {
            defaultResult: { data: [], error: null },
          },
        },
        rpcResult,
      });

      findOrCreateMatchedProductMock
        .mockResolvedValueOnce(matchedProduct(901))
        .mockResolvedValueOnce(matchedProduct(902));

      const result = await syncListingsForSource(
        stub.supabase as unknown as SupabaseClient,
        42,
        [
          makeBotListing({
            external_id: "sync-a",
            product_name: "Galaxy S24 Ultra",
            title: "Galaxy S24 Ultra 256GB",
            url: "https://easycep.com/sync-a",
          }),
          makeBotListing({
            external_id: "sync-b",
            product_name: "Galaxy S24",
            title: "Galaxy S24 128GB",
            url: "https://easycep.com/sync-b",
          }),
        ],
      );

      expect(result.matchedProducts).toBe(2);
      expect(stub.rpc).toHaveBeenCalledWith(
        "sync_source_listings",
        expect.objectContaining({
          p_items: expect.arrayContaining([
            expect.objectContaining({ product_id: 901 }),
            expect.objectContaining({ product_id: 902 }),
          ]),
        }),
      );
    });

    it("falls back to legacy sync when the RPC signature is unavailable", async () => {
      const stub = createSupabaseStub({
        tables: {
          products: {
            defaultResult: { data: [], error: null },
          },
          listings: {
            defaultResult: { data: [], error: null },
            singleResult: { data: { id: 88 }, error: null },
          },
        },
        rpcResult: {
          data: null,
          error: {
            code: "PGRST202",
            message: "could not find the function public.sync_source_listings",
            details: "",
          },
        },
      });

      findOrCreateMatchedProductMock.mockResolvedValueOnce(matchedProduct(701));
      findOrCreateMatchedProductMock.mockResolvedValueOnce(matchedProduct(701));

      const result = await syncListingsForSource(
        stub.supabase as unknown as SupabaseClient,
        15,
        [
          makeBotListing({
            external_id: "sync-fallback-1",
            product_name: "iPhone 14",
            title: "iPhone 14 128GB",
            url: "https://easycep.com/sync-fallback-1",
          }),
        ],
      );

      expect(stub.rpc).toHaveBeenCalledTimes(2);
      expect(findOrCreateMatchedProductMock).toHaveBeenCalledTimes(2);
      expect(result.imported).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.duplicateSummary).not.toBeNull();

      const insertCall = stub.calls.find(
        (call) => call.table === "listings" && call.method === "insert",
      );
      expect(insertCall?.args[0]).toMatchObject({
        product_id: 701,
        status: "active",
      });
      expect(recordListingPriceHistoryMock).toHaveBeenCalledTimes(1);
    });

    it("does not directly insert products in the legacy fallback path", async () => {
      const stub = createSupabaseStub({
        tables: {
          products: {
            defaultResult: { data: [], error: null },
          },
          listings: {
            defaultResult: { data: [], error: null },
            singleResult: { data: { id: 77 }, error: null },
          },
        },
      });

      findOrCreateMatchedProductMock.mockResolvedValueOnce(matchedProduct(601));

      const result = await insertListingsLegacy(
        stub.supabase as unknown as SupabaseClient,
        [
          makeBotListing({
            external_id: "legacy-1",
            product_name: "iPhone 14",
            title: "iPhone 14 128GB",
            url: "https://example.com/legacy-1",
          }),
        ],
      );

      expect(result.imported).toBe(1);
      expect(hasDirectProductWrite(stub.calls)).toBe(false);
      expect(recordListingPriceHistoryMock).toHaveBeenCalledTimes(1);
    });
  });
});

function createSupabaseStub(config: {
  tables: Record<string, TableConfig>;
  rpcResult?: QueryResult<unknown>;
}) {
  const calls: CallRecord[] = [];
  const chains = new Map<string, TableChain>();

  const from = vi.fn((table: string) => {
    calls.push({ table, method: "from", args: [] });
    if (!chains.has(table)) {
      chains.set(table, createTableChain(table, calls, config.tables[table]));
    }
    return chains.get(table)!;
  });

  const rpc = vi.fn(async (...args: unknown[]) => {
    calls.push({ table: "rpc", method: "rpc", args });
    return config.rpcResult ?? { data: null, error: null };
  });

  return {
    supabase: { from, rpc },
    from,
    rpc,
    calls,
  };
}

function createTableChain(
  table: string,
  calls: CallRecord[],
  config: TableConfig | undefined,
): TableChain {
  const resolvedConfig: TableConfig = config ?? {
    defaultResult: { data: null, error: null },
  };

  const chain = {} as TableChain;
  const record = (method: string, args: unknown[]) => {
    calls.push({ table, method, args });
    return chain;
  };

  chain.select = vi.fn((...args: unknown[]) => record("select", args));
  chain.upsert = vi.fn((...args: unknown[]) => record("upsert", args));
  chain.insert = vi.fn((...args: unknown[]) => record("insert", args));
  chain.update = vi.fn((...args: unknown[]) => record("update", args));
  chain.eq = vi.fn((...args: unknown[]) => record("eq", args));
  chain.in = vi.fn((...args: unknown[]) => record("in", args));
  chain.limit = vi.fn((...args: unknown[]) => record("limit", args));
  chain.order = vi.fn((...args: unknown[]) => record("order", args));
  chain.range = vi.fn((...args: unknown[]) => record("range", args));
  chain.single = vi.fn(async (...args: unknown[]) => {
    calls.push({ table, method: "single", args });
    return resolvedConfig.singleResult ?? resolvedConfig.defaultResult;
  });
  chain.maybeSingle = vi.fn(async (...args: unknown[]) => {
    calls.push({ table, method: "maybeSingle", args });
    return resolvedConfig.singleResult ?? resolvedConfig.defaultResult;
  });
  chain.then = ((onFulfilled, onRejected) =>
    Promise.resolve(resolvedConfig.defaultResult).then(
      onFulfilled,
      onRejected,
    )) as TableChain["then"];

  return chain;
}

function matchedProduct(id: number) {
  return {
    id,
    name: `product-${id}`,
    signals: {},
    created: false,
    confidenceScore: 100,
    confidenceLevel: "very-high" as const,
    confidenceReasons: ["ok"],
  };
}

function makeImportRecord(overrides: Record<string, unknown> = {}) {
  return {
    externalId: "import-1",
    product_name: "iPhone 15 Pro Max",
    title: "iPhone 15 Pro Max 256GB",
    price: 50000,
    city: "Istanbul",
    source: "EasyCep" as ImportSource,
    url: "https://easycep.com/iphone-15-pro-max-256gb",
    condition: "Yenilenmiş",
    image_url: "https://example.com/image.jpg",
    image_urls: [],
    ...overrides,
  };
}

function makeBotListing(overrides: Partial<BotAdapterListing> = {}): BotAdapterListing {
  return {
    external_id: "bot-1",
    product_name: "iPhone 15 Pro Max",
    title: "iPhone 15 Pro Max 256GB",
    price: 50000,
    city: "Istanbul",
    source: "EasyCep",
    url: "https://easycep.com/bot-1",
    condition: "Yenilenmiş",
    image_url: "https://example.com/image.jpg",
    image_urls: ["https://example.com/image.jpg"],
    status: "published",
    ...overrides,
  };
}

function hasDirectProductWrite(calls: CallRecord[]) {
  return calls.some(
    (call) =>
      call.table === "products" && (call.method === "insert" || call.method === "upsert"),
  );
}
