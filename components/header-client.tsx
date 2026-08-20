"use client";

import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Home,
  BarChart3,
  Heart,
  LogIn,
  LogOut,
  Menu,
  Search,
  UserRound,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationDropdown } from "@/components/notification-dropdown";

import { AvatarImage } from "@/components/avatar";

export function HeaderClient({
  userEmail,
  unreadCount = 0,
  displayName = null,
  avatarUrl = null,
}: {
  userEmail: string | null;
  unreadCount?: number;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
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
          <Link href="/market" className="transition-colors hover:text-[#ff6b00]">
            Piyasa Merkezi
          </Link>
          <Link href="/search" className="orange-button px-4 py-2.5">
            <Search size={17} strokeWidth={2.5} />
            Piyasayı Keşfet
          </Link>
          {userEmail ? (
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
                  className="group flex items-center gap-2 rounded-xl border border-black/10 px-2.5 py-2 transition hover:border-[#ff6b00]/30"
                  title={userEmail}
                >
                  <span className="grid size-7 place-items-center overflow-hidden rounded-lg bg-[#fff1e7] text-xs font-black uppercase text-[#d95700]">
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
                      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#fff1e7] text-base font-black uppercase text-[#d95700]">
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
                href="/bildirimler"
                label="Bildirimler"
                icon={<NotificationBellIcon count={unreadCount} />}
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
              href="/market"
              className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-black/4"
            >
              <BarChart3 size={18} className="text-[#ff6b00]" /> Piyasa Merkezi
            </Link>
            <Link
              href="/search"
              className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-black/4"
            >
              <Search size={18} className="text-[#ff6b00]" /> Piyasayı Keşfet
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
                  href="/bildirimler"
                  className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-black/4"
                >
                  <Bell size={18} /> Bildirimler
                  {unreadCount > 0 && (
                    <span className="ml-auto grid size-5 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
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
