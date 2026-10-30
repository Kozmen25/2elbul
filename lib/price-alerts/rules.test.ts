import { describe, expect, it } from "vitest";
import {
  MAX_TARGET_PRICE,
  canChangeAlertStatus,
  evaluatePriceAlert,
  parsePositiveInteger,
  parseTargetPrice,
} from "./rules";

describe("parsePositiveInteger", () => {
  it("accepts positive integers given as numbers or strings", () => {
    expect(parsePositiveInteger(5)).toBe(5);
    expect(parsePositiveInteger("12")).toBe(12);
  });

  it("rejects everything else", () => {
    for (const value of [0, -1, 1.5, "", "abc", null, undefined, Number.NaN, Infinity, 2 ** 60]) {
      expect(parsePositiveInteger(value)).toBeNull();
    }
  });
});

describe("parseTargetPrice", () => {
  it("accepts positive prices and rounds to kuruş", () => {
    expect(parseTargetPrice(25000)).toBe(25000);
    expect(parseTargetPrice("199.999")).toBe(200);
    expect(parseTargetPrice("0.5")).toBe(0.5);
  });

  it("rejects zero, negatives, junk, blanks and absurd values", () => {
    for (const value of [0, -5, "", "  ", "abc", null, undefined, Number.NaN, Infinity, MAX_TARGET_PRICE + 1]) {
      expect(parseTargetPrice(value)).toBeNull();
    }
    expect(parseTargetPrice(MAX_TARGET_PRICE)).toBe(MAX_TARGET_PRICE);
  });
});

describe("canChangeAlertStatus", () => {
  it("lets a user pause, resume, re-arm and cancel", () => {
    expect(canChangeAlertStatus("active", "paused")).toBe(true);
    expect(canChangeAlertStatus("paused", "active")).toBe(true);
    expect(canChangeAlertStatus("triggered", "active")).toBe(true);
    expect(canChangeAlertStatus("active", "cancelled")).toBe(true);
    expect(canChangeAlertStatus("paused", "cancelled")).toBe(true);
  });

  it("never revives a cancelled alert or hand-sets 'triggered'", () => {
    expect(canChangeAlertStatus("cancelled", "active")).toBe(false);
    expect(canChangeAlertStatus("active", "triggered")).toBe(false);
    expect(canChangeAlertStatus("active", "active")).toBe(false);
  });
});

describe("evaluatePriceAlert", () => {
  it("triggers at or below the target", () => {
    expect(evaluatePriceAlert({ targetPrice: 20000, currentPrice: 19000, previousPrice: 25000 })).toEqual({ kind: "triggered" });
    expect(evaluatePriceAlert({ targetPrice: 20000, currentPrice: 20000, previousPrice: null })).toEqual({ kind: "triggered" });
  });

  it("reports a price drop of at least 5% that misses the target", () => {
    expect(evaluatePriceAlert({ targetPrice: 15000, currentPrice: 23000, previousPrice: 25000 })).toEqual({
      kind: "price_drop",
      previousPrice: 25000,
      dropPercent: 8,
    });
  });

  it("ignores small moves and price increases", () => {
    expect(evaluatePriceAlert({ targetPrice: 15000, currentPrice: 24000, previousPrice: 25000 })).toEqual({ kind: "unchanged" });
    expect(evaluatePriceAlert({ targetPrice: 15000, currentPrice: 26000, previousPrice: 25000 })).toEqual({ kind: "unchanged" });
    expect(evaluatePriceAlert({ targetPrice: 15000, currentPrice: 25000, previousPrice: null })).toEqual({ kind: "unchanged" });
  });

  it("never reports a drop when suppressed (accessories / spare parts), but still triggers on target", () => {
    expect(evaluatePriceAlert({ targetPrice: 15000, currentPrice: 20000, previousPrice: 25000, suppressDrop: true })).toEqual({ kind: "unchanged" });
    expect(evaluatePriceAlert({ targetPrice: 21000, currentPrice: 20000, previousPrice: 25000, suppressDrop: true })).toEqual({ kind: "triggered" });
  });
});
