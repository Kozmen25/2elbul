import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { CompareBar } from "@/components/compare-bar";
import { CompareProvider } from "@/components/compare-context";
import { getSiteGeneralSettings } from "@/lib/site-settings";
import { getMetadataBase, getAbsoluteUrl } from "@/lib/site-url";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets full-bleed layouts respect the notch / home indicator via env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: "#3B66E0",
};

// Bump when the icon files change: a new URL makes browsers drop the cached favicon.
const ICON_VERSION = "2";
const icon = (path: string) => `${path}?v=${ICON_VERSION}`;

export async function generateMetadata(): Promise<Metadata> {
  const general = await getSiteGeneralSettings();
  return {
    metadataBase: getMetadataBase(),
    title: `${general.siteName} | İkinci Elin Doğru Fiyatı`,
    description: general.siteDescription,
    icons: {
      icon: [
        { url: icon("/favicon.ico") },
        { url: icon("/icon.svg"), type: "image/svg+xml" },
        { url: icon("/android-chrome-192x192.png"), sizes: "192x192", type: "image/png" },
        { url: icon("/android-chrome-512x512.png"), sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: icon("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
      other: [{ rel: "manifest", url: icon("/manifest.json") }],
    },
    openGraph: {
      title: `${general.siteName} | İkinci Elin Doğru Fiyatı`,
      description: general.siteDescription,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "2ElBul" }],
      locale: "tr_TR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${general.siteName} | İkinci Elin Doğru Fiyatı`,
      description: general.siteDescription,
      images: ["/og-image.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>
        <CompareProvider>
          <Header />
          <main>
            <MaintenanceGate>{children}</MaintenanceGate>
          </main>
          <Footer />
          <CompareBar />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "2ElBul",
                url: getAbsoluteUrl("/"),
                logo: getAbsoluteUrl("/android-chrome-512x512.png"),
                sameAs: [],
              }).replace(/</g, "\\u003c"),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "2ElBul",
                url: getAbsoluteUrl("/"),
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate: getAbsoluteUrl("/search?q={search_term_string}"),
                  },
                  "query-input": "required name=search_term_string",
                },
              }).replace(/</g, "\\u003c"),
            }}
          />
        </CompareProvider>
      </body>
    </html>
  );
}
