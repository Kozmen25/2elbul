import { normalizeProductTitle } from "./helpers";
import type { ProductSignals } from "./types";
import { formatModelPart, titleCase } from "./helpers";

export function createCanonicalProductName(
  signals: ProductSignals,
  fallback: string,
) {
  if (signals.brand === "apple" && signals.model?.startsWith("iphone-")) {
    return [
      "iPhone",
      ...signals.model
        .replace(/^iphone-/, "")
        .split("-")
        .map(formatModelPart),
      signals.storage?.toUpperCase(),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (signals.brand === "samsung" && signals.model?.startsWith("galaxy-")) {
    return [
      "Samsung Galaxy",
      ...signals.model
        .replace(/^galaxy-/, "")
        .split("-")
        .map(formatModelPart),
      signals.storage?.toUpperCase(),
    ]
      .filter(Boolean)
      .join(" ");
  }

  return titleCase(normalizeProductTitle(fallback));
}
