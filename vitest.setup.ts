import { vi } from "vitest";

// next/cache needs the Next.js runtime. In unit tests cached functions run
// straight through and invalidation is a no-op.
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

// server-only throws outside the React server runtime; tests exercise server modules directly.
vi.mock("server-only", () => ({}));
