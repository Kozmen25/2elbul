import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-black/8 bg-[#fafaf8]">
      <div className="container-shell flex flex-col gap-6 py-9 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-start gap-2">
          <BrandLogo size="sm" />
          <p className="font-semibold text-black/50">
            İkinci elin fiyat rehberi.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-3 font-semibold text-black/55">
          <Link href="/gizlilik" className="transition-colors hover:text-[#ff6b00]">
            Gizlilik
          </Link>
          <Link
            href="/kullanim-sartlari"
            className="transition-colors hover:text-[#ff6b00]"
          >
            Kullanım Şartları
          </Link>
          <Link href="/iletisim" className="transition-colors hover:text-[#ff6b00]">
            İletişim
          </Link>
        </nav>
      </div>
    </footer>
  );
}
