import { describe, it, expect } from "vitest";
import { scoreProductByPue, rankListingsByPue, attachPueScore } from "../pue-ranking";
import { detectQueryIntent } from "../query-intent-detector";
import type { SearchQueryIntent } from "../query-intent-detector";

// ─── Helpers ───

/**
 * Build a mock PUE attributes object matching the JSONB structure.
 */
function pueAttributes(
  overrides: Partial<{
    productType: string;
    deviceFamily: string | null;
    compatibleFamily: string | null;
    compatibleDevice: string | null;
    deviceModel: string | null;
  }>,
): unknown {
  const result: Record<string, unknown> = {
    productUnderstanding: {},
  };
  const pu = result.productUnderstanding as Record<string, unknown>;
  if (overrides.productType) pu.productType = { value: overrides.productType, confidence: 95 };
  if (overrides.deviceFamily) pu.deviceFamily = { value: overrides.deviceFamily, confidence: 90 };
  if (overrides.compatibleFamily) pu.compatibleFamily = { value: overrides.compatibleFamily, confidence: 85 };
  if (overrides.compatibleDevice) pu.compatibleDevice = { value: overrides.compatibleDevice, confidence: 85 };
  if (overrides.deviceModel) pu.deviceModel = { value: overrides.deviceModel, confidence: 80 };
  return result;
}

/**
 * Build a mock product lookup entry.
 */
function product(id: string, attrs: unknown): { attributes?: unknown } {
  if (attrs == null) return {};
  return { attributes: attrs };
}

/**
 * Build a mock listing.
 */
function listing(
  productId: string,
  overrides: Partial<{ price: number; title: string }> = {},
) {
  return {
    productId,
    price: overrides.price ?? 100,
    title: overrides.title ?? "Test Listing",
  };
}

// ─── Pre-computed query intents for test queries ───

const INTENT_IPHONE14 = detectQueryIntent("iPhone 14");
const INTENT_IPHONE14_SCREEN_PROTECTOR = detectQueryIntent("iPhone 14 Screen Protector");
const INTENT_MACBOOK_AIR = detectQueryIntent("MacBook Air");
const INTENT_PS5_CONTROLLER = detectQueryIntent("PlayStation 5 Controller");
const INTENT_UNKNOWN = detectQueryIntent("xyz random stuff");
const INTENT_SAMSUNG_CHARGER = detectQueryIntent("Samsung Charger");

// ─── Tests ───

describe("scoreProductByPue", () => {
  describe('query: "iPhone 14" → intent: primary_product, deviceFamily: iphone', () => {
    it("gives +1000 Tier 1 to a primary_product iPhone", () => {
      const attrs = pueAttributes({ productType: "primary_product", deviceFamily: "iphone" });
      const score = scoreProductByPue(INTENT_IPHONE14, attrs);
      // Tier 1 (1000) + Tier 2 (800) + Tier 5 (200) = 2000
      expect(score).toBeGreaterThanOrEqual(1900);
    });

    it("penalizes accessories with -300", () => {
      const attrs = pueAttributes({ productType: "accessory", compatibleFamily: "iphone" });
      const score = scoreProductByPue(INTENT_IPHONE14, attrs);
      // Tier 2 (800) + Tier 5 (200) - penalty (300) = 700
      expect(score).toBe(700);
    });

    it("gives higher score to primary_product than accessory", () => {
      const phoneAttrs = pueAttributes({ productType: "primary_product", deviceFamily: "iphone" });
      const accessoryAttrs = pueAttributes({ productType: "accessory", compatibleFamily: "iphone" });

      const phoneScore = scoreProductByPue(INTENT_IPHONE14, phoneAttrs);
      const accessoryScore = scoreProductByPue(INTENT_IPHONE14, accessoryAttrs);

      expect(phoneScore).toBeGreaterThan(accessoryScore);
      // Difference should be at least Tier 1 + penalty (1000 - (-300) = 1300)
      expect(phoneScore - accessoryScore).toBeGreaterThanOrEqual(1300);
    });

    it("gives +200 Tier 5 to products with PUE data but no specific match", () => {
      const attrs = pueAttributes({ productType: "primary_product", deviceFamily: "galaxy" });
      const score = scoreProductByPue(INTENT_IPHONE14, attrs);
      // Tier 1 (1000) + Tier 5 (200) = 1200 (deviceFamily galaxy != iphone)
      expect(score).toBe(1200);
    });
  });

  describe('query: "iPhone 14 Screen Protector" → intent: accessory, screen_protector', () => {
    it("gives highest score to screen protector accessories", () => {
      const attrs = pueAttributes({
        productType: "accessory",
        compatibleFamily: "iphone",
      });
      const score = scoreProductByPue(INTENT_IPHONE14_SCREEN_PROTECTOR, attrs);
      // Tier 1 (1000) + Tier 2 (800) + Tier 5 (200) = 2000
      expect(score).toBe(2000);
    });

    it("penalizes primary_product devices with -300", () => {
      const attrs = pueAttributes({ productType: "primary_product", deviceFamily: "iphone" });
      const score = scoreProductByPue(INTENT_IPHONE14_SCREEN_PROTECTOR, attrs);
      // Tier 2 (800) + Tier 5 (200) - penalty (300) = 700
      expect(score).toBe(700);
    });

    it("ranks accessories above devices", () => {
      const accessoryAttrs = pueAttributes({ productType: "accessory", compatibleFamily: "iphone" });
      const phoneAttrs = pueAttributes({ productType: "primary_product", deviceFamily: "iphone" });

      const accScore = scoreProductByPue(INTENT_IPHONE14_SCREEN_PROTECTOR, accessoryAttrs);
      const phoneScore = scoreProductByPue(INTENT_IPHONE14_SCREEN_PROTECTOR, phoneAttrs);

      expect(accScore).toBeGreaterThan(phoneScore);
    });
  });

  describe('query: "MacBook Air" → intent: primary_product, deviceFamily: macbook', () => {
    it("gives Tier 1 + Tier 2 to a macbook primary_product", () => {
      const attrs = pueAttributes({ productType: "primary_product", deviceFamily: "macbook" });
      const score = scoreProductByPue(INTENT_MACBOOK_AIR, attrs);
      // Tier 1 (1000) + Tier 2 (800) + Tier 5 (200) = 2000
      expect(score).toBe(2000);
    });

    it("gives no Tier 2 bonus to an iPhone (wrong device family)", () => {
      const attrs = pueAttributes({ productType: "primary_product", deviceFamily: "iphone" });
      const score = scoreProductByPue(INTENT_MACBOOK_AIR, attrs);
      // Tier 1 (1000) + Tier 5 (200) = 1200 (wrong deviceFamily)
      expect(score).toBe(1200);
    });
  });

  describe('query: "PlayStation 5 Controller" → intent: primary_product (defaulted), deviceFamily: playstation', () => {
    it("scores accessories at 700 (Tier 2 + Tier 5 - penalty) since query defaults to primary_product", () => {
      const attrs = pueAttributes({ productType: "accessory", compatibleFamily: "playstation" });
      const score = scoreProductByPue(INTENT_PS5_CONTROLLER, attrs);
      // Tier 2 (800) + Tier 5 (200) - penalty (300) = 700
      expect(score).toBe(700);
    });

    it("scores primary_product at 2000 (Tier 1 + Tier 2 + Tier 5) since query defaults to primary_product", () => {
      const attrs = pueAttributes({ productType: "primary_product", deviceFamily: "playstation" });
      const score = scoreProductByPue(INTENT_PS5_CONTROLLER, attrs);
      // Tier 1 (1000) + Tier 2 (800) + Tier 5 (200) = 2000
      expect(score).toBe(2000);
    });
  });

  describe('query: "Samsung Charger" → intent: accessory, charger, deviceFamily: samsung', () => {
    it("scores charger accessories at 1200 (Tier 1 + Tier 5; no Tier 2 since galaxy !== samsung)", () => {
      const attrs = pueAttributes({ productType: "accessory", compatibleFamily: "galaxy" });
      const score = scoreProductByPue(INTENT_SAMSUNG_CHARGER, attrs);
      // Tier 1 (1000) + Tier 5 (200) = 1200 (compatibleFamily "galaxy" != deviceFamily "samsung")
      expect(score).toBe(1200);
    });

    it("penalizes phones (primary_product) for accessory query at -100 (Tier 5 - penalty)", () => {
      const attrs = pueAttributes({ productType: "primary_product", deviceFamily: "galaxy" });
      const score = scoreProductByPue(INTENT_SAMSUNG_CHARGER, attrs);
      // Tier 5 (200) - penalty (300) = -100 (no Tier 1 match, no Tier 2 since galaxy != samsung)
      expect(score).toBe(-100);
    });
  });

  describe("graceful degradation", () => {
    it("returns 0 for products with no attributes at all", () => {
      const score = scoreProductByPue(INTENT_IPHONE14, null);
      expect(score).toBe(0);
    });

    it("returns 0 for products with empty attributes", () => {
      const score = scoreProductByPue(INTENT_IPHONE14, {});
      expect(score).toBe(0);
    });

    it("returns 0 for products with no productUnderstanding block", () => {
      const score = scoreProductByPue(INTENT_IPHONE14, { otherField: 123 });
      expect(score).toBe(0);
    });
  });

  describe("unknown query (no product type detected)", () => {
    it("defaults to primary_product intent, scoring primary_product items high", () => {
      const attrs = pueAttributes({ productType: "primary_product" });
      const score = scoreProductByPue(INTENT_UNKNOWN, attrs);
      expect(score).toBeGreaterThan(0);
    });

    it("still penalizes accessories when unknown query defaults to primary_product", () => {
      const phoneAttrs = pueAttributes({ productType: "primary_product" });
      const accAttrs = pueAttributes({ productType: "accessory" });

      const phoneScore = scoreProductByPue(INTENT_UNKNOWN, phoneAttrs);
      const accScore = scoreProductByPue(INTENT_UNKNOWN, accAttrs);

      // Phone gets Tier 1 (1000) + Tier 5 (200) = 1200
      // Accessory gets no Tier 1 + Tier 5 (200) - penalty (300) = -100
      // Wait, that's due to unknown query defaulting to primary_product
      // Actually: accessory type with unknown query intent defaults to primary_product
      // So accessory product gets -300 penalty since intent=primary, product=accessory
      expect(phoneScore).toBeGreaterThan(accScore);
    });
  });
});

describe("rankListingsByPue", () => {
  it("sorts by PUE score descending then price ascending", () => {
    const intent = INTENT_IPHONE14;
    const productLookup = new Map([
      ["1", product("1", pueAttributes({ productType: "primary_product", deviceFamily: "iphone" }))],
      ["2", product("2", pueAttributes({ productType: "accessory", compatibleFamily: "iphone" }))],
    ]);

    const listings = [
      listing("2", { price: 50 }),  // accessory, cheaper
      listing("1", { price: 200 }), // phone, more expensive
    ];

    const ranked = rankListingsByPue(intent, listings, productLookup);

    // Phone (score ~2000) should rank above accessory (score ~700)
    expect(ranked[0].productId).toBe("1");
    expect(ranked[1].productId).toBe("2");
    expect(ranked[0].pueScore).toBeGreaterThan(ranked[1].pueScore);
  });

  it("sorts by price ascending when scores are equal", () => {
    const intent = INTENT_IPHONE14;
    const productLookup = new Map([
      ["1", product("1", pueAttributes({ productType: "primary_product", deviceFamily: "galaxy" }))],
      ["2", product("2", pueAttributes({ productType: "primary_product", deviceFamily: "galaxy" }))],
    ]);

    const listings = [
      listing("1", { price: 500 }),
      listing("2", { price: 100 }),
    ];

    const ranked = rankListingsByPue(intent, listings, productLookup);

    // Both have same score (1200), cheaper one should be first
    expect(ranked[0].productId).toBe("2");
    expect(ranked[0].price).toBe(100);
    expect(ranked[1].productId).toBe("1");
    expect(ranked[1].price).toBe(500);
  });

  it("handles empty listings array", () => {
    const ranked = rankListingsByPue(INTENT_IPHONE14, [], new Map());
    expect(ranked).toEqual([]);
  });

  it("handles products not in lookup (graceful degradation — scores 0)", () => {
    const listings = [listing("999", { price: 100 })];
    const ranked = rankListingsByPue(INTENT_IPHONE14, listings, new Map());
    expect(ranked[0].pueScore).toBe(0);
  });
});

describe("attachPueScore", () => {
  it("returns score for a known product", () => {
    const productLookup = new Map([
      ["1", product("1", pueAttributes({ productType: "primary_product", deviceFamily: "iphone" }))],
    ]);
    const score = attachPueScore(INTENT_IPHONE14, "1", productLookup);
    expect(score).toBeGreaterThan(0);
  });

  it("returns 0 for unknown product", () => {
    const score = attachPueScore(INTENT_IPHONE14, "unknown", new Map());
    expect(score).toBe(0);
  });
});
