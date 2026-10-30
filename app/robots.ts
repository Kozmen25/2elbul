import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/auth",
        "/hesabim",
        "/favoriler",
        "/bildirimler",
        "/price-alerts",
        "/saved-searches",
        "/listing-ekle",
        "/ilan-ekle",
        "/giris",
        "/kayit",
        "/sifre-sifirla",
        "/yeni-sifre",
        // Outbound redirects to listing sources and their "gone" page.
        "/git",
        "/ilan-yayinda-degil",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
