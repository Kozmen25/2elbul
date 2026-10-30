import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const outbound = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/listing-availability/outbound", () => ({
  parseListingId: (value: string) => (/^\d+$/.test(value) ? Number(value) : null),
  resolveListingOutbound: async () => outbound.value,
}));

const { GET } = await import("./route");

function call(id: string) {
  // Behind nginx the app sees its internal address, not the public domain.
  return GET(new NextRequest(`http://127.0.0.1:3217/git/${id}`), { params: Promise.resolve({ id }) });
}

describe("GET /git/[id]", () => {
  it("forwards a live listing straight to its source page", async () => {
    outbound.value = { kind: "live", url: "https://www.getmobil.com/ilan/1" };
    const response = await call("1");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://www.getmobil.com/ilan/1");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("sends a dead listing to the gone page with a relative, host-independent address", async () => {
    outbound.value = { kind: "gone", title: null, source: null, reason: null, product: null, alternatives: [] };
    const response = await call("2");
    expect(response.headers.get("location")).toBe("/ilan-yayinda-degil/2");
  });

  it("treats an invalid id as gone", async () => {
    const response = await call("abc");
    expect(response.headers.get("location")).toBe("/ilan-yayinda-degil/abc");
  });
});
