import { describe, it, expect, beforeEach } from "vitest";
import { DeadLetterQueue } from "./dead-letter-queue";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DLQEntry } from "./types";

/* ───── Stub builder ───── */

type QueryBuilder = {
  insert: (payload: any) => {
    select: (cols: string) => { single: () => Promise<any> };
  };
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean },
    ) => SelectChain;
  };
  update: (payload: any) => UpdateChain;
};

interface SelectChain {
  eq: (k: string, v: any) => SelectChain | { single: () => Promise<any> };
  limit: (n: number) => SelectChain;
  range: (from: number, to: number) => SelectChain;
  then: (resolve: (v: any) => any) => Promise<any>;
}

interface UpdateChain {
  eq: (k: string, v: any) => Promise<any> | { select: (cols: string) => Promise<any> };
}

function stubClient(overrides?: {
  insertResult?: { data: { id: string } | null; error: null | object };
  selectResult?: { data: any | null; error: null | object };
  updateResult?: { data: any[] | null; error: null | object };
}): SupabaseClient {
  const insertResult = overrides?.insertResult ?? { data: { id: "new-id" }, error: null };
  const selectResult = overrides?.selectResult ?? { data: [], error: null };
  const updateResult = overrides?.updateResult ?? { data: [], error: null };

  // Shared select chain — all methods return the same object for continued chaining
  const selectChain: SelectChain = {
    eq: (k: string, v: any) => {
      if (k === "id" && typeof v === "string") {
        return { single: () => Promise.resolve(selectResult) };
      }
      return selectChain;
    },
    limit: () => selectChain,
    range: () => selectChain,
    then: (resolve: (v: any) => void) => Promise.resolve(selectResult).then(resolve),
  };

  // Inject .order() → returns the select chain
  const selectQB: any = (cols: string) => ({
    ...selectChain,
    order: () => selectChain,
  });

  const qb: QueryBuilder = {
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve(insertResult),
      }),
    }),
    select: selectQB,
    update: () => ({
      eq: (k: string, v: any) => {
        if (k === "id") {
          return Promise.resolve(updateResult);
        }
        if (k === "status" && v === "pending") {
          return { select: () => Promise.resolve(updateResult) };
        }
        return Promise.resolve(updateResult);
      },
    }),
  };

  return { from: () => qb } as any;
}

describe("DeadLetterQueue", () => {
  let dlq: DeadLetterQueue;
  let client: SupabaseClient;

  beforeEach(() => {
    client = stubClient();
    dlq = new DeadLetterQueue(client);
  });

  // ───── insert ─────

  describe("insert", () => {
    it("returns the new id on success", async () => {
      const client2 = stubClient({ insertResult: { data: { id: "abc-123" }, error: null } });
      const dlq2 = new DeadLetterQueue(client2);
      const id = await dlq2.insert({
        source_id: 1,
        source_slug: "easycep",
        queue_type: "scrape",
        retry_count: 0,
        max_retries: 3,
        last_error: "timeout",
        error_category: "timeout",
        payload: { url: "https://example.com" },
        status: "pending",
        next_retry_at: null,
        resolved_at: null,
        notes: null,
      });
      expect(id).toBe("abc-123");
    });

    it("returns null on error", async () => {
      const client2 = stubClient({ insertResult: { data: null, error: { message: "error" } } });
      const dlq2 = new DeadLetterQueue(client2);
      const id = await dlq2.insert({
        source_id: null,
        source_slug: "test",
        queue_type: "scrape",
        retry_count: 0,
        max_retries: 3,
        last_error: "err",
        error_category: "unknown",
        payload: {},
        status: "pending",
        next_retry_at: null,
        resolved_at: null,
        notes: null,
      });
      expect(id).toBeNull();
    });
  });

  // ───── list ─────

  describe("list", () => {
    it("returns empty array on error", async () => {
      const client2 = stubClient({ selectResult: { data: null, error: { message: "fail" } } });
      const dlq2 = new DeadLetterQueue(client2);
      const entries = await dlq2.list();
      expect(entries).toEqual([]);
    });

    it("returns entries without filter", async () => {
      const rows: DLQEntry[] = [
        {
          id: "1",
          source_id: 1,
          source_slug: "easycep",
          queue_type: "scrape",
          status: "pending",
          error_category: "timeout",
          retry_count: 0,
          max_retries: 3,
          last_error: "timeout",
          next_retry_at: null,
          created_at: "2024-01-01T00:00:00.000Z",
          payload: null,
          notes: null,
          resolved_at: null,
          updated_at: null,
        },
      ];
      const client2 = stubClient({ selectResult: { data: rows, error: null } });
      const dlq2 = new DeadLetterQueue(client2);
      const entries = await dlq2.list();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("1");
    });
  });

  // ───── getById ─────

  describe("getById", () => {
    it("returns entry when found", async () => {
      const row: DLQEntry = {
        id: "abc",
        source_id: 1,
        source_slug: "easycep",
        queue_type: "scrape",
        status: "pending",
        error_category: "network",
        retry_count: 0,
        max_retries: 3,
        last_error: "network error",
        next_retry_at: null,
        created_at: "2024-01-01T00:00:00.000Z",
        payload: null,
        notes: null,
        resolved_at: null,
        updated_at: null,
      };
      const client2 = stubClient({ selectResult: { data: row, error: null } });
      const dlq2 = new DeadLetterQueue(client2);
      const entry = await dlq2.getById("abc");
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe("abc");
    });

    it("returns null when not found", async () => {
      const client2 = stubClient({ selectResult: { data: null, error: { message: "not found" } } });
      const dlq2 = new DeadLetterQueue(client2);
      const entry = await dlq2.getById("nonexistent");
      expect(entry).toBeNull();
    });
  });

  // ───── retry ─────

  describe("retry", () => {
    it("does not throw on success", async () => {
      await expect(dlq.retry("some-id")).resolves.toBeUndefined();
    });
  });

  // ───── resolve ─────

  describe("resolve", () => {
    it("does not throw on success", async () => {
      await expect(dlq.resolve("some-id")).resolves.toBeUndefined();
    });

    it("accepts optional notes", async () => {
      await expect(dlq.resolve("some-id", "fixed manually")).resolves.toBeUndefined();
    });
  });

  // ───── markDead ─────

  describe("markDead", () => {
    it("does not throw on success", async () => {
      await expect(dlq.markDead("some-id")).resolves.toBeUndefined();
    });
  });

  // ───── getStats ─────

  describe("getStats", () => {
    it("returns zeroed stats on error", async () => {
      const client2 = stubClient({ selectResult: { data: null, error: { message: "fail" } } });
      const dlq2 = new DeadLetterQueue(client2);
      const stats = await dlq2.getStats();
      expect(stats).toEqual({ pending: 0, retrying: 0, resolved: 0, dead: 0, total: 0 });
    });

    it("counts entries by status", async () => {
      const rows = [
        { status: "pending" },
        { status: "pending" },
        { status: "retrying" },
        { status: "resolved" },
        { status: "dead" },
      ];
      const client2 = stubClient({ selectResult: { data: rows, error: null } });
      const dlq2 = new DeadLetterQueue(client2);
      const stats = await dlq2.getStats();
      expect(stats).toEqual({ pending: 2, retrying: 1, resolved: 1, dead: 1, total: 5 });
    });
  });

  // ───── retryAllPending ─────

  describe("retryAllPending", () => {
    it("returns count of retried entries", async () => {
      const updateResult = { data: [{ id: "1" }, { id: "2" }], error: null };
      const client2 = stubClient({ updateResult });
      const dlq2 = new DeadLetterQueue(client2);
      const count = await dlq2.retryAllPending();
      expect(count).toBe(2);
    });

    it("returns 0 on error", async () => {
      const client2 = stubClient({ updateResult: { data: null, error: { message: "fail" } } });
      const dlq2 = new DeadLetterQueue(client2);
      const count = await dlq2.retryAllPending();
      expect(count).toBe(0);
    });
  });
});
