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
          <Link href="/categories" className="transition-colors hover:text-[#3B66E0]">
            Kategoriler
          </Link>
          <Link href="/ikinci-el-fiyatlari" className="transition-colors hover:text-[#3B66E0]">
            Fiyat Listesi
          </Link>
          <Link href="/gizlilik" className="transition-colors hover:text-[#3B66E0]">
            Gizlilik
          </Link>
          <Link
            href="/kullanim-sartlari"
            className="transition-colors hover:text-[#3B66E0]"
          >
            Kullanım Şartları
          </Link>
          <Link href="/iletisim" className="transition-colors hover:text-[#3B66E0]">
            İletişim
          </Link>
        </nav>
      </div>
    </footer>
  );
}
