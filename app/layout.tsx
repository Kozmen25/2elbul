import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { getSiteGeneralSettings } from "@/lib/site-settings";
import { getMetadataBase } from "@/lib/site-url";

export async function generateMetadata(): Promise<Metadata> {
  const general = await getSiteGeneralSettings();
  return {
    metadataBase: getMetadataBase(),
    title: `${general.siteName} | İkinci Elin Doğru Fiyatı`,
    description: general.siteDescription,
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
        <Header />
        <main>
          <MaintenanceGate>{children}</MaintenanceGate>
        </main>
        <Footer />
      </body>
    </html>
  );
}
