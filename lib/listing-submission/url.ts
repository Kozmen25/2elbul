// Listing links: safety checks, tracking-parameter removal and matching a link
// to the marketplace it claims to be from.

import type { ListingSource } from "@/lib/listings";

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|gbraid|wbraid|msclkid|igshid|mc_cid|mc_eid|ref|ref_src)$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export type NormalizedUrl = { ok: true; url: string; host: string } | { ok: false; reason: string };

export function normalizeListingUrl(raw: string): NormalizedUrl {
  const value = raw.trim();
  if (!value) return { ok: false, reason: "İlan bağlantısı gerekli." };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "Geçerli bir bağlantı girin (https://... ile başlamalı)." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Bağlantı http:// ya da https:// ile başlamalı." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Bağlantıda kullanıcı adı ve şifre olmamalı." };
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || !host.includes(".") || IPV4.test(host) || host.startsWith("[") || host.endsWith(".local")) {
    return { ok: false, reason: "Bağlantı bir ilan sitesinin adresi olmalı." };
  }

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  url.hostname = host;

  return { ok: true, url: url.toString(), host };
}

// Marketplace → domains its listing links use.
export const SOURCE_DOMAINS: Record<ListingSource, string[]> = {
  Sahibinden: ["sahibinden.com"],
  Letgo: ["letgo.com", "letgo.com.tr"],
  "Facebook Marketplace": ["facebook.com", "fb.com"],
  EasyCep: ["easycep.com"],
  Getmobil: ["getmobil.com"],
  "Yenilenmiş Market": ["yenilenmismarket.com"],
  "Teknosa Yenilenmiş": ["teknosa.com"],
  "Hepsiburada Yenilenmiş": ["hepsiburada.com"],
  "MediaMarkt Yenilenmiş": ["mediamarkt.com.tr"],
  Satarız: ["satariz.com"],
};

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function urlMatchesSource(host: string, source: ListingSource): boolean {
  return SOURCE_DOMAINS[source].some((domain) => hostMatches(host, domain));
}

/** The marketplace a link belongs to, when it is one we know. */
export function detectSourceFromHost(host: string): ListingSource | null {
  for (const [source, domains] of Object.entries(SOURCE_DOMAINS) as [ListingSource, string[]][]) {
    if (domains.some((domain) => hostMatches(host, domain))) return source;
  }
  return null;
}
