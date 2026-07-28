type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 60_000;
const MAX_ENTRIES = 500;

// Periodic cleanup every 60s to prevent memory leaks
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
    if (store.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 60_000);
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    // Evict oldest expired entries first
    const now = Date.now();
    let evicted = 0;
    for (const [k, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(k);
        evicted++;
      }
    }
    // If still over limit, delete oldest by iteration order (Map preserves insertion order)
    if (store.size >= MAX_ENTRIES) {
      const iterator = store.keys();
      while (store.size >= MAX_ENTRIES) {
        const next = iterator.next();
        if (next.done) break;
        store.delete(next.value);
      }
    }
  }
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  ensureCleanup();
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheClear(): void {
  store.clear();
}

export function cacheKeys(): string[] {
  return [...store.keys()];
}

/** Build a deterministic cache key from an object. Sort keys for stability. */
export function cacheKeyFrom(obj: Record<string, unknown>): string {
  const sorted = Object.keys(obj).sort().map((k) => `${k}:${JSON.stringify(obj[k])}`);
  return sorted.join("|");
}
