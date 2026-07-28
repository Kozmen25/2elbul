import type { CircuitBreakerConfig, CircuitBreakerState, CircuitState } from "./types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const STALE_SNAPSHOT_MS = 5 * 60 * 1000;

interface CircuitBreakerSnapshotRow {
  source_slug: string;
  state: string;
  failure_count: number;
  trip_count: number;
  last_failure_at: string | null;
  last_success_at: string | null;
  opened_at: string | null;
  last_tested_at: string | null;
  next_attempt_at: string | null;
  updated_at: string;
}

const DEFAULT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  easycep: { failureThreshold: 5, halfOpenTimeoutMs: 30_000 },
  getmobil: { failureThreshold: 5, halfOpenTimeoutMs: 30_000 },
  "hepsiburada-yenilenmis": { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
  "teknosa-yenilenmis": { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
  "mediamarkt-yenilenmis": { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
  "yenilenmis-market": { failureThreshold: 5, halfOpenTimeoutMs: 30_000 },
  sahibinden: { failureThreshold: 3, halfOpenTimeoutMs: 45_000 },
  scrapingfish: { failureThreshold: 3, halfOpenTimeoutMs: 60_000 },
};

function createInitialState(slug: string): CircuitBreakerState {
  return {
    slug,
    state: "closed",
    failureCount: 0,
    tripCount: 0,
    lastFailureAt: null,
    openedAt: null,
    lastTestedAt: null,
  };
}

export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private states = new Map<string, CircuitBreakerState>();
  private configs: Record<string, CircuitBreakerConfig>;
  private supabase: SupabaseClient | null = null;
  private supabaseWarned = false;
  private hydrated = false;
  private hydrationPromise: Promise<void> | null = null;

  private constructor(configs?: Record<string, CircuitBreakerConfig>) {
    this.configs = configs ?? DEFAULT_CONFIGS;
  }

  static getInstance(
    configs?: Record<string, CircuitBreakerConfig>,
  ): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry(configs);
      CircuitBreakerRegistry.instance.hydrationPromise =
        CircuitBreakerRegistry.instance.hydrate();
    }
    return CircuitBreakerRegistry.instance;
  }

  /** Reset singleton — for testing only */
  static resetInstance(): void {
    (CircuitBreakerRegistry as any).instance = undefined;
  }

  private getStateInternal(slug: string): CircuitBreakerState {
    let state = this.states.get(slug);
    if (!state) {
      state = createInitialState(slug);
      this.states.set(slug, state);
    }
    return state;
  }

  isAvailable(slug: string): boolean {
    const s = this.getStateInternal(slug);
    if (s.state === "closed") return true;
    if (s.state === "open") {
      const elapsed = Date.now() - new Date(s.openedAt!).getTime();
      const config = this.configs[slug] ?? {
        failureThreshold: 3,
        halfOpenTimeoutMs: 60_000,
      };
      if (elapsed >= config.halfOpenTimeoutMs) {
        s.state = "half_open";
        s.lastTestedAt = new Date().toISOString();
        this.persistState(slug);
        return true;
      }
      return false;
    }
    // half_open — allow trial request
    return true;
  }

  recordSuccess(slug: string): void {
    const s = this.getStateInternal(slug);
    s.failureCount = 0;
    if (s.state === "half_open") {
      s.state = "closed";
      s.openedAt = null;
    }
    this.persistState(slug);
  }

  recordFailure(slug: string): void {
    const s = this.getStateInternal(slug);
    s.failureCount++;
    s.lastFailureAt = new Date().toISOString();
    const config = this.configs[slug] ?? {
      failureThreshold: 3,
      halfOpenTimeoutMs: 60_000,
    };
    if (s.failureCount >= config.failureThreshold && s.state !== "open") {
      s.state = "open";
      s.tripCount++;
      s.openedAt = new Date().toISOString();
    }
    this.persistState(slug);
  }

  reset(slug: string): void {
    const s = this.getStateInternal(slug);
    s.state = "closed";
    s.failureCount = 0;
    s.openedAt = null;
    s.lastFailureAt = null;
    s.lastTestedAt = null;
    this.persistState(slug);
  }

  getState(slug: string): CircuitBreakerState {
    return { ...this.getStateInternal(slug) };
  }

  getAllStates(): CircuitBreakerState[] {
    const slugs = Object.keys(this.configs);
    return slugs.map((slug) => this.getState(slug));
  }

  // ─── Supabase Persistence ────────────────────────────────────────────────

  private getSupabaseClient(): SupabaseClient | null {
    if (!this.supabase) {
      this.supabase = createSupabaseAdminClient();
      if (!this.supabase && !this.supabaseWarned) {
        this.supabaseWarned = true;
        console.warn(
          "[CircuitBreakerRegistry] Supabase admin client not available — persistence disabled",
        );
      }
    }
    return this.supabase;
  }

  /**
   * Await before first access to ensure hydrated state is loaded.
   * Used by tests and callers that need guaranteed fresh state.
   */
  async awaitHydration(): Promise<void> {
    await this.hydrationPromise;
  }

  /**
   * Hydrate circuit breaker states from Supabase on startup.
   * Stale snapshots (>5 min old) reset to closed state.
   */
  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;

    const supabase = this.getSupabaseClient();
    if (!supabase) return;

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("circuit_breaker_snapshots")
      .select("*");

    if (error) {
      console.error("[CircuitBreakerRegistry] hydrate failed:", error.message);
      return;
    }

    if (!data || !Array.isArray(data)) return;

    const rows = data as CircuitBreakerSnapshotRow[];
    const staleCutoff = Date.now() - STALE_SNAPSHOT_MS;

    for (const row of rows) {
      const updatedMs = new Date(row.updated_at).getTime();
      const isStale = updatedMs < staleCutoff;

      if (isStale) {
        // Reset stale snapshots to closed — don't carry forward old failures
        this.states.set(row.source_slug, createInitialState(row.source_slug));
        await supabase
          .from("circuit_breaker_snapshots")
          .update({
            state: "closed",
            failure_count: 0,
            last_failure_at: null,
            opened_at: null,
            updated_at: now,
          })
          .eq("source_slug", row.source_slug);
        continue;
      }

      this.states.set(row.source_slug, {
        slug: row.source_slug,
        state: row.state as CircuitState,
        failureCount: row.failure_count,
        tripCount: row.trip_count,
        lastFailureAt: row.last_failure_at,
        openedAt: row.opened_at,
        lastTestedAt: row.last_tested_at,
      });
    }
  }

  /**
   * Fire-and-forget upsert of current circuit breaker state to Supabase.
   * Never throws — logs and swallows errors.
   */
  private persistState(slug: string): void {
    const supabase = this.getSupabaseClient();
    if (!supabase) return;

    const s = this.states.get(slug);
    if (!s) return;

    const now = new Date().toISOString();
    const nextAttemptAt =
      s.state === "open" && s.openedAt
        ? new Date(
            new Date(s.openedAt).getTime() +
              (this.configs[slug]?.halfOpenTimeoutMs ?? 60_000),
          ).toISOString()
        : null;

    Promise.resolve(
      supabase
        .from("circuit_breaker_snapshots")
        .upsert(
          {
            source_slug: slug,
            state: s.state,
            failure_count: s.failureCount,
            trip_count: s.tripCount,
            last_failure_at: s.lastFailureAt,
            last_success_at: s.failureCount === 0 && s.state === "closed" ? now : null,
            opened_at: s.openedAt,
            last_tested_at: s.lastTestedAt,
            next_attempt_at: nextAttemptAt,
            updated_at: now,
          },
          { onConflict: "source_slug" },
        )
    )
      .then(() => {})
      .catch((err: unknown) => {
        console.error(
          "[CircuitBreakerRegistry] persistState failed:",
          err instanceof Error ? err.message : String(err),
        );
      });
  }
}
