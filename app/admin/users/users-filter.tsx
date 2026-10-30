"use client";

import { Search, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "verified", label: "Doğrulanmış" },
  { key: "unverified", label: "Doğrulanmamış" },
  { key: "active", label: "Aktif" },
  { key: "banned", label: "Engelli" },
  { key: "admin", label: "Admin" },
  { key: "normal", label: "Normal" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function isFilterKey(value: string | null): value is FilterKey {
  return FILTERS.some((filter) => filter.key === value);
}

export function UsersFilter({
  total,
  visible,
  q,
  filter,
}: {
  total: number;
  visible: number;
  q: string;
  filter: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const buildHref = (nextQuery: string, nextFilter: FilterKey) => {
    const params = new URLSearchParams(searchParams);
    if (nextQuery) params.set("q", nextQuery);
    else params.delete("q");
    if (nextFilter !== "all") params.set("filter", nextFilter);
    else params.delete("filter");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const updateHref = (href: string) => {
    startTransition(() => router.replace(href));
  };

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="group relative w-full sm:max-w-sm">
          <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-black/35">
            <Search size={16} />
          </span>
          <input
            defaultValue={q}
            name="q"
            type="search"
            placeholder="E-posta, kullanıcı adı veya ID ara…"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const value = (event.currentTarget.value || "").trim();
                const filterKey = isFilterKey(filter) ? filter : "all";
                const href = buildHref(value, filterKey);
                updateHref(href);
              }
            }}
            className="w-full rounded-xl border border-black/10 bg-[#fafaf8] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#3B66E0] focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-3 text-sm text-black/45">
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} />
            {visible}/{total} gösteriliyor
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <Link
              key={key}
              href={buildHref(q, key)}
              onClick={(event) => {
                event.preventDefault();
                const href = buildHref(q, key);
                updateHref(href);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                active
                  ? "bg-[#3B66E0] text-white"
                  : "bg-[#fafaf8] text-black/55 hover:bg-[#E4ECFF] hover:text-[#2A4FBF]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
      {isPending && (
        <p className="mt-2 text-xs text-black/40">Güncelleniyor…</p>
      )}
    </div>
  );
}
