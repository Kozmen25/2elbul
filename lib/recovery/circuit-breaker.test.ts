import { describe, it, expect, beforeEach, vi } from "vitest";
import { CircuitBreakerRegistry } from "./circuit-breaker";

const { createSupabaseAdminClientMock } = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

describe("CircuitBreakerRegistry", () => {
  beforeEach(() => {
    CircuitBreakerRegistry.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------
  it("is a singleton", () => {
    expect(CircuitBreakerRegistry.getInstance()).toBe(
      CircuitBreakerRegistry.getInstance(),
    );
  });

  it("resetInstance clears the singleton", () => {
    const a = CircuitBreakerRegistry.getInstance({ test: { failureThreshold: 1, halfOpenTimeoutMs: 100 } });
    CircuitBreakerRegistry.resetInstance();
    const b = CircuitBreakerRegistry.getInstance();
    expect(a).not.toBe(b);
  });

  // -----------------------------------------------------------------------
  // Default configs for known sources
  // -----------------------------------------------------------------------
  it.each([
    ["easycep", 5, 30_000],
    ["getmobil", 5, 30_000],
    ["hepsiburada-yenilenmis", 3, 60_000],
    ["teknosa-yenilenmis", 3, 60_000],
    ["mediamarkt-yenilenmis", 3, 60_000],
    ["yenilenmis-market", 5, 30_000],
    ["sahibinden", 3, 45_000],
  ])("has config for %s: threshold=%i, timeout=%i", (slug, threshold) => {
    const cb = CircuitBreakerRegistry.getInstance();
    // threshold-1 failures stay closed
    for (let i = 0; i < threshold - 1; i++) {
      cb.recordFailure(slug);
    }
    expect(cb.getState(slug).state).toBe("closed");

    // threshold-th failure trips open
    cb.recordFailure(slug);
    expect(cb.getState(slug).state).toBe("open");
    expect(cb.getState(slug).tripCount).toBe(1);
  });

  // -----------------------------------------------------------------------
  // State transitions: closed -> open -> half_open -> closed
  // -----------------------------------------------------------------------
  it("starts closed with zero failures", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });
    const s = cb.getState("mysource");
    expect(s.state).toBe("closed");
    expect(s.failureCount).toBe(0);
  });

  it("transitions to open after failureThreshold failures", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });

    cb.recordFailure("mysource");
    expect(cb.getState("mysource").state).toBe("closed");

    cb.recordFailure("mysource");
    expect(cb.getState("mysource").state).toBe("closed");

    cb.recordFailure("mysource");
    expect(cb.getState("mysource").state).toBe("open");
    expect(cb.getState("mysource").tripCount).toBe(1);
  });

  it("tracks failure count until threshold", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });

    cb.recordFailure("mysource");
    expect(cb.getState("mysource").failureCount).toBe(1);

    cb.recordFailure("mysource");
    expect(cb.getState("mysource").failureCount).toBe(2);

    cb.recordFailure("mysource");
    expect(cb.getState("mysource").failureCount).toBe(3);
  });

  it("sets openedAt when tripping", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 60_000 },
    });

    cb.recordFailure("mysource");
    expect(cb.getState("mysource").openedAt).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // isAvailable
  // -----------------------------------------------------------------------
  it("returns true when closed", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });
    expect(cb.isAvailable("mysource")).toBe(true);
  });

  it("returns false when open and timeout has not elapsed", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 60_000 },
    });
    cb.recordFailure("mysource");
    expect(cb.isAvailable("mysource")).toBe(false);
  });

  it("returns true when open but timeout has elapsed (transitions to half_open)", async () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 10 },
    });
    cb.recordFailure("mysource");
    expect(cb.isAvailable("mysource")).toBe(false);

    // Wait for timeout to pass
    await new Promise((r) => setTimeout(r, 15));

    expect(cb.isAvailable("mysource")).toBe(true);
    expect(cb.getState("mysource").state).toBe("half_open");
    expect(cb.getState("mysource").lastTestedAt).not.toBeNull();
  });

  it("returns true when half_open (uses real timeout)", async () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 10 },
    });
    cb.recordFailure("mysource");
    expect(cb.getState("mysource").state).toBe("open");

    // Wait past timeout — isAvailable transitions to half_open automatically
    await new Promise((r) => setTimeout(r, 20));

    expect(cb.isAvailable("mysource")).toBe(true);
    expect(cb.getState("mysource").state).toBe("half_open");
  });

  // -----------------------------------------------------------------------
  // recordSuccess
  // -----------------------------------------------------------------------
  it("resets failure count on success", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });
    cb.recordFailure("mysource");
    cb.recordFailure("mysource");
    cb.recordSuccess("mysource");
    expect(cb.getState("mysource").failureCount).toBe(0);
    expect(cb.getState("mysource").state).toBe("closed");
  });

  it("transitions half_open -> closed on success and clears openedAt", async () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 10 },
    });
    cb.recordFailure("mysource"); // trips open
    expect(cb.getState("mysource").state).toBe("open");

    // Wait past timeout to transition to half_open
    await new Promise((r) => setTimeout(r, 20));
    cb.isAvailable("mysource"); // triggers half_open transition
    expect(cb.getState("mysource").state).toBe("half_open");
    expect(cb.getState("mysource").openedAt).not.toBeNull();

    cb.recordSuccess("mysource"); // half_open + success → closed
    expect(cb.getState("mysource").state).toBe("closed");
    expect(cb.getState("mysource").openedAt).toBeNull();
  });

  // -----------------------------------------------------------------------
  // recordFailure additional edge cases
  // -----------------------------------------------------------------------
  it("does not double-trip when already open", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 60_000 },
    });
    cb.recordFailure("mysource"); // trips
    expect(cb.getState("mysource").tripCount).toBe(1);

    cb.recordFailure("mysource"); // already open
    expect(cb.getState("mysource").state).toBe("open");
    expect(cb.getState("mysource").tripCount).toBe(1); // no double-trip
  });

  it("sets lastFailureAt on failure", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 60_000 },
    });
    expect(cb.getState("mysource").lastFailureAt).toBeNull();
    cb.recordFailure("mysource");
    expect(cb.getState("mysource").lastFailureAt).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // reset
  // -----------------------------------------------------------------------
  it("reset restores state to closed", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 60_000 },
    });
    cb.recordFailure("mysource"); // trips
    expect(cb.getState("mysource").state).toBe("open");

    cb.reset("mysource");
    const s = cb.getState("mysource");
    expect(s.state).toBe("closed");
    expect(s.failureCount).toBe(0);
    expect(s.openedAt).toBeNull();
    expect(s.lastFailureAt).toBeNull();
    expect(s.lastTestedAt).toBeNull();
  });

  // -----------------------------------------------------------------------
  // getAllStates
  // -----------------------------------------------------------------------
  it("returns states for all configured sources", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      a: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
      b: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });
    const states = cb.getAllStates();
    expect(states).toHaveLength(2);
    const slugs = states.map((s) => s.slug).sort();
    expect(slugs).toEqual(["a", "b"]);
  });

  it("returns copies, not references", () => {
    const cb = CircuitBreakerRegistry.getInstance({
      x: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });
    const s1 = cb.getState("x");
    const s2 = cb.getState("x");
    s1.failureCount = 99;
    expect(s2.failureCount).toBe(0); // should not mutate internal state via returned copy
  });

  // -----------------------------------------------------------------------
  // Unknown sources (no config)
  // -----------------------------------------------------------------------
  it("uses default config for unknown sources (threshold=3, timeout=60s)", () => {
    const cb = CircuitBreakerRegistry.getInstance({});
    // No config for "unknown-source", should use default {threshold:3, timeout:60000}
    cb.recordFailure("unknown-source");
    cb.recordFailure("unknown-source");
    expect(cb.getState("unknown-source").state).toBe("closed");
    cb.recordFailure("unknown-source");
    expect(cb.getState("unknown-source").state).toBe("open");
  });
});

// -----------------------------------------------------------------------
// Supabase persistence (Phase 2 — C3)
// -----------------------------------------------------------------------

describe("Supabase persistence", () => {
  beforeEach(() => {
    CircuitBreakerRegistry.resetInstance();
    vi.clearAllMocks();
  });

  it("graceful fallback when Supabase client is unavailable", () => {
    createSupabaseAdminClientMock.mockReturnValue(null);

    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 60_000 },
    });
    expect(() => {
      cb.recordFailure("mysource");
      cb.recordSuccess("mysource");
      cb.reset("mysource");
      cb.isAvailable("mysource");
    }).not.toThrow();
  });

  it("persists failure state to circuit_breaker_snapshots", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: upsertMock,
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 60_000 },
    });
    await cb.awaitHydration();

    cb.recordFailure("mysource");

    // Allow the fire-and-forget promise to settle
    await vi.waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1);
    });

    const row = (upsertMock.mock.calls[0] as any)[0];
    expect(row.source_slug).toBe("mysource");
    expect(row.state).toBe("open");
    expect(row.failure_count).toBe(1);
    expect(row.trip_count).toBe(1);
    expect(row.opened_at).not.toBeNull();
  });

  it("persists reset state via upsert", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: upsertMock,
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 1, halfOpenTimeoutMs: 60_000 },
    });
    await cb.awaitHydration();

    cb.recordFailure("mysource");
    // Clear the persistState call from recordFailure
    upsertMock.mockClear();

    cb.reset("mysource");
    await vi.waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1);
    });

    const row = (upsertMock.mock.calls[0] as any)[0];
    expect(row.source_slug).toBe("mysource");
    expect(row.state).toBe("closed");
    expect(row.failure_count).toBe(0);
    expect(row.opened_at).toBeNull();
    expect(row.next_attempt_at).toBeNull();
  });

  it("hydrates state from existing snapshots on startup", async () => {
    const freshSnapshot = {
      source_slug: "mysource",
      state: "open",
      failure_count: 3,
      trip_count: 2,
      last_failure_at: new Date().toISOString(),
      opened_at: new Date().toISOString(),
      last_tested_at: null,
      updated_at: new Date().toISOString(),
    };
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [freshSnapshot], error: null }),
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });
    await cb.awaitHydration();

    const state = cb.getState("mysource");
    expect(state.state).toBe("open");
    expect(state.failureCount).toBe(3);
    expect(state.tripCount).toBe(2);
  });

  it("resets stale snapshots (>5 min old) to closed state", async () => {
    const staleDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const staleSnapshot = {
      source_slug: "mysource",
      state: "open",
      failure_count: 5,
      trip_count: 2,
      last_failure_at: staleDate,
      opened_at: staleDate,
      last_tested_at: null,
      updated_at: staleDate,
    };
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [staleSnapshot], error: null }),
      update: updateMock,
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });
    await cb.awaitHydration();

    // Stale snapshot should be reset to closed in memory
    const state = cb.getState("mysource");
    expect(state.state).toBe("closed");
    expect(state.failureCount).toBe(0);
    expect(state.tripCount).toBe(0);

    // Should have called update on stale row
    expect(updateMock).toHaveBeenCalled();
    expect(updateEqMock).toHaveBeenCalledWith("source_slug", "mysource");
  });

  it("handles empty snapshot table cleanly", async () => {
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));
    createSupabaseAdminClientMock.mockReturnValue({ from: fromMock });

    const cb = CircuitBreakerRegistry.getInstance({
      mysource: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
    });
    await cb.awaitHydration();

    const state = cb.getState("mysource");
    expect(state.state).toBe("closed");
    expect(state.failureCount).toBe(0);
  });
});
