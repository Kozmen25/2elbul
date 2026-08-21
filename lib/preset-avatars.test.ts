import { describe, expect, it } from "vitest";
import {
  PRESET_AVATARS,
  PRESET_AVATAR_COUNT,
  defaultPresetIdForEmail,
  defaultPresetIndexForEmail,
  isPresetAvatarId,
  isPresetAvatarUrl,
  presetAvatarUrl,
  presetIdFromUrl,
} from "./preset-avatars";

describe("preset-avatars", () => {
  it("defines exactly 20 presets with unique ids and non-empty labels", () => {
    expect(PRESET_AVATAR_COUNT).toBe(20);
    const ids = PRESET_AVATARS.map((a) => a.id);
    expect(new Set(ids).size).toBe(20);
    for (const avatar of PRESET_AVATARS) {
      expect(avatar.id).toMatch(/^[a-z]$/);
      expect(avatar.label.length).toBeGreaterThan(0);
    }
  });

  it("isPresetAvatarId whitelists only known ids", () => {
    for (const avatar of PRESET_AVATARS) {
      expect(isPresetAvatarId(avatar.id)).toBe(true);
    }
    // 'q' is intentionally skipped, plus non-id garbage.
    expect(isPresetAvatarId("q")).toBe(false);
    expect(isPresetAvatarId("")).toBe(false);
    expect(isPresetAvatarId("..%2F..%2Fetc%2Fpasswd")).toBe(false);
    expect(isPresetAvatarId(123)).toBe(false);
    expect(isPresetAvatarId(null)).toBe(false);
    expect(isPresetAvatarId(undefined)).toBe(false);
    expect(isPresetAvatarId({ id: "a" })).toBe(false);
  });

  it("presetAvatarUrl builds the static public path", () => {
    expect(presetAvatarUrl("a")).toBe("/avatars/preset-a.svg");
    expect(presetAvatarUrl("u")).toBe("/avatars/preset-u.svg");
  });

  it("isPresetAvatarUrl accepts preset paths and rejects everything else", () => {
    expect(isPresetAvatarUrl("/avatars/preset-a.svg")).toBe(true);
    expect(isPresetAvatarUrl("/avatars/preset-u.svg")).toBe(true);
    expect(isPresetAvatarUrl("/avatars/preset-q.svg")).toBe(false);
    expect(isPresetAvatarUrl("/avatars/preset-a.png")).toBe(false);
    expect(isPresetAvatarUrl("https://example.com/x.png")).toBe(false);
    expect(isPresetAvatarUrl("http://evil.com/avatars/preset-a.svg")).toBe(false);
    expect(
      isPresetAvatarUrl("https://supabase.example/storage/v1/object/public/avatars/uuid.png"),
    ).toBe(false);
    expect(isPresetAvatarUrl("/avatars/../../../etc/passwd")).toBe(false);
    expect(isPresetAvatarUrl("")).toBe(false);
  });

  it("defaultPresetIndexForEmail is deterministic within bounds", () => {
    const emails = [
      "a@test.com",
      "banan@test.com",
      "z@example.org",
      " ",
      "",
      "Upper@CASE.test",
    ];
    for (const email of emails) {
      const first = defaultPresetIndexForEmail(email);
      const second = defaultPresetIndexForEmail(email);
      expect(first).toBe(second);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThan(PRESET_AVATAR_COUNT);
    }
  });

  it("defaultPresetIdForEmail always returns a valid preset id", () => {
    for (const email of ["a@x.com", "b@x.com", "c@x.com", ""]) {
      expect(isPresetAvatarId(defaultPresetIdForEmail(email))).toBe(true);
    }
  });

  it("presetIdFromUrl is the inverse of presetAvatarUrl and rejects uploads", () => {
    for (const avatar of PRESET_AVATARS) {
      expect(presetIdFromUrl(presetAvatarUrl(avatar.id))).toBe(avatar.id);
    }
    expect(presetIdFromUrl("/avatars/preset-q.svg")).toBeNull();
    expect(
      presetIdFromUrl("https://supabase.test/storage/v1/object/public/avatars/uuid.png"),
    ).toBeNull();
    expect(presetIdFromUrl(null)).toBeNull();
    expect(presetIdFromUrl("")).toBeNull();
    expect(presetIdFromUrl(undefined)).toBeNull();
  });
});
