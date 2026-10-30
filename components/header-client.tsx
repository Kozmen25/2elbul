"use client";

import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Heart,
  LayoutGrid,
  LogOut,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { BrandLogo } from "@/components/brand-logo";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { NotificationDropdown } from "@/components/notification-dropdown";
import { useHeaderAccount } from "@/components/use-header-state";
import type { HeaderCategory } from "@/lib/header-categories";

import { AvatarImage } from "@/components/avatar";

// The header menu lists the categories chosen in the admin panel; each links
// straight to its /category/[slug] page.
function categoryHref(category: HeaderCategory): string {
  return `/category/${category.slug}`;
}

export function HeaderClient({ categories }: { categories: HeaderCategory[] }) {
  const { userEmail, unreadCount, displayName, avatarUrl, ready } = useHeaderAccount();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setProfileMenuOpen(false);
    setCategoryMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function closeDesktopMenu() {
      if (window.innerWidth >= 768) {
            setCategoryMenuOpen(false);
      }
    }

    window.addEventListener("resize", closeDesktopMenu);
    return () => window.removeEventListener("resize", closeDesktopMenu);
  }, []);

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-black/8 bg-white/95 backdrop-blur">
      <div className="container-shell flex h-18 items-center justify-between gap-2 md:gap-5">
        <BrandLogo />

        <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
          <Link href="/" className="transition-colors hover:text-[#3B66E0]">
            Ana Sayfa
          </Link>
          <Link href="/market" className="transition-colors hover:text-[#3B66E0]">
            Piyasa Merkezi
          </Link>
          <Link href="/search" className="orange-button px-4 py-2.5">
            <Search size={17} strokeWidth={2.5} />
            Piyasayı Keşfet
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCategoryMenuOpen((open) => !open);
                          }}
              aria-haspopup="menu"
              aria-expanded={categoryMenuOpen}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 transition ${
                categoryMenuOpen
                  ? "border-[#3B66E0]/40 bg-[#EEF3FF] text-[#2A4FBF]"
                  : "border-black/10 hover:border-[#3B66E0]/30"
              }`}
            >
              <LayoutGrid size={16} strokeWidth={2.5} className="text-[#3B66E0]" />
              Kategoriler
              <ChevronDown
                size={15}
                className={`text-black/45 transition-transform ${categoryMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {categoryMenuOpen && (
              <CategoryMenuPanel
                categories={categories}
                onClose={() => setCategoryMenuOpen(false)}
              />
            )}
          </div>

          {!ready ? (
            <div aria-hidden className="h-10 w-48 animate-pulse rounded-xl bg-black/6" />
          ) : userEmail ? (
            <div className="flex items-center gap-2">
              <Link
                href="/favoriler"
                className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 transition hover:bg-black/4"
              >
                <Heart size={17} /> Favoriler
              </Link>
              <NotificationDropdown initialUnreadCount={unreadCount} />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  className="group flex items-center gap-2 rounded-xl border border-black/10 px-2.5 py-2 transition hover:border-[#3B66E0]/30"
                  title={userEmail}
                >
                  <span className="relative grid size-7 place-items-center overflow-hidden rounded-lg bg-[#E4ECFF] text-xs font-black uppercase text-[#2A4FBF]">
                    <AvatarImage
                      src={avatarUrl}
                      name={displayName}
                      email={userEmail}
                      className="h-full w-full text-xs"
                    />
                  </span>
                  <span className="max-w-24 truncate text-sm font-semibold">
                    {displayName ?? "Hesabım"}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`text-black/45 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
                  >
                    <div className="flex items-center gap-3 border-b border-black/8 px-4 py-3">
                      <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#E4ECFF] text-base font-black uppercase text-[#2A4FBF]">
                        <AvatarImage
                          src={avatarUrl}
                          name={displayName}
                          email={userEmail}
                          className="h-full w-full text-base"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {displayName ?? "Hesap"}
                        </p>
                        <p className="truncate text-xs text-black/45">{userEmail}</p>
                      </div>
                    </div>

                    <div className="p-1.5">
                      <ProfileMenuItem href="/hesabim" icon={<UserRound size={17} />} label="Hesabım" />
                      <ProfileMenuItem href="/favoriler" icon={<Heart size={17} />} label="Favorilerim" />
                      <ProfileMenuItem href="/bildirimler" icon={<Bell size={17} />} label="Bildirimler" />
                    </div>

                    <form action={logout} className="border-t border-black/8 p-1.5">
                      <button
                        type="submit"
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut size={17} /> Çıkış Yap
                      </button>
                    </form>
                  </div>
                )}
              </div>
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
                className="rounded-xl border border-black/10 px-3 py-2.5 transition hover:border-[#3B66E0]/40"
              >
                Kayıt Ol
              </Link>
            </div>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1 md:hidden">
          {!ready ? (
            <div aria-hidden className="h-9 w-20 animate-pulse rounded-xl bg-black/6" />
          ) : userEmail ? (
            <MobileIconLink
              href="/bildirimler"
              label="Bildirimler"
              icon={<NotificationBellIcon count={unreadCount} />}
            />
          ) : (
            <Link href="/kayit" className="orange-button px-3.5 py-2 text-sm font-bold">
              Kayıt Ol
            </Link>
          )}
        </div>
      </div>
    </header>
    <MobileBottomNav signedIn={Boolean(userEmail)} />
    </>
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
      className="grid size-9 place-items-center rounded-xl text-black/65 transition hover:bg-black/4 hover:text-[#3B66E0]"
      aria-label={label}
      title={label}
    >
      {icon}
    </Link>
  );
}

function NotificationBellIcon({ count }: { count: number }) {
  return (
    <span className="relative">
      <Bell size={18} />
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-red-500 text-[8px] font-bold leading-none text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );
}

function ProfileMenuItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-black/4"
    >
      {icon} {label}
    </Link>
  );
}

function CategoryMenuPanel({
  categories,
  onClose,
}: {
  categories: HeaderCategory[];
  onClose: () => void;
}) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-full z-50 mt-2 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/8 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
          <LayoutGrid size={15} className="shrink-0 text-[#3B66E0]" />
          <span className="truncate">Kategoriler</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-black/45 transition hover:bg-black/4"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex max-h-[min(60vh,480px)] flex-col p-1.5">
        <div className="overflow-y-auto">
          {categories.map((row) => (
            <Link
              key={row.id}
              href={categoryHref(row)}
              role="menuitem"
              onClick={onClose}
              className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-black/4"
            >
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
            </Link>
          ))}
        </div>
        <div className="my-1.5 h-px shrink-0 bg-black/8" />
        <Link
          href="/categories"
          onClick={onClose}
          className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-[#2A4FBF] transition hover:bg-[#EEF3FF]"
        >
          <LayoutGrid size={15} />
          Tüm kategorileri incele
        </Link>
      </div>
    </div>
  );
}
