import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { resolveCategoryIcon } from "@/lib/categories";
import { hubHref, type CategoryHub } from "@/lib/category-hub";

const count = (value: number) => value.toLocaleString("tr-TR");

/** Desktop sidebar: all main categories, the selected branch expanded. */
function CategorySidebar({ hub }: { hub: CategoryHub }) {
  const { mains, totals, selection } = hub;
  const selectedId = selection?.category.id ?? null;

  return (
    <nav
      aria-label="Kategoriler"
      className="border border-black/20 border-t-[3px] border-t-[#161616] bg-white"
    >
      <p className="border-b border-black/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-black/45">
        Kategoriler
      </p>
      <ul className="max-h-[calc(100vh-11rem)] overflow-y-auto py-1">
        <li>
          <SidebarLink
            href={hubHref(null)}
            active={selection === null}
            icon={<LayoutGrid size={16} />}
            label="Tüm kategoriler"
            count={totals.productCount}
          />
        </li>
        {mains.map((main) => {
          const Icon = resolveCategoryIcon(main.icon);
          const expanded = selection?.branchId === main.id;
          return (
            <li key={main.id}>
              <SidebarLink
                href={hubHref(main.slug)}
                active={selectedId === main.id}
                icon={<Icon size={16} />}
                label={main.name}
                count={main.productCount}
              />
              {expanded && main.children.length > 0 ? (
                <ul className="ml-6 border-l border-black/15 py-1">
                  {main.children.map((child) => (
                    <li key={child.id}>
                      <SidebarLink
                        href={hubHref(child.slug)}
                        active={selectedId === child.id}
                        label={child.name}
                        count={child.productCount}
                        nested
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile replacement for the sidebar: one scrollable row of main categories. */
function CategoryChips({ hub }: { hub: CategoryHub }) {
  const { mains, selection } = hub;
  const activeMainId = selection?.branchId ?? null;

  return (
    <nav aria-label="Kategoriler" className="-mx-4 overflow-x-auto px-4 pb-1 lg:hidden">
      <ul className="flex w-max gap-2">
        <li>
          <Chip href={hubHref(null)} active={selection === null} label="Tümü" />
        </li>
        {mains.map((main) => (
          <li key={main.id}>
            <Chip href={hubHref(main.slug)} active={activeMainId === main.id} label={main.name} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SidebarLink({
  href,
  active,
  label,
  count: total,
  icon,
  nested = false,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  icon?: React.ReactNode;
  nested?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 border-l-[3px] text-sm transition ${
        active
          ? "border-[#3B66E0] bg-[#EEF3FF] font-black text-[#2A4FBF]"
          : "border-transparent font-semibold text-black/70 hover:bg-black/3 hover:text-black"
      } ${nested ? "py-2 pl-3 pr-4 text-[13px]" : "px-4 py-2.5"}`}
    >
      {icon ? <span className="shrink-0 text-[#3B66E0]">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-xs font-bold text-black/35">{count(total)}</span>
    </Link>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block whitespace-nowrap border px-3.5 py-2 text-sm font-bold transition ${
        active
          ? "border-[#161616] bg-[#161616] text-white"
          : "border-black/20 bg-white text-black/70 hover:border-black/40"
      }`}
    >
      {label}
    </Link>
  );
}

/**
 * Shared layout of the category area: sidebar (chips on mobile) next to the
 * page content. Used by /categories and every /category/[slug] page so both
 * behave as one section of the site.
 */
export function CategoryShell({
  hub,
  children,
}: {
  hub: CategoryHub;
  children: React.ReactNode;
}) {
  return (
    <>
      <CategoryChips hub={hub} />
      <div className="mt-4 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <CategorySidebar hub={hub} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
