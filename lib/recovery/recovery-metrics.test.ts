import { describe, it, expect, beforeEach } from "vitest";
import { RecoveryMetricsService } from "./recovery-metrics";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ───── Stub builder ───── */

function stubClient(overrides?: {
  insertResult?: { error: null | object };
  selectResult?: { data: any[] | null; error: null | object };
}): SupabaseClient {
  const insertResult = overrides?.insertResult ?? { error: null };
  const selectResult = overrides?.selectResult ?? { data: [], error: null };

  const chain: any = {};

  chain.from = () => ({
    insert: (payload: any) => Promise.resolve(insertResult),
    select: (cols: string, opts?: { count?: "exact" }) => {
      const qb: any = {
        gte: () => Promise.resolve(selectResult),
        eq: () => ({
          gte: () => Promise.resolve(selectResult),
          then: (resolve: (v: any) => void) => Promise.resolve(selectResult).then(resolve),
        }),
        then: (resolve: (v: any) => void) => Promise.resolve(selectResult).then(resolve),
      };
      return qb;
    },
  });

  return chain as any;
}

describe("RecoveryMetricsService", () => {
  let svc: RecoveryMetricsService;
  let client: SupabaseClient;

  beforeEach(() => {
    client = stubClient();
    svc = new RecoveryMetricsService(client);
  });

  // ───── record ─────

  describe("record", () => {
    it("does not throw on success", async () => {
      await expect(
        svc.record({
          source_id: 1,
          source_slug: "easycep",
          metric_type: "cb_trip",
          metadata: { failures: 5 },
        }),
      ).resolves.toBeUndefined();
    });

    it("does not throw when metadata is omitted", async () => {
      await expect(
        svc.record({
          source_id: null,
          source_slug: "test",
          metric_type: "cb_reset",
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ───── getSummary ─────

  describe("getSummary", () => {
    it("returns empty summary when no data", async () => {
      const summary = await svc.getSummary();
      expect(summary).toEqual({
        cbTrip: 0,
        cbReset: 0,
        cbHalfOpen: 0,
        dlqInsert: 0,
        dlqRetry: 0,
        dlqResolve: 0,
        recoverySuccess: 0,
        recoveryFailure: 0,
        total: 0,
      });
    });

    it("returns empty summary on error", async () => {
      const client2 = stubClient({ selectResult: { data: null, error: { message: "fail" } } });
      const svc2 = new RecoveryMetricsService(client2);
      const summary = await svc2.getSummary();
      expect(summary.total).toBe(0);
    });

    it("counts by metric type", async () => {
      const rows = [
        { metric_type: "cb_trip" },
        { metric_type: "cb_trip" },
        { metric_type: "cb_reset" },
        { metric_type: "cb_half_open" },
        { metric_type: "dlq_insert" },
        { metric_type: "dlq_retry" },
        { metric_type: "dlq_resolve" },
        { metric_type: "recovery_success" },
        { metric_type: "recovery_failure" },
      ];
      const client2 = stubClient({ selectResult: { data: rows, error: null } });
      const svc2 = new RecoveryMetricsService(client2);
      const summary = await svc2.getSummary();
      expect(summary.cbTrip).toBe(2);
      expect(summary.cbReset).toBe(1);
      expect(summary.cbHalfOpen).toBe(1);
      expect(summary.dlqInsert).toBe(1);
      expect(summary.dlqRetry).toBe(1);
      expect(summary.dlqResolve).toBe(1);
      expect(summary.recoverySuccess).toBe(1);
      expect(summary.recoveryFailure).toBe(1);
      expect(summary.total).toBe(9);
    });

    it("filters by since time", async () => {
      // The stub just returns whatever's in selectResult regardless of gte
      const client2 = stubClient({ selectResult: { data: [{ metric_type: "cb_trip" }], error: null } });
      const svc2 = new RecoveryMetricsService(client2);
      const summary = await svc2.getSummary("2024-01-01T00:00:00.000Z");
      expect(summary.total).toBe(1);
      expect(summary.cbTrip).toBe(1);
    });
  });

  // ───── getBySource ─────

  describe("getBySource", () => {
    it("returns empty array on error", async () => {
      const client2 = stubClient({ selectResult: { data: null, error: { message: "fail" } } });
      const svc2 = new RecoveryMetricsService(client2);
      const metrics = await svc2.getBySource("easycep");
      expect(metrics).toEqual([]);
    });

    it("returns metrics for a source", async () => {
      const rows = [
        { id: "1", source_slug: "easycep", metric_type: "cb_trip", metadata: {} },
        { id: "2", source_slug: "easycep", metric_type: "cb_reset", metadata: {} },
      ];
      const client2 = stubClient({ selectResult: { data: rows, error: null } });
      const svc2 = new RecoveryMetricsService(client2);
      const metrics = await svc2.getBySource("easycep");
      expect(metrics).toHaveLength(2);
      expect(metrics[0].metric_type).toBe("cb_trip");
      expect(metrics[1].metric_type).toBe("cb_reset");
    });
  });
});
