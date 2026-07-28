import { HttpError } from "@/lib/bots/retry";
import type { ErrorCategory } from "./types";

export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof HttpError) {
    switch (error.statusCode) {
      case 429:
        return "rate_limit";
      case 401:
      case 403:
        return "auth";
      default:
        if (error.statusCode >= 500) return "http_server";
        return "http_client";
    }
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") return "timeout";
    if (error.name === "TypeError") return "network";

    if (
      error.message?.includes("PGRST204") ||
      error.message?.includes("schema") ||
      error.message?.toLowerCase().includes("column")
    ) {
      return "schema";
    }

    if (
      error.name === "SyntaxError" ||
      error.message?.includes("parse") ||
      error.message?.includes("cheerio") ||
      error.message?.includes("selector")
    ) {
      return "parser";
    }
  }

  return "unknown";
}

export function isRetryableByCategory(category: ErrorCategory): boolean {
  switch (category) {
    case "network":
    case "timeout":
    case "http_server":
    case "rate_limit":
      return true;
    case "http_client":
    case "auth":
    case "parser":
    case "schema":
    case "unknown":
      return false;
  }
}
