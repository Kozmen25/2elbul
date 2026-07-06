import { describe, expect, it } from "vitest";
import { formatCurrencyTRY, formatDateTR, formatNumberTR } from "./formatters";

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
});
