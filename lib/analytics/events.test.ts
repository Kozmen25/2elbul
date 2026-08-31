import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { classifyDevice, classifyTrafficSource, recordEvent } from "./events";

describe("classifyDevice — coarse category only, never the UA string", () => {
  it("classifies mobile agents", () => {
    expect(classifyDevice("Mozilla iPhone; like Gecko")).toBe("mobile");
    expect(classifyDevice("Android 13 Mobile Safari")).toBe("mobile");
  });

  it("classifies tablet agents", () => {
    expect(classifyDevice("iPad Safari")).toBe("tablet");
    expect(classifyDevice("Android Tablet")).toBe("tablet");
  });

  it("classifies desktop agents", () => {
    expect(classifyDevice("Mozilla/5.0 (Windows NT 10.0) Chrome")).toBe("desktop");
  });

  it("returns null when the header is absent", () => {
    expect(classifyDevice(null)).toBeNull();
  });
});

describe("classifyTrafficSource — coarse bucket from the referer hostname", () => {
  it("defaults to direct", () => {
    expect(classifyTrafficSource(null)).toBe("direct");
    expect(classifyTrafficSource("not a url")).toBe("direct");
  });

  it("buckets Google / Bing search", () => {
    expect(classifyTrafficSource("https://www.google.com/search?q=iphone")).toBe("google");
    expect(classifyTrafficSource("https://www.bing.com/search")).toBe("google");
  });

  it("buckets social networks", () => {
    expect(classifyTrafficSource("https://facebook.com/post")).toBe("social");
    expect(classifyTrafficSource("https://x.com/status/1")).toBe("social");
  });

  it("buckets other search engines", () => {
    expect(classifyTrafficSource("https://duckduckgo.com/?q=x")).toBe("search");
  });

  it("buckets organic referrers", () => {
    expect(classifyTrafficSource("https://friend.example.com/link")).toBe("referral");
  });
});

describe("recordEvent — fire-and-forget, coarse payload only", () => {
  it("inserts only coarse categories, never the raw UA or referer", async () => {
    let inserted: unknown;
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(async (rows: unknown) => {
          inserted = rows;
          return { error: null };
        }),
      })),
    } as unknown as SupabaseClient;

    const headers = new Headers({
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
      referer: "https://www.google.com/search?q=iphone",
    });

    await recordEvent(client, { eventName: "SEARCH", userId: "u-1", searchQuery: "iphone 15", headers });

    expect(inserted).toEqual({
      event_name: "SEARCH",
      user_id: "u-1",
      path: null,
      search_query: "iphone 15",
      traffic_source: "google",
      device_type: "mobile",
    });
    expect(clientFromInsert(client)).not.toMatch(/iPhone|google\.com/);
  });

  it("records null identity when no user is known", async () => {
    let inserted: unknown;
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(async (rows: unknown) => {
          inserted = rows;
          return { error: null };
        }),
      })),
    } as unknown as SupabaseClient;

    await recordEvent(client, { eventName: "LOGIN" });

    expect(inserted).toMatchObject({
      event_name: "LOGIN",
      user_id: null,
      traffic_source: "direct",
      device_type: null,
    });
  });

  it("never throws when the DB write fails — analytics can't break the caller", async () => {
    const throwingClient = {
      from: vi.fn(() => ({
        insert: vi.fn(async () => {
          throw new Error("db failed");
        }),
      })),
    } as unknown as SupabaseClient;
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});

    await expect(
      recordEvent(throwingClient, { eventName: "SEARCH", userId: "u-1" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it("is a no-op without a client or event name", async () => {
    await expect(recordEvent(null, { eventName: "SEARCH" })).resolves.toBeUndefined();
    const client = {
      from: vi.fn(),
    } as unknown as SupabaseClient;
    await expect(recordEvent(client, { eventName: "" })).resolves.toBeUndefined();
    expect(client.from).not.toHaveBeenCalled();
  });
});

function clientFromInsert(client: SupabaseClient): string {
  const from = client.from as ReturnType<typeof vi.fn>;
  const insert = from.mock.results[0].value.insert;
  return JSON.stringify(insert.mock.calls[0][0]);
}
