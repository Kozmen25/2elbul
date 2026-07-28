import { describe, it, expect } from "vitest";
import { classifyError, isRetryableByCategory } from "./failure-classification";
import { HttpError } from "@/lib/bots/retry";

// ---------------------------------------------------------------------------
// classifyError
// ---------------------------------------------------------------------------
describe("classifyError", () => {
  describe("HttpError", () => {
    it.each([429])("returns rate_limit for HTTP %i", (status) => {
      expect(classifyError(new HttpError("too many", status))).toBe("rate_limit");
    });

    it.each([401, 403])("returns auth for HTTP %i", (status) => {
      expect(classifyError(new HttpError("unauthorized", status))).toBe("auth");
    });

    it.each([500, 502, 503, 504])("returns http_server for HTTP %i", (status) => {
      expect(classifyError(new HttpError("server error", status))).toBe("http_server");
    });

    it.each([400, 404, 405, 409, 422, 418])("returns http_client for HTTP %i", (status) => {
      expect(classifyError(new HttpError("client error", status))).toBe("http_client");
    });
  });

  describe("Error instances", () => {
    it("returns timeout for AbortError", () => {
      const err = new Error("timed out");
      err.name = "AbortError";
      expect(classifyError(err)).toBe("timeout");
    });

    it("returns network for TypeError", () => {
      expect(classifyError(new TypeError("fetch failed"))).toBe("network");
    });

    it("returns schema for PGRST204", () => {
      expect(classifyError(new Error("PGRST204 column not found"))).toBe("schema");
    });

    it("returns schema when message includes 'schema'", () => {
      expect(classifyError(new Error("schema mismatch"))).toBe("schema");
    });

    it("returns schema when message includes 'column'", () => {
      expect(classifyError(new Error("unknown column 'foo'"))).toBe("schema");
    });

    it("returns parser for SyntaxError", () => {
      expect(classifyError(new SyntaxError("Unexpected token"))).toBe("parser");
    });

    it("returns parser when message includes 'parse'", () => {
      expect(classifyError(new Error("failed to parse HTML"))).toBe("parser");
    });

    it("returns parser when message includes 'cheerio'", () => {
      expect(classifyError(new Error("cheerio load failed"))).toBe("parser");
    });

    it("returns parser when message includes 'selector'", () => {
      expect(classifyError(new Error("selector not found"))).toBe("parser");
    });
  });

  describe("unknown / edge cases", () => {
    it("returns unknown for a generic Error", () => {
      expect(classifyError(new Error("something broke"))).toBe("unknown");
    });

    it("returns unknown for string values", () => {
      expect(classifyError("error string")).toBe("unknown");
    });

    it("returns unknown for null", () => {
      expect(classifyError(null)).toBe("unknown");
    });

    it("returns unknown for undefined", () => {
      expect(classifyError(undefined)).toBe("unknown");
    });

    it("returns unknown for object without message", () => {
      expect(classifyError({ foo: "bar" })).toBe("unknown");
    });
  });
});

// ---------------------------------------------------------------------------
// isRetryableByCategory
// ---------------------------------------------------------------------------
describe("isRetryableByCategory", () => {
  it.each(["network", "timeout", "http_server", "rate_limit"])(
    "returns true for %s",
    (cat) => {
      expect(isRetryableByCategory(cat as any)).toBe(true);
    },
  );

  it.each(["http_client", "auth", "parser", "schema", "unknown"])(
    "returns false for %s",
    (cat) => {
      expect(isRetryableByCategory(cat as any)).toBe(false);
    },
  );
});
