// Sites whose listing pages cannot be read by an automated check: they block
// non-browser requests (sahibinden answers 403 even on its home page) or
// require a login. Their listings are never checked, so a block page can never
// deactivate them; they stay until a source scan or an admin removes them.
const UNCHECKABLE_HOSTS = ["sahibinden.com", "facebook.com", "instagram.com"];

export function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isCheckableUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return !UNCHECKABLE_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}
