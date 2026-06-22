export function normalizeImageUrls(value: unknown): string[] {
  const candidates = parseImageCandidates(value);
  const urls = new Set<string>();

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate.trim());
      if (["http:", "https:"].includes(url.protocol)) {
        urls.add(url.toString());
      }
    } catch {
      // Invalid gallery entries are ignored; callers validate the main image.
    }
  }

  return [...urls];
}

function parseImageCandidates(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string" || !value.trim()) return [];

  const text = value.trim();
  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === "string",
        );
      }
    } catch {
      return [];
    }
  }

  return text
    .split(/[\n,|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
