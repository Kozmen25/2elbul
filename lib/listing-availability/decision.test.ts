import { describe, expect, it } from "vitest";
import { CONFIRM_AFTER_HOURS, decideAvailability } from "./decision";

const NOW = new Date("2026-10-03T06:00:00.000Z");
const fresh = { availabilityGoneCount: 0, availabilityGoneSince: null };

describe("decideAvailability", () => {
  it("starts a streak on the first gone result without deactivating", () => {
    const decision = decideAvailability(fresh, { outcome: "removed", detail: "http_404" }, NOW);
    expect(decision.action).toBe("keep");
    expect(decision.update).toMatchObject({ availability_gone_count: 1, availability_gone_since: NOW.toISOString() });
  });

  it("deactivates on a second gone result after the confirm gap, with the reason", () => {
    const since = new Date(NOW.getTime() - CONFIRM_AFTER_HOURS * 3_600_000).toISOString();
    const decision = decideAvailability(
      { availabilityGoneCount: 1, availabilityGoneSince: since },
      { outcome: "sold_out", detail: "schema_out_of_stock" },
      NOW,
    );
    expect(decision).toMatchObject({ action: "deactivate", reason: "sold_out" });
    expect(decision.update).toMatchObject({ status: "inactive", inactive_reason: "sold_out", availability_gone_count: 2 });
  });

  it("waits when the second gone result comes too soon", () => {
    const since = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    const decision = decideAvailability(
      { availabilityGoneCount: 1, availabilityGoneSince: since },
      { outcome: "removed", detail: "http_404" },
      NOW,
    );
    expect(decision.action).toBe("keep");
  });

  it("resets the streak when the page is back", () => {
    const decision = decideAvailability(
      { availabilityGoneCount: 1, availabilityGoneSince: NOW.toISOString() },
      { outcome: "available", detail: "ok" },
      NOW,
    );
    expect(decision.update).toEqual({
      availability_checked_at: NOW.toISOString(),
      availability_gone_count: 0,
      availability_gone_since: null,
    });
  });

  it("leaves the streak alone on an unknown result", () => {
    const decision = decideAvailability(
      { availabilityGoneCount: 1, availabilityGoneSince: NOW.toISOString() },
      { outcome: "unknown", detail: "http_403" },
      NOW,
    );
    expect(decision.update).toEqual({ availability_checked_at: NOW.toISOString() });
  });
});
