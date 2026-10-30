import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { FetchedPage } from "./classify";

// Downloads the start of a listing's source page. Listing URLs can come from
// users, so every hop (redirects included) must resolve to a public address:
// the check must never be a way to reach this server's own network.

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;
/** Title and structured data sit at the top; no need for the whole page. */
const MAX_BODY_BYTES = 400_000;
const USER_AGENT = "Mozilla/5.0 (compatible; 2ElBulBot/1.0; +https://www.2elbul.com)";

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0x64400000, 0x647fffff], // 100.64.0.0/10 (carrier-grade NAT)
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (link-local, cloud metadata)
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0xe0000000, 0xffffffff], // multicast and reserved
];

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const value = address.split(".").reduce((total, part) => total * 256 + Number(part), 0);
    return !PRIVATE_IPV4_RANGES.some(([start, end]) => value >= start && value <= end);
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) return isPublicAddress(normalized.slice("::ffff:".length));
    return !(
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    );
  }
  return false;
}

async function isSafeTarget(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.port && url.port !== "80" && url.port !== "443") return false;
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) return isPublicAddress(hostname);
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.length > 0 && addresses.every((entry) => isPublicAddress(entry.address));
  } catch {
    return false;
  }
}

async function readLimitedBody(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (received < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return text;
}

export type PageFetcher = (url: string) => Promise<FetchedPage>;

export const fetchListingPage: PageFetcher = async (requestedUrl) => {
  const failed: FetchedPage = { requestedUrl, status: null, finalUrl: null, body: "" };
  let current: URL;
  try {
    current = new URL(requestedUrl);
  } catch {
    return failed;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!(await isSafeTarget(current))) return failed;
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
        cache: "no-store",
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel().catch(() => undefined);
        current = new URL(location, current);
        continue;
      }
      return {
        requestedUrl,
        status: response.status,
        finalUrl: current.toString(),
        body: await readLimitedBody(response),
      };
    }
    return failed; // redirect loop
  } catch {
    return failed;
  } finally {
    clearTimeout(timer);
  }
};
