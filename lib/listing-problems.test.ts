import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_DAYS,
  buildProblemReport,
  detectListingProblems,
  findDuplicateUrls,
  type ProblemCandidate,
} from "@/lib/listing-problems";

const now = new Date("2026-10-10T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400_000).toISOString();

function candidate(overrides: Partial<ProblemCandidate> = {}): ProblemCandidate {
  return {
    id: 1, productId: 1, title: "iPhone 13", price: 25000, source: "Sahibinden", url: "https://x.com/1",
    imageUrl: "https://x.com/1.jpg", status: "published", createdAt: daysAgo(2), lastSeenAt: daysAgo(1), ...overrides,
  };
}

const markets = new Map([[1, { average: 25000, count: 6 }]]);
const detect = (overrides: Partial<ProblemCandidate>) =>
  detectListingProblems(candidate(overrides), { markets, duplicateUrls: new Set(), now });

describe("detectListingProblems", () => {
  it("finds nothing wrong with a healthy listing", () => {
    expect(detect({})).toEqual([]);
  });

  it("flags missing price, url and image", () => {
    expect(detect({ price: 0 })).toContain("no_price");
    expect(detect({ price: Number.NaN })).toContain("no_price");
    expect(detect({ url: "  " })).toContain("no_url");
    expect(detect({ url: null })).toContain("no_url");
    expect(detect({ imageUrl: "" })).toContain("no_image");
  });

  it("flags a price at least 40% below the market, but not a merely good price", () => {
    expect(detect({ price: 14000 })).toContain("suspicious_cheap");
    expect(detect({ price: 20000 })).not.toContain("suspicious_cheap");
  });

  it("makes no price judgement without enough comparable listings", () => {
    const thin = new Map([[1, { average: 25000, count: 2 }]]);
    expect(detectListingProblems(candidate({ price: 5000 }), { markets: thin, duplicateUrls: new Set(), now })).toEqual([]);
    expect(detectListingProblems(candidate({ price: 5000, productId: 99 }), { markets, duplicateUrls: new Set(), now })).toEqual([]);
  });

  it("flags a live listing not seen for a long time, using created_at when never seen", () => {
    expect(detect({ lastSeenAt: daysAgo(STALE_AFTER_DAYS + 1) })).toContain("stale");
    expect(detect({ lastSeenAt: null, createdAt: daysAgo(STALE_AFTER_DAYS + 5) })).toContain("stale");
    expect(detect({ lastSeenAt: daysAgo(STALE_AFTER_DAYS - 1) })).not.toContain("stale");
  });

  it("does not call a pending listing stale", () => {
    expect(detect({ status: "pending", lastSeenAt: daysAgo(200) })).not.toContain("stale");
  });

  it("flags an address used by several listings", () => {
    const dup = detectListingProblems(candidate(), { markets, duplicateUrls: new Set(["https://x.com/1"]), now });
    expect(dup).toContain("duplicate_url");
  });
});

describe("findDuplicateUrls / buildProblemReport", () => {
  it("finds addresses that repeat, ignoring blanks and surrounding spaces", () => {
    const urls = findDuplicateUrls([{ url: "https://a" }, { url: " https://a " }, { url: "https://b" }, { url: null }, { url: "" }]);
    expect([...urls]).toEqual(["https://a"]);
  });

  it("reports only listings with problems and counts every kind", () => {
    const report = buildProblemReport(
      [
        candidate({ id: 1 }),
        candidate({ id: 2, price: 0, imageUrl: null, url: "https://x.com/2" }),
        candidate({ id: 3, price: 12000, url: "https://x.com/3" }),
        candidate({ id: 4, url: "https://x.com/3" }),
      ],
      markets,
      now,
    );
    expect(report.listings.map((l) => l.id)).toEqual([2, 3, 4]);
    expect(report.listings[0].problems).toEqual(["no_price", "no_image"]);
    expect(report.counts).toMatchObject({ no_price: 1, no_image: 1, suspicious_cheap: 1, duplicate_url: 2, no_url: 0, stale: 0 });
    expect(report).toMatchObject({ scanned: 4, partial: false });
  });
});
