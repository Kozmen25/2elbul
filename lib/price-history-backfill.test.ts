import { describe, expect, it } from "vitest";
import {
  backfillPriceHistoryFromListings,
  normalizeBackfillLimit,
} from "./price-history-backfill";

describe("price history backfill", () => {
  it("inserts valid listings and skips duplicate writes", async () => {
    const seen = new Set<string>();
    const result = await backfillPriceHistoryFromListings(
      [
        { id: 1, product_id: 10, price: 20000, source: "EasyCep" },
        { id: 1, product_id: 10, price: 20000, source: "EasyCep" },
      ],
      async (input) => {
        const key = `${input.listingId}:${input.price}`;
        if (seen.has(key)) {
          return {
            ok: true,
            inserted: false,
            skipped: true,
            reason: "duplicate",
          };
        }
        seen.add(key);
        return { ok: true, inserted: true, skipped: false };
      },
    );

    expect(result).toMatchObject({
      scanned: 2,
      inserted: 1,
      skipped: 1,
      errors: 0,
    });
  });

  it("skips listings with missing price or ids", async () => {
    const result = await backfillPriceHistoryFromListings(
      [
        { id: 1, product_id: 10, price: null, source: "EasyCep" },
        { id: null, product_id: 10, price: 20000, source: "EasyCep" },
        { id: 2, product_id: null, price: 20000, source: "EasyCep" },
      ],
      async () => {
        throw new Error("writer should not be called for invalid records");
      },
    );

    expect(result).toMatchObject({
      scanned: 3,
      inserted: 0,
      skipped: 3,
      errors: 0,
    });
  });

  it("caps the requested limit at 100", () => {
    expect(normalizeBackfillLimit(500)).toBe(100);
    expect(normalizeBackfillLimit(25)).toBe(25);
    expect(normalizeBackfillLimit("bad")).toBe(100);
  });

  it("records write failures without crashing", async () => {
    const result = await backfillPriceHistoryFromListings(
      [{ id: 1, product_id: 10, price: 20000, source: "Getmobil" }],
      async () => ({
        ok: false,
        inserted: false,
        skipped: false,
        reason: "write_failed",
        error: "insert failed",
      }),
    );

    expect(result).toMatchObject({
      scanned: 1,
      inserted: 0,
      skipped: 0,
      errors: 1,
      errorMessages: ["insert failed"],
    });
  });
});
