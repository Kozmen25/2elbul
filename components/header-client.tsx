"use client";

import Link from "next/link";
import {
  Home,
  Heart,
  LogIn,
  LogOut,
  Menu,
  Plus,
  UserRound,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { BrandLogo } from "@/components/brand-logo";

export function HeaderClient({ userEmail }: { userEmail: string | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function closeDesktopMenu() {
      if (window.innerWidth >= 768) setMenuOpen(false);
    }

    window.addEventListener("resize", closeDesktopMenu);
    return () => window.removeEventListener("resize", closeDesktopMenu);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-black/8 bg-white/95 backdrop-blur">
      <div className="container-shell flex h-18 items-center justify-between gap-2 md:gap-5">
        <BrandLogo />

        <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
          <Link href="/" className="transition-colors hover:text-[#ff6b00]">
            Ana Sayfa
          </Link>
          <Link href="/listing-ekle" className="orange-button px-4 py-2.5">
            <Plus size={17} strokeWidth={2.5} />
            İlan Ekle
          </Link>
          {userEmail ? (
            <div className="flex items-center gap-2">
              <Link
                href="/favoriler"
                className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 transition hover:bg-black/4"
              >
                <Heart size={17} /> Favoriler
              </Link>
              <Link
                href="/hesabim"
                className="flex items-center gap-2 rounded-xl border border-black/10 px-2.5 py-2 transition hover:border-[#ff6b00]/30"
                title={userEmail}
              >
                <span className="grid size-7 place-items-center rounded-lg bg-[#fff1e7] text-xs font-black uppercase text-[#d95700]">
                  {userEmail.charAt(0)}
                </span>
                Hesabım
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 font-bold text-red-600 transition hover:bg-red-50"
                >
                  <LogOut size={17} /> Çıkış Yap
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/giris"
                className="rounded-xl px-3 py-2.5 transition hover:bg-black/4"
              >
                Giriş Yap
              </Link>
              <Link
                href="/kayit"
                className="rounded-xl border border-black/10 px-3 py-2.5 transition hover:border-[#ff6b00]/40"
              >
                Kayıt Ol
              </Link>
            </div>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1 md:hidden">
          {userEmail ? (
            <>
              <MobileIconLink
                href="/favoriler"
                label="Favoriler"
                icon={<Heart size={18} />}
              />
              <MobileIconLink
                href="/hesabim"
                label="Hesabım"
                icon={<UserRound size={18} />}
              />
              <form action={logout}>
                <button
                  type="submit"
                  className="grid size-9 place-items-center rounded-xl text-red-600 transition hover:bg-red-50"
                  aria-label="Çıkış Yap"
                  title="Çıkış Yap"
                >
                  <LogOut size={18} />
                </button>
              </form>
            </>
          ) : (
            <>
              <MobileIconLink
                href="/giris"
                label="Giriş Yap"
                icon={<LogIn size={18} />}
              />
              <MobileIconLink
                href="/kayit"
                label="Kayıt Ol"
                icon={<UserPlus size={18} />}
              />
            </>
          )}

          <button
            type="button"
            className="grid size-9 place-items-center rounded-xl border border-black/10"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-navigation"
          className="absolute inset-x-0 top-full border-t border-black/8 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.12)] md:hidden"
        >
          <nav className="container-shell flex max-h-[calc(100vh-72px)] flex-col gap-1 overflow-y-auto py-4">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-black/4"
            >
              <Home size={18} /> Ana Sayfa
            </Link>
            <Link
              href="/listing-ekle"
              className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-black/4"
            >
              <Plus size={18} className="text-[#ff6b00]" /> İlan Ekle
            </Link>

            <div className="my-2 h-px bg-black/8" />

            {userEmail ? (
              <>
                <p className="truncate px-3 py-2 text-sm font-semibold text-black/45">
                  {userEmail}
                </p>
                <Link
                  href="/favoriler"
                  className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-black/4"
                >
                  <Heart size={18} /> Favoriler
                </Link>
                <Link
                  href="/hesabim"
                  className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-black/4"
                >
                  <UserRound size={18} /> Hesabım
                </Link>
                <form action={logout}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-bold text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={18} /> Çıkış Yap
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/giris"
                  className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-black/4"
                >
                  <LogIn size={18} /> Giriş Yap
                </Link>
                <Link
                  href="/kayit"
                  className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-black/4"
                >
                  <UserPlus size={18} /> Kayıt Ol
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function MobileIconLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="grid size-9 place-items-center rounded-xl text-black/65 transition hover:bg-black/4 hover:text-[#ff6b00]"
      aria-label={label}
      title={label}
    >
      {icon}
    </Link>
  );
}
