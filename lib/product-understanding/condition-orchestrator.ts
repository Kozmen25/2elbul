import { inferCondition } from "../normalization";
import { ProductType } from "./types";

/**
 * Condition orchestrator.
 * Wraps inferCondition() with product-type-aware confidence modifiers.
 * Spare parts and accessories have less reliable condition info,
 * so their confidence is discounted.
 */

const PRODUCT_TYPE_CONFIDENCE_MODIFIERS: Record<ProductType, number> = {
  primary_product: 1.0,
  accessory: 0.90,
  spare_part: 0.85,
  service: 1.0,
};

export function detectProductCondition(
  title: string,
  productType?: ProductType,
  source?: string,
  category?: string,
  description?: string,
): { value: string | null; confidence: number; details?: import("../normalization").InferConditionResult } {
  const result = inferCondition(title, source, category, description);

  // Apply product-type modifier
  const modifier = productType ? PRODUCT_TYPE_CONFIDENCE_MODIFIERS[productType] ?? 1.0 : 1.0;
  const adjustedConfidence = Math.round(result.confidence * modifier);

  return {
    value: result.condition,
    confidence: adjustedConfidence,
    details: result,
  };
}
