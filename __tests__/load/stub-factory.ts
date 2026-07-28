import { vi } from "vitest";
import type { SupabaseClient, PostgrestResponse } from "@supabase/supabase-js";

/** Records a single Supabase interaction. */
export interface CallRecord {
  table: string;
  method: string;
  args: unknown[];
}

/** Seeded sequential ID generator for deterministic test output. */
export class IdSequence {
  private nextId = 1;
  reset(start = 1): void { this.nextId = start; }
  next(): number { return this.nextId++; }
}

/**
 * Load test stub configuration.
 *
 * Default behavior (used unless overridden):
 * - `products` table: SELECT always returns [], INSERT assigns sequential IDs
 * - `listings` table: SELECT always returns []
 * - `rpc("sync_source_listings")`: returns { data: null, error: null }
 * - All other tables: SELECT returns [], INSERT returns empty { data: [], error: null }
 */
export interface StubConfig {
  /** If true, loading products fails with an error. */
  failProductSelect?: boolean;
  /** If true, product INSERT fails with a duplicate-key error. */
  failProductInsert?: boolean;
  /** If true, the RPC call fails. */
  failRpc?: boolean;
  /**
   * Custom RPC result data. When set, RPC returns { data: rpcResult, error: null }.
   * Useful for sync path tests where imported count matters.
   * Example: { inserted: 1000, updated: 0, inactive: 0, reactivated: 0, skipped: 0 }
   */
  rpcResult?: Record<string, number> | null;
  /**
   * Map of (canonicalName → { id, name, category }) for products that
   * already "exist" in the DB. Load test uses empty by default.
   */
  existingProducts?: Map<string, { id: number; name: string; category: string | null }>;
  /** ID sequence for product creation. */
  ids?: IdSequence;
}

/** Create a TableChain builder that records all calls. */
function createTableChain(
  table: string,
  calls: CallRecord[],
  config: StubConfig,
  ids: IdSequence,
): Record<string, unknown> {
  const recordCall = (method: string, args: unknown[]) => {
    calls.push({ table, method, args });
  };

  // ── Select chain builder ──
  const makeSelectChain = (queryCols?: string[]) => {
    const chain: Record<string, unknown> = {};

    chain.eq = (col: string, val: unknown) => {
      recordCall("eq", [col, val]);
      // Return a new chain for continued chaining
      const next = makeSelectChain(queryCols);
      // .eq("id", ...) → single()
      (next as any).single = () => {
        recordCall("single", []);
        if (config.failProductSelect) return Promise.resolve({ data: null, error: { message: "simulated select error", details: "", hint: "", code: "SIMULATED" } });
        return Promise.resolve({ data: null, error: null });
      };
      return next;
    };

    chain.in = (col: string, vals: unknown[]) => {
      recordCall("in", [col, vals]);
      const next = makeSelectChain(queryCols);
      // When .then() is called directly (Promise-style), resolve with data
      (next as any).then = (resolve: (v: unknown) => void) => {
        return generateSelectResult(table, col, vals, queryCols, config, ids).then(resolve);
      };
      return next;
    };

    chain.gte = (col: string, val: unknown) => {
      recordCall("gte", [col, val]);
      return makeSelectChain(queryCols);
    };

    chain.lt = (col: string, val: unknown) => {
      recordCall("lt", [col, val]);
      return makeSelectChain(queryCols);
    };

    chain.limit = (n: number) => {
      recordCall("limit", [n]);
      return makeSelectChain(queryCols);
    };

    chain.range = (from: number, to: number) => {
      recordCall("range", [from, to]);
      return makeSelectChain(queryCols);
    };

    chain.order = (col: string, opts?: { ascending?: boolean }) => {
      recordCall("order", [col, opts]);
      return makeSelectChain(queryCols);
    };

    chain.single = () => {
      recordCall("single", []);
      return Promise.resolve({ data: null, error: null });
    };

    chain.maybeSingle = () => {
      recordCall("maybeSingle", []);
      return Promise.resolve({ data: null, error: null });
    };

    // then/catch for Promise-like usage
    chain.then = (resolve: (v: unknown) => void) => {
      return generateSelectResult(table, "name", [], queryCols, config, ids).then(resolve);
    };

    return chain;
  };

  // ── Table chain ──
  const tableChain: Record<string, unknown> = {};

  tableChain.select = (cols?: string) => {
    const colArray = cols ? cols.split(",").map((c) => c.trim()) : [];
    recordCall("select", [cols ?? "*"]);
    const chain = makeSelectChain(colArray);
    // order is both a select child and directly callable
    (chain as any).order = (col: string, opts?: { ascending?: boolean }) => {
      recordCall("order", [col, opts]);
      return chain;
    };
    return chain;
  };

  tableChain.insert = (payload: unknown) => {
    recordCall("insert", [payload]);
    const insertChain: Record<string, unknown> = {};

    insertChain.select = (cols?: string) => {
      recordCall("select", [cols ?? "*"]);
      const colArray = cols ? cols.split(",").map((c) => c.trim()) : [];

      const resultChain: Record<string, unknown> = {};

      resultChain.single = () => {
        recordCall("single", []);
        if (config.failProductInsert) {
          return Promise.resolve({ data: null, error: { message: 'duplicate key value violates unique constraint "products_name_key"', details: "", hint: "", code: "23505" } });
        }
        const newId = ids.next();
        const data: Record<string, unknown> = { id: newId };
        if (colArray.includes("name") && Array.isArray(payload)) {
          data.name = String((payload[0] as Record<string, unknown>)?.name ?? "");
        } else if (colArray.includes("name") && !Array.isArray(payload) && payload && typeof payload === "object") {
          data.name = String((payload as Record<string, unknown>).name ?? "");
        }
        return Promise.resolve({ data, error: null });
      };

      resultChain.then = (resolve: (v: unknown) => void) => {
        return generateInsertResult(table, payload, colArray, config, ids).then(resolve);
      };

      return resultChain;
    };

    return insertChain;
  };

  tableChain.upsert = (payload: unknown, opts?: unknown) => {
    recordCall("upsert", [payload, opts]);
    return tableChain; // chainable
  };

  tableChain.update = (payload: unknown) => {
    recordCall("update", [payload]);
    const updateChain: Record<string, unknown> = {};
    updateChain.eq = (col: string, val: unknown) => {
      recordCall("eq", [col, val]);
      if (col === "status" && val === "pending") {
        return {
          select: () => Promise.resolve({ data: [{ id: "1" }], error: null }),
        };
      }
      return Promise.resolve({ data: [], error: null });
    };
    updateChain.select = (cols?: string) => {
      recordCall("select", [cols ?? "*"]);
      return {
        single: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
    };
    return updateChain;
  };

  tableChain.delete = () => {
    recordCall("delete", []);
    return tableChain;
  };

  tableChain.eq = (col: string, val: unknown) => {
    recordCall("eq", [col, val]);
    return tableChain;
  };

  tableChain.in = (col: string, vals: unknown[]) => {
    recordCall("in", [col, vals]);
    return tableChain;
  };

  tableChain.limit = (n: number) => {
    recordCall("limit", [n]);
    return tableChain;
  };

  tableChain.order = (col: string, opts?: { ascending?: boolean }) => {
    recordCall("order", [col, opts]);
    return tableChain;
  };

  tableChain.single = () => {
    recordCall("single", []);
    return Promise.resolve({ data: null, error: null });
  };

  tableChain.maybeSingle = () => {
    recordCall("maybeSingle", []);
    return Promise.resolve({ data: null, error: null });
  };

  tableChain.then = (resolve: (v: unknown) => void) => {
    return Promise.resolve({ data: [], error: null }).then(resolve);
  };

  return tableChain;
}

/** Generate response for a SELECT query. */
async function generateSelectResult(
  table: string,
  col: string,
  vals: unknown[],
  queryCols: string[] | undefined,
  config: StubConfig,
  ids: IdSequence,
): Promise<{ data: unknown; error: null | object; count: null }> {
  if (config.failProductSelect) {
    return { data: null, error: { message: "simulated select error", details: "", hint: "", code: "SIMULATED" }, count: null };
  }

  // For products table with .in("name") — check existing products
  if (table === "products" && col === "name" && config.existingProducts && vals.length > 0) {
    const matched: unknown[] = [];
    for (const productName of vals as string[]) {
      const existing = config.existingProducts.get(productName);
      if (existing) {
        const row: Record<string, unknown> = { id: existing.id, name: existing.name };
        if (queryCols?.includes("category")) row.category = existing.category;
        matched.push(row);
      }
    }
    return { data: matched, error: null, count: null };
  }

  // For products table with .in("normalized_key") — also check existing products
  if (table === "products" && col === "normalized_key" && config.existingProducts && vals.length > 0) {
    // For load testing, assume no key matches (all new products)
    return { data: [], error: null, count: null };
  }

  return { data: [], error: null, count: null };
}

/** Generate response for an INSERT query. */
async function generateInsertResult(
  table: string,
  payload: unknown,
  queryCols: string[],
  config: StubConfig,
  ids: IdSequence,
): Promise<{ data: unknown; error: null | object }> {
  if (config.failProductInsert && table === "products") {
    return { data: null, error: { message: 'duplicate key value violates unique constraint "products_name_key"', details: "", hint: "", code: "23505" } };
  }

  if (table !== "products") {
    return { data: [], error: null };
  }

  // Generate sequential IDs for each inserted product
  const payloadArr = Array.isArray(payload) ? payload : [payload];
  const created = payloadArr.map((item) => {
    const row: Record<string, unknown> = {
      id: ids.next(),
      name: String((item as Record<string, unknown>)?.name ?? ""),
    };
    if (queryCols.includes("normalized_key")) {
      row.normalized_key = String((item as Record<string, unknown>)?.normalized_key ?? "");
    }
    return row;
  });

  return { data: created, error: null };
}

export function createLoadTestStub(config: StubConfig = {}): {
  supabase: SupabaseClient;
  calls: CallRecord[];
  ids: IdSequence;
} {
  const calls: CallRecord[] = [];
  const ids = config.ids ?? new IdSequence();

  const fromTable = (table: string) => {
    return createTableChain(table, calls, config, ids);
  };

  const rpcCall = (fnName: string, args: unknown) => {
    calls.push({ table: "rpc", method: fnName, args: [args] });
    if (config.failRpc) {
      return Promise.resolve({ data: null, error: { message: "simulated RPC error", details: "", hint: "", code: "" } });
    }
    if (config.rpcResult !== undefined) {
      return Promise.resolve({ data: config.rpcResult, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  };

  const supabase = {
    from: fromTable,
    rpc: rpcCall,
  } as unknown as SupabaseClient;

  return { supabase, calls, ids };
}

/** Build a simple stub for syncListingsForSource with all products being "new". */
export function createSyncStub(): {
  supabase: SupabaseClient;
  calls: CallRecord[];
  ids: IdSequence;
} {
  return createLoadTestStub({ existingProducts: new Map() });
}
