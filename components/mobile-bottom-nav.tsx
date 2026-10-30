"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  LayoutGrid,
  LogIn,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Path prefixes that mark this item as the current section. */
  matches: string[];
};

const BASE_ITEMS: NavItem[] = [
  { label: "Ana Sayfa", href: "/", icon: Home, matches: [] },
  { label: "Keşfet", href: "/search", icon: Search, matches: ["/search", "/arama"] },
  { label: "Piyasa", href: "/market", icon: BarChart3, matches: ["/market"] },
  {
    label: "Kategoriler",
    href: "/categories",
    icon: LayoutGrid,
    matches: ["/categories", "/category"],
  },
];

const GUEST_ITEM: NavItem = {
  label: "Giriş",
  href: "/giris",
  icon: LogIn,
  matches: ["/giris", "/kayit"],
};

const ACCOUNT_ITEM: NavItem = {
  label: "Hesabım",
  href: "/hesabim",
  icon: UserRound,
  matches: ["/hesabim", "/favoriler", "/bildirimler", "/price-alerts", "/saved-searches"],
};

function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * The single primary navigation on small screens. The header keeps only the
 * logo and one contextual action, so nothing here is repeated at the top.
 * Its height is reserved through --mobile-nav-height (see globals.css).
 */
export function MobileBottomNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const items = [...BASE_ITEMS, signedIn ? ACCOUNT_ITEM : GUEST_ITEM];

  return (
    <nav
      aria-label="Ana gezinme"
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-(--mobile-nav-height) flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors ${
                  active ? "text-[#2A4FBF]" : "text-black/55 hover:text-[#2A4FBF]"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
