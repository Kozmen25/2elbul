import { describe, expect, it } from "vitest";
import { compactSettings, expandSettings, parseNotificationSettings, resolveChannels } from "./preferences";

describe("resolveChannels", () => {
  it("is on for everything by default", () => {
    expect(resolveChannels("price_drop", {}, true)).toEqual({ inApp: true, email: true });
  });

  it("honours the choice per kind and channel", () => {
    const settings = { price_drop: { email: false }, saved_search: { in_app: false } };
    expect(resolveChannels("price_drop", settings, true)).toEqual({ inApp: true, email: false });
    expect(resolveChannels("saved_search", settings, true)).toEqual({ inApp: false, email: true });
    expect(resolveChannels("new_listing", settings, true)).toEqual({ inApp: true, email: true });
  });

  it("never e-mails when the account-wide switch is off", () => {
    expect(resolveChannels("price_alert", { price_alert: { email: true } }, false)).toEqual({ inApp: true, email: false });
  });
});

describe("parseNotificationSettings", () => {
  it("keeps valid entries and drops unknown kinds, channels and non-booleans", () => {
    expect(
      parseNotificationSettings({
        price_drop: { email: false, sms: true, in_app: "no" },
        nonsense: { email: false },
        new_listing: [],
      }),
    ).toEqual({ price_drop: { email: false } });
  });

  it("treats anything that is not an object as empty (nothing gets switched off)", () => {
    for (const value of [null, undefined, "x", 5, [], true]) expect(parseNotificationSettings(value)).toEqual({});
  });
});

describe("expandSettings / compactSettings", () => {
  it("round-trips, storing only what differs from the default", () => {
    const grid = expandSettings({ price_drop: { email: false } });
    expect(grid.price_drop).toEqual({ in_app: true, email: false });
    expect(grid.price_alert).toEqual({ in_app: true, email: true });
    expect(compactSettings(grid)).toEqual({ price_drop: { email: false } });
  });

  it("stores nothing when everything is on", () => {
    expect(compactSettings(expandSettings({}))).toEqual({});
  });

  it("rejects incomplete or malformed grids", () => {
    expect(compactSettings(null)).toBeNull();
    expect(compactSettings({})).toBeNull();
    const grid = expandSettings({});
    expect(compactSettings({ ...grid, price_drop: { in_app: true } })).toBeNull();
    expect(compactSettings({ ...grid, price_drop: { in_app: "yes", email: true } })).toBeNull();
  });
});
