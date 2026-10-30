import type { Metadata } from "next";
import { getAbsoluteUrl } from "@/lib/site-url";

const SITE_NAME = "2ElBul";
const OG_IMAGE_PATH = "/og-image.png";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/**
 * A page-level `openGraph` object replaces the one from the root layout, so
 * every page that sets its own must repeat the share image or it is lost.
 */
export const DEFAULT_OG_IMAGES = [
  {
    url: OG_IMAGE_PATH,
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt: SITE_NAME,
  },
];

export const DEFAULT_TWITTER_IMAGES = [OG_IMAGE_PATH];

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  /** With noIndex: still let crawlers follow the page's links (thin but useful pages). */
  followLinks?: boolean;
};

/** Metadata for a plain public page: canonical, Open Graph and Twitter card. */
export function buildPageMetadata({
  title,
  description,
  path,
  noIndex = false,
  followLinks = false,
}: PageMetadataInput): Metadata {
  const url = getAbsoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(noIndex ? { robots: { index: false, follow: followLinks } } : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "tr_TR",
      type: "website",
      images: DEFAULT_OG_IMAGES,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: DEFAULT_TWITTER_IMAGES,
    },
  };
}
