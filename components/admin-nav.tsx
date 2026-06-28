"use client";

import {
  BarChart3,
  BellRing,
  Bot,
  Boxes,
  ChevronLeft,
  ClipboardCheck,
  DatabaseZap,
  Globe2,
  LayoutDashboard,
  Menu,
  PackageSearch,
  Search,
  Settings,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

const links = [
  { href: "/admin/data-cleanup", label: "Veri Temizligi", icon: ClipboardCheck },
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/admin/listings", label: "İlanlar", icon: PackageSearch },
  { href: "/admin/products", label: "Ürünler", icon: Boxes },
  { href: "/admin/product-matcher", label: "Ürün Eşleştirici", icon: WandSparkles },
  { href: "/admin/search-demands", label: "Arama Talepleri", icon: Search },
  { href: "/admin/bot-center", label: "Bot Merkezi", icon: Bot },
  { href: "/admin/price-alerts", label: "Fiyat Alarmları", icon: BellRing },
  { href: "/admin/sources", label: "Kaynaklar", icon: Globe2 },
  { href: "/admin/bot-runs", label: "Bot Çalışmaları", icon: Bot },
  { href: "/admin/users", label: "Kullanıcılar", icon: Users },
  { href: "/admin/import", label: "İçe Aktar", icon: DatabaseZap },
  { href: "/admin/stats", label: "İstatistikler", icon: BarChart3 },
  { href: "/admin/settings", label: "Ayarlar", icon: Settings },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-black/8 bg-white px-4 py-3 lg:hidden">
        <BrandLogo />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid size-10 place-items-center rounded-xl border border-black/10"
          aria-label="Admin menüsünü aç"
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <aside
        className={`${open ? "block" : "hidden"} shrink-0 overflow-y-auto border-b border-black/8 bg-[#111] text-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-[260px] lg:border-b-0`}
      >
        <div className="flex min-h-full flex-col p-4 sm:p-5">
          <div className="hidden rounded-2xl bg-white p-4 lg:block">
            <BrandLogo />
          </div>
          <p className="mt-5 px-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
            Yönetim paneli
          </p>
          <nav className="mt-3 grid gap-1.5">
            {links.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/admin"
                  ? pathname === href
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
                    active
                      ? "bg-[#ff6b00] text-white"
                      : "text-white/65 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon size={19} />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 border-t border-white/10 pt-4 lg:mt-auto">
            <p className="truncate px-3 text-xs text-white/40">{email}</p>
            <Link
              href="/"
              className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white/65 hover:bg-white/8 hover:text-white"
            >
              <ChevronLeft size={18} />
              Siteye dön
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
