import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";

// Brand/product artwork and icons never change in place, so browsers and CDNs
// may keep them for a week and serve a stale copy for another day meanwhile.
const STATIC_ASSET_CACHE_CONTROL =
  "public, max-age=604800, stale-while-revalidate=86400";
const STATIC_ASSET_SOURCES = [
  "/sources/:path*",
  "/products/:path*",
  "/avatars/:path*",
];

// Site icons keep their file names when the brand changes, so they must be
// revalidated soon; a long cache left browsers showing an old favicon.
const ICON_SOURCE = "/:file(favicon.*|icon.svg|apple-touch-icon.png|android-chrome-.*|og-image.png|manifest.json)";
const ICON_CACHE_CONTROL = "public, max-age=3600, must-revalidate";

// Browsers ignore HSTS on plain-http responses (localhost), so it is safe to
// send everywhere. No `preload`: that is a one-way commitment for the domain.
const HSTS_MAX_AGE_SECONDS = 63072000; // two years

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains` },
  // The site uses none of these; photo upload is a plain file input.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

// Next streams <title>/<meta> of dynamic pages (e.g. /product/[slug]) into
// <body> for every client except the bots in its list, and Googlebot is not on
// it. In the rendered DOM those tags stay in <body>, so Google (and PageSpeed's
// SEO audit) can miss the title and description. Adding Googlebot makes it get
// them in <head>, like Bing already does. Visitors keep the streamed version.
const HTML_LIMITED_BOTS = new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|Googlebot`, "i");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  htmlLimitedBots: HTML_LIMITED_BOTS,
  experimental: {
    // Server actions accept 1 MB by default; listing photos (shrunk in the
    // browser to well under 1.5 MB) and avatars (up to 2 MB) need more headroom.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: ICON_SOURCE, headers: [{ key: "Cache-Control", value: ICON_CACHE_CONTROL }] },
      ...STATIC_ASSET_SOURCES.map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE_CONTROL }],
      })),
    ];
  },
  async redirects() {
    return [
      // /aksesuar was a hand-duplicated copy of /category/aksesuar (same
      // data, same content) — its own metadata already declared
      // /category/aksesuar as canonical. Permanent redirect avoids a 404
      // for any existing links/bookmarks/search-engine index entries.
      {
        source: "/aksesuar",
        destination: "/category/aksesuar",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
