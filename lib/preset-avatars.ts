// 2ElBul preset avatar library.
//
// The 20 preset avatars are static SVGs served from /public/avatars at the
// absolute URL `/avatars/preset-<id>.svg`. `avatar_url` on the profiles table
// holds a plain URL string, so presets and uploaded photos unify: both are just
// URLs. The browser/server only trust ids in this whitelist (isPresetAvatarId)
// so a client can never smuggle an arbitrary path or URL into the profile.

export type PresetAvatar = {
  id: string;
  label: string;
};

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: "a", label: "Toprak" },
  { id: "b", label: "Zümrüt" },
  { id: "c", label: "Lacivert" },
  { id: "d", label: "Safran" },
  { id: "e", label: "Mercan" },
  { id: "f", label: "Menekşe" },
  { id: "g", label: "Gök" },
  { id: "h", label: "Nane" },
  { id: "i", label: "Meşe" },
  { id: "j", label: "Kiraz" },
  { id: "k", label: "Çam" },
  { id: "l", label: "Bal" },
  { id: "m", label: "Okyanus" },
  { id: "n", label: "Kehribar" },
  { id: "o", label: "Lila" },
  { id: "p", label: "Gece" },
  { id: "r", label: "Turkuaz" },
  { id: "s", label: "Fırtına" },
  { id: "t", label: "Pembe" },
  { id: "u", label: "Şeftali" },
];

const PRESET_IDS = new Set(PRESET_AVATARS.map((a) => a.id));

/** The number of distinct preset avatars (20). */
export const PRESET_AVATAR_COUNT = PRESET_AVATARS.length;

export function isPresetAvatarId(value: unknown): value is string {
  return typeof value === "string" && PRESET_IDS.has(value);
}

export function presetAvatarUrl(id: string): string {
  return `/avatars/preset-${id}.svg`;
}

const PRESET_AVATAR_URL = /^\/avatars\/preset-[a-z]\.svg$/;

/** True when `url` is one of the known preset avatar paths (not a user upload). */
export function isPresetAvatarUrl(url: string): boolean {
  return PRESET_AVATAR_URL.test(url) && PRESET_IDS.has(url.slice(16, 17));
}

/** Inverse of {@link presetAvatarUrl}: the preset id when `url` is a preset, else null. */
export function presetIdFromUrl(url: string | null | undefined): string | null {
  if (!url || !isPresetAvatarUrl(url)) return null;
  return url.slice(16, 17);
}

/**
 * Deterministic default preset pick, mirrored in the `handle_new_user` trigger
 * (`abs(hashtext(email)) % 20`). Kept pure here so it can be unit-tested and
 * reused; the DB copy must stay in sync by hand.
 */
export function defaultPresetIndexForEmail(email: string): number {
  let hash = 0;
  const trimmed = String(email ?? "").trim().toLowerCase();
  for (let i = 0; i < trimmed.length; i += 1) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return hash % PRESET_AVATAR_COUNT;
}

export function defaultPresetIdForEmail(email: string): string {
  return PRESET_AVATARS[defaultPresetIndexForEmail(email)]?.id ?? PRESET_AVATARS[0].id;
}
