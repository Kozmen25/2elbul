import { describe, expect, it } from "vitest";
import {
  buildPriceHistoryBackfillCandidates,
  isMissingPriceHistorySchemaError,
  isSameListingSameDaySamePrice,
  normalizePriceHistoryInput,
} from "./price-history";

describe("price history helpers", () => {
  it("normalizes valid first listing history input", () => {
    const normalized = normalizePriceHistoryInput({
      productId: 12,
      listingId: 45,
      source: "EasyCep",
      price: "21999.4",
      recordedAt: "2026-06-23T10:00:00.000Z",
    });

    expect(normalized).toMatchObject({
      productId: 12,
      listingId: 45,
      source: "EasyCep",
      price: 21999,
    });
  });

  it("skips same listing, same day and same price duplicates", () => {
    const duplicate = isSameListingSameDaySamePrice(
      {
        productId: 1,
        listingId: 7,
        price: 35000,
        recordedAt: "2026-06-23T14:00:00.000Z",
      },
      [
        {
          listingId: 7,
          price: 35000,
          recordedAt: "2026-06-23T08:00:00.000Z",
        },
      ],
    );

    expect(duplicate).toBe(true);
  });

  it("does not skip when the price changed on the same day", () => {
    const duplicate = isSameListingSameDaySamePrice(
      {
        productId: 1,
        listingId: 7,
        price: 32900,
        recordedAt: "2026-06-23T14:00:00.000Z",
      },
      [
        {
          listingId: 7,
          price: 35000,
          recordedAt: "2026-06-23T08:00:00.000Z",
        },
      ],
    );

    expect(duplicate).toBe(false);
  });

  it("detects missing schema errors safely", () => {
    expect(
      isMissingPriceHistorySchemaError({
        code: "42P01",
        message: 'relation "price_history" does not exist',
      }),
    ).toBe(true);

    expect(
      isMissingPriceHistorySchemaError({
        code: "PGRST204",
        message: "Could not find the 'source' column of 'price_history'",
      }),
    ).toBe(true);
  });

  it("builds safe backfill candidates from active listings", () => {
    const candidates = buildPriceHistoryBackfillCandidates([
      { id: 1, product_id: 2, price: 10000, source: "Getmobil" },
      { id: 2, product_id: 2, price: null, source: "Getmobil" },
      { id: null, product_id: 2, price: 9000, source: "Getmobil" },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      productId: 2,
      listingId: 1,
      price: 10000,
    });
  });
});
