import { describe, expect, it } from "vitest";
import {
  formatCurrencyTRY,
  formatDateTR,
  formatNumberTR,
  formatRelativeAge,
} from "./formatters";

describe("formatters", () => {
  it("formats TRY currency consistently", () => {
    expect(formatCurrencyTRY(12500)).toBe("₺12.500");
    expect(formatCurrencyTRY(null)).toBe("—");
  });

  it("formats Turkish dates with supplied options", () => {
    expect(
      formatDateTR("2026-07-05T10:15:00.000Z", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    ).toBe("5 Temmuz 2026");

    expect(formatDateTR("invalid", { dateStyle: "medium" })).toBe("—");
  });

  it("formats plain Turkish numbers", () => {
    expect(formatNumberTR(12500)).toBe("12.500");
    expect(formatNumberTR(null)).toBe("—");
  });

  it("formats relative age in Turkish", () => {
    const now = Date.parse("2026-08-17T20:00:00.000Z");
    expect(formatRelativeAge("2026-08-17T19:59:30.000Z", now)).toBe("Az önce");
    expect(formatRelativeAge("2026-08-17T19:50:00.000Z", now)).toBe("10 dk önce");
    expect(formatRelativeAge("2026-08-17T17:30:00.000Z", now)).toBe("2 saat önce");
    expect(formatRelativeAge("2026-08-16T20:00:00.000Z", now)).toBe("Dün");
    expect(formatRelativeAge("2026-08-15T20:00:00.000Z", now)).toBe("2 gün önce");
    expect(formatRelativeAge("2026-08-10T20:00:00.000Z", now)).toBe(
      "10 Ağu 2026",
    );
  });

  it("handles null and invalid input for relative age", () => {
    expect(formatRelativeAge(null)).toBe("—");
    expect(formatRelativeAge("invalid")).toBe("—");
    expect(formatRelativeAge("2026-08-17T21:00:00.000Z")).toBe("—");
  });
});
