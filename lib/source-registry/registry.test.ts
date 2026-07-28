import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SourceRegistryImpl } from "./registry";

type StubRow = {
  id: number;
  name: string;
  slug: string;
  type: string;
  is_active: boolean;
  reliability_score: number | null;
};

function createStub(rows: StubRow[]) {
  const from = vi.fn((_table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      then: vi.fn(
        (
          onFulfilled: (value: {
            data: StubRow[];
            error: null;
          }) => unknown
        ) => {
          return Promise.resolve({ data: rows, error: null }).then(
            onFulfilled
          );
        }
      ),
    };
    return chain;
  });

  return { supabase: { from } as unknown as SupabaseClient, from };
}

describe("SourceRegistryImpl", () => {
  it("loads sources from supabase on initialize", async () => {
    const { supabase, from } = createStub([
      {
        id: 1,
        name: "Sahibinden",
        slug: "sahibinden",
        type: "marketplace",
        is_active: true,
        reliability_score: 68,
      },
    ]);

    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    expect(from).toHaveBeenCalledWith("sources");
    expect(registry.getAll()).toHaveLength(1);
  });

  it("getById returns correct record", async () => {
    const { supabase } = createStub([
      {
        id: 5,
        name: "Getmobil",
        slug: "getmobil",
        type: "retailer",
        is_active: true,
        reliability_score: 90,
      },
    ]);

    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    const record = registry.getById(5);
    expect(record).not.toBeNull();
    expect(record!.sourceName).toBe("Getmobil");
    expect(record!.reliabilityScore).toBe(90);
  });

  it("getById returns null for unknown id", async () => {
    const { supabase } = createStub([]);
    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    expect(registry.getById(999)).toBeNull();
  });

  it("getBySlug returns correct record", async () => {
    const { supabase } = createStub([
      {
        id: 10,
        name: "Satarız",
        slug: "satariz",
        type: "marketplace",
        is_active: true,
        reliability_score: 65,
      },
    ]);

    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    const record = registry.getBySlug("satariz");
    expect(record).not.toBeNull();
    expect(record!.sourceId).toBe(10);
  });

  it("getBySlug returns null for unknown slug", async () => {
    const { supabase } = createStub([]);
    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    expect(registry.getBySlug("nonexistent")).toBeNull();
  });

  it("getByName is case-insensitive", async () => {
    const { supabase } = createStub([
      {
        id: 3,
        name: "Facebook Marketplace",
        slug: "facebook-marketplace",
        type: "marketplace",
        is_active: true,
        reliability_score: 58,
      },
    ]);

    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    const upper = registry.getByName("FACEBOOK MARKETPLACE");
    expect(upper).not.toBeNull();
    expect(upper!.sourceId).toBe(3);
  });

  it("getAllActive only returns active sources", async () => {
    const { supabase } = createStub([
      {
        id: 1,
        name: "Sahibinden",
        slug: "sahibinden",
        type: "marketplace",
        is_active: true,
        reliability_score: 68,
      },
      {
        id: 2,
        name: "Letgo",
        slug: "letgo",
        type: "marketplace",
        is_active: false,
        reliability_score: 60,
      },
    ]);

    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    expect(registry.getAllActive()).toHaveLength(1);
    expect(registry.getAllActive()[0].sourceId).toBe(1);
  });

  it("getReliability returns correct value", async () => {
    const { supabase } = createStub([
      {
        id: 4,
        name: "EasyCep",
        slug: "easycep",
        type: "retailer",
        is_active: true,
        reliability_score: 92,
      },
    ]);

    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    expect(registry.getReliability(4)).toBe(92);
  });

  it("getReliability returns 65 for unknown source", async () => {
    const { supabase } = createStub([]);
    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    expect(registry.getReliability(999)).toBe(65);
  });

  it("getReliability returns 65 when DB value is null", async () => {
    const { supabase } = createStub([
      {
        id: 1,
        name: "Sahibinden",
        slug: "sahibinden",
        type: "marketplace",
        is_active: true,
        reliability_score: null,
      },
    ]);

    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    expect(registry.getReliability(1)).toBe(65);
  });

  it("resolveSourceCount returns 1 when either id is null", () => {
    const registry = new SourceRegistryImpl();

    expect(registry.resolveSourceCount(null, 1)).toBe(1);
    expect(registry.resolveSourceCount(1, null)).toBe(1);
    expect(registry.resolveSourceCount(null, null)).toBe(1);
    expect(registry.resolveSourceCount(undefined, 1)).toBe(1);
    expect(registry.resolveSourceCount(1, undefined)).toBe(1);
  });

  it("resolveSourceCount returns 1 when ids match", () => {
    const registry = new SourceRegistryImpl();

    expect(registry.resolveSourceCount(1, 1)).toBe(1);
    expect(registry.resolveSourceCount(5, 5)).toBe(1);
  });

  it("resolveSourceCount returns 2 when ids differ", () => {
    const registry = new SourceRegistryImpl();

    expect(registry.resolveSourceCount(1, 2)).toBe(2);
    expect(registry.resolveSourceCount(3, 8)).toBe(2);
  });

  it("register adds a record to all maps", () => {
    const registry = new SourceRegistryImpl();

    registry.register({
      sourceId: 99,
      sourceName: "TestSource",
      sourceSlug: "test-source",
      type: "test",
      isActive: true,
      reliabilityScore: 50,
      listingSource: "Sahibinden",
    });

    expect(registry.getById(99)).not.toBeNull();
    expect(registry.getBySlug("test-source")).not.toBeNull();
    expect(registry.getByName("testsource")).not.toBeNull();
  });

  it("getAll returns all registered records", async () => {
    const { supabase } = createStub([
      {
        id: 1,
        name: "Sahibinden",
        slug: "sahibinden",
        type: "marketplace",
        is_active: true,
        reliability_score: 68,
      },
      {
        id: 2,
        name: "Letgo",
        slug: "letgo",
        type: "marketplace",
        is_active: true,
        reliability_score: 60,
      },
    ]);

    const registry = new SourceRegistryImpl();
    await registry.initialize(supabase);

    expect(registry.getAll()).toHaveLength(2);
  });

  it("throws on initialize when supabase query fails", async () => {
    const from = vi.fn((_table: string) => {
      const chain = {
        select: vi.fn(() => chain),
        order: vi.fn(() => chain),
        then: vi.fn(
          (
            _onFulfilled: (value: { data: null; error: Error }) => unknown
          ) => {
            return Promise.resolve({
              data: null,
              error: new Error("DB error"),
            }).then(_onFulfilled);
          }
        ),
      };
      return chain;
    });

    const supabase = { from } as unknown as SupabaseClient;
    const registry = new SourceRegistryImpl();

    await expect(registry.initialize(supabase)).rejects.toThrow("DB error");
  });
});
