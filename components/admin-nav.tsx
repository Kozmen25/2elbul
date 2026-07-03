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
  ShieldCheck,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

const groups = [
  {
    title: "Genel",
    links: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Botlar",
    links: [
      { href: "/admin/bot-center#manual-tasks", label: "Bot Merkezi", icon: Bot },
      { href: "/admin/bot-runs", label: "Bot Çalışmaları", icon: Bot },
      { href: "/admin/search-demands", label: "Arama Talepleri", icon: Search },
    ],
  },
  {
    title: "Kaynaklar",
    links: [
      { href: "/admin/sources", label: "Kaynaklar", icon: Globe2 },
      { href: "/admin/bot-center#source-health", label: "Kaynak Sağlığı", icon: ShieldCheck },
    ],
  },
  {
    title: "Intelligence",
    links: [
      { href: "/market", label: "Piyasa Merkezi", icon: BarChart3 },
      { href: "/admin/stats", label: "İstatistikler", icon: BarChart3 },
    ],
  },
  {
    title: "Veri",
    links: [
      { href: "/admin/listings", label: "İlanlar", icon: PackageSearch },
      { href: "/admin/products", label: "Ürünler", icon: Boxes },
      { href: "/admin/product-matcher", label: "Ürün Eşleştirici", icon: WandSparkles },
      { href: "/admin/data-cleanup", label: "Veri Temizliği", icon: ClipboardCheck },
      { href: "/admin/import", label: "İçe Aktar", icon: DatabaseZap },
    ],
  },
  {
    title: "Kullanıcı",
    links: [
      { href: "/admin/price-alerts", label: "Fiyat Alarmları", icon: BellRing },
      { href: "/admin/users", label: "Kullanıcılar", icon: Users },
    ],
  },
  {
    title: "Sistem",
    links: [{ href: "/admin/settings", label: "Ayarlar", icon: Settings }],
  },
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
            Operasyon paneli
          </p>
          <nav className="mt-3 grid gap-4">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/30">
                  {group.title}
                </p>
                <div className="mt-1.5 grid gap-1">
                  {group.links.map(({ href, label, icon: Icon }) => {
                    const path = href.split("#")[0] ?? href;
                    const active =
                      path === "/admin"
                        ? pathname === path
                        : pathname.startsWith(path);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                          active
                            ? "bg-[#ff6b00] text-white"
                            : "text-white/65 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <Icon size={18} />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
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
