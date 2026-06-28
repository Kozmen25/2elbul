import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { getSiteGeneralSettings } from "@/lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const general = await getSiteGeneralSettings();
  return {
    title: `${general.siteName} | İkinci Elin Doğru Fiyatı`,
    description: general.siteDescription,
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
