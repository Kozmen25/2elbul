import { describe, it, expect, beforeEach, vi } from "vitest";
import { SupabaseAlertStore } from "./supabase-alert-store";
import type { Alert } from "./types";

const { createSupabaseAdminClientMock } = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "alert-1",
    type: "consecutive_failures",
    severity: "critical",
    status: "active",
    title: "[CRITICAL] Consecutive Failures — test-source",
    message: "Test message",
    sourceId: 1,
    sourceName: "test-source",
    metadata: { foo: "bar" },
    triggeredAt: new Date().toISOString(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    expiresAt: null,
    count: 1,
    ...overrides,
  };
}

describe("SupabaseAlertStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Graceful fallback
  // -----------------------------------------------------------------------

  it("graceful fallback when client is unavailable — save is no-op", async () => {
    createSupabaseAdminClientMock.mockReturnValue(null);

    const store = new SupabaseAlertStore();
    await expect(store.save(makeAlert())).resolves.not.toThrow();
  });

  it("graceful fallback when client is unavailable — list returns []", async () => {
    createSupabaseAdminClientMock.mockReturnValue(null);

    const store = new SupabaseAlertStore();
    const result = await store.list();
    expect(result).toEqual([]);
  });

  it("graceful fallback when client is unavailable — acknowledge is no-op", async () => {
    createSupabaseAdminClientMock.mockReturnValue(null);

    const store = new SupabaseAlertStore();
    await expect(store.acknowledge("alert-1", "admin")).resolves.not.toThrow();
  });

  it("graceful fallback when client is unavailable — resolve is no-op", async () => {
    createSupabaseAdminClientMock.mockReturnValue(null);

    const store = new SupabaseAlertStore();
    await expect(store.resolve("alert-1")).resolves.not.toThrow();
  });

  it("graceful fallback when client is unavailable — getActive returns []", async () => {
    createSupabaseAdminClientMock.mockReturnValue(null);

    const store = new SupabaseAlertStore();
    const result = await store.getActive();
    expect(result).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // save
  // -----------------------------------------------------------------------

  it("save upserts to alert_snapshots with correct field mapping", async () => {
    const upsertMock = vi.fn((_row: any) => ({ error: null })).mockResolvedValue({ error: null });
    const fromMock = vi.fn(() => ({ upsert: upsertMock }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const alert = makeAlert({
      id: "alert-42",
      sourceId: 7,
      sourceName: "easycep",
      metadata: { key: "val" },
      triggeredAt: "2026-07-19T12:00:00.000Z",
    });

    const store = new SupabaseAlertStore();
    await store.save(alert);

    expect(fromMock).toHaveBeenCalledWith("alert_snapshots");
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const row = (upsertMock.mock.calls[0] as any)[0];
    expect(row).toMatchObject({
      id: "alert-42",
      type: "consecutive_failures",
      severity: "critical",
      status: "active",
      title: "[CRITICAL] Consecutive Failures — test-source",
      message: "Test message",
      source_id: 7,
      source_name: "easycep",
      metadata: { key: "val" },
      triggered_at: "2026-07-19T12:00:00.000Z",
      acknowledged_at: null,
      acknowledged_by: null,
      resolved_at: null,
      expires_at: null,
      count: 1,
    });
    expect((upsertMock.mock.calls[0] as any)[1]).toEqual({ onConflict: "id" });
  });

  it("save logs error but does not throw on DB error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const upsertMock = vi.fn().mockResolvedValue({ error: new Error("DB down") });
    const fromMock = vi.fn(() => ({ upsert: upsertMock }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const store = new SupabaseAlertStore();
    await expect(store.save(makeAlert())).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[SupabaseAlertStore] save failed:",
      "DB down",
    );
    consoleSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // list
  // -----------------------------------------------------------------------

  it("list returns mapped rows from alert_snapshots", async () => {
    const rows = [
      {
        id: "a1",
        type: "consecutive_failures",
        severity: "critical",
        status: "active",
        title: "[CRITICAL] Failure — src",
        message: "Test alert",
        source_id: 1,
        source_name: "src",
        metadata: {},
        triggered_at: "2026-07-19T12:00:00.000Z",
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        expires_at: null,
        count: 1,
      },
    ];
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const store = new SupabaseAlertStore();
    const result = await store.list();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
    expect(result[0].sourceId).toBe(1);
    expect(result[0].triggeredAt).toBe("2026-07-19T12:00:00.000Z");
  });

  it("list applies filters via eq() calls", async () => {
    let eqCalls: { column: string; value: unknown }[] = [];
    const eqMock = vi.fn((col: string, val: unknown) => {
      eqCalls.push({ column: col, value: val });
      return builder;
    });
    const rangeMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: eqMock,
      range: rangeMock,
    };
    createSupabaseAdminClientMock.mockReturnValue({ from: vi.fn(() => builder) });

    const store = new SupabaseAlertStore();
    await store.list({
      type: "consecutive_failures",
      severity: "critical",
      status: "active",
      sourceId: 5,
    });

    expect(eqCalls).toContainEqual({ column: "type", value: "consecutive_failures" });
    expect(eqCalls).toContainEqual({ column: "severity", value: "critical" });
    expect(eqCalls).toContainEqual({ column: "status", value: "active" });
    expect(eqCalls).toContainEqual({ column: "source_id", value: 5 });
  });

  it("list applies default pagination (limit=50, offset=0)", async () => {
    const rangeMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: rangeMock,
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const store = new SupabaseAlertStore();
    await store.list();

    expect(rangeMock).toHaveBeenCalledWith(0, 49);
  });

  it("list applies custom limit/offset via range", async () => {
    const rangeMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: rangeMock,
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const store = new SupabaseAlertStore();
    await store.list({ limit: 10, offset: 20 });

    expect(rangeMock).toHaveBeenCalledWith(20, 29);
  });

  it("list returns [] on DB error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: new Error("timeout") }),
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const store = new SupabaseAlertStore();
    const result = await store.list();
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // acknowledge
  // -----------------------------------------------------------------------

  it("acknowledge updates status with acknowledged_by and timestamp", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({
      update: updateMock,
      eq: eqMock,
    }));
    // Override: acknowledge chains update().eq("id", id).eq("status", "active")
    const eqIdMock = vi.fn().mockReturnThis();
    const eqStatusMock = vi.fn().mockResolvedValue({ error: null });
    const updateAckMock = vi.fn(() => ({ eq: eqIdMock }));
    eqIdMock.mockReturnValue({ eq: eqStatusMock });
    createSupabaseAdminClientMock.mockReturnValue({ from: vi.fn(() => ({ update: updateAckMock })) });

    const store = new SupabaseAlertStore();
    await store.acknowledge("alert-1", "operator");

    expect(updateAckMock).toHaveBeenCalledTimes(1);
    const updateArg = (updateAckMock.mock.calls[0] as any)[0];
    expect(updateArg.status).toBe("acknowledged");
    expect(updateArg.acknowledged_by).toBe("operator");
    expect(updateArg.acknowledged_at).toBeDefined();
    expect(eqIdMock).toHaveBeenCalledWith("id", "alert-1");
    expect(eqStatusMock).toHaveBeenCalledWith("status", "active");
  });

  // -----------------------------------------------------------------------
  // resolve
  // -----------------------------------------------------------------------

  it("resolve updates status with resolved_at timestamp", async () => {
    const eqIdMock = vi.fn().mockReturnThis();
    const inStatusMock = vi.fn().mockResolvedValue({ error: null });
    const updateResMock = vi.fn(() => ({ eq: eqIdMock }));
    eqIdMock.mockReturnValue({ in: inStatusMock });
    createSupabaseAdminClientMock.mockReturnValue({ from: vi.fn(() => ({ update: updateResMock })) });

    const store = new SupabaseAlertStore();
    await store.resolve("alert-1");

    expect(updateResMock).toHaveBeenCalledTimes(1);
    const updateArg = (updateResMock.mock.calls[0] as any)[0];
    expect(updateArg.status).toBe("resolved");
    expect(updateArg.resolved_at).toBeDefined();
    expect(eqIdMock).toHaveBeenCalledWith("id", "alert-1");
    expect(inStatusMock).toHaveBeenCalledWith("status", ["active", "acknowledged"]);
  });

  // -----------------------------------------------------------------------
  // getActive
  // -----------------------------------------------------------------------

  it("getActive filters by active/acknowledged statuses", async () => {
    const rows = [
      {
        id: "a1",
        type: "consecutive_failures",
        severity: "critical",
        status: "active",
        title: "Alert 1",
        message: "msg",
        source_id: null,
        source_name: null,
        metadata: {},
        triggered_at: "2026-07-19T12:00:00.000Z",
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        expires_at: null,
        count: 1,
      },
    ];
    const inMock = vi.fn().mockReturnThis();
    const orderMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      in: inMock,
      order: orderMock,
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const store = new SupabaseAlertStore();
    const result = await store.getActive();

    expect(inMock).toHaveBeenCalledWith("status", ["active", "acknowledged"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
    expect(result[0].status).toBe("active");
  });

  it("getActive returns [] on DB error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: new Error("fail") }),
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const store = new SupabaseAlertStore();
    const result = await store.getActive();
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });

  it("getActive returns mapped rows", async () => {
    const rows = [
      {
        id: "a2",
        type: "timeout",
        severity: "warning",
        status: "acknowledged",
        title: "[WARNING] Timeout — src",
        message: "Slow response",
        source_id: 2,
        source_name: "src",
        metadata: { avgMs: 45000 },
        triggered_at: "2026-07-19T13:00:00.000Z",
        acknowledged_at: "2026-07-19T13:05:00.000Z",
        acknowledged_by: "admin",
        resolved_at: null,
        expires_at: null,
        count: 3,
      },
    ];
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const store = new SupabaseAlertStore();
    const result = await store.getActive();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a2");
    expect(result[0].severity).toBe("warning");
    expect(result[0].status).toBe("acknowledged");
    expect(result[0].sourceId).toBe(2);
    expect(result[0].acknowledgedAt).toBe("2026-07-19T13:05:00.000Z");
    expect(result[0].acknowledgedBy).toBe("admin");
    expect(result[0].count).toBe(3);
  });
});
