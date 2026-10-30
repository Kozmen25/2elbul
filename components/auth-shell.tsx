import type { ReactNode } from "react";
import { BellRing, Bookmark, ChartNoAxesCombined, type LucideIcon } from "lucide-react";

type AuthBenefit = {
  icon: LucideIcon;
  title: string;
  description: string;
};

/** What an account adds; every item is a live feature of the site. */
const AUTH_BENEFITS: AuthBenefit[] = [
  {
    icon: BellRing,
    title: "Fiyat alarmı",
    description: "Hedef fiyatına inen ilanı ilk sen gör.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Ürün takibi",
    description: "Takip ettiğin modelin fiyatı düşünce haber al.",
  },
  {
    icon: Bookmark,
    title: "Kayıtlı aramalar",
    description: "Aramana uyan yeni ilanlar sana gelsin.",
  },
];

/**
 * Two-pane layout of the sign-in and sign-up pages: a brand panel with what an
 * account offers (desktop only) next to the form. The site header already
 * shows the logo, so the page does not repeat it.
 */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#f4f5f7] py-8 sm:py-14">
      <div className="container-shell">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_24px_70px_rgba(11,21,48,0.08)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0B1530] p-10 text-white lg:flex">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(59,102,224,0.45),transparent_55%)]"
            />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9DB5FF]">
                2ElBul hesabı
              </p>
              <p className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em]">
                İkinci el piyasasını veriyle takip et.
              </p>
              <p className="mt-4 text-sm leading-7 text-white/75">
                Farklı platformlardaki ilanları tek yerde karşılaştır, doğru fiyatı
                gör ve doğru zamanda karar ver.
              </p>
            </div>

            <ul className="relative mt-10 grid gap-5">
              {AUTH_BENEFITS.map(({ icon: Icon, title: benefitTitle, description: text }) => (
                <li key={benefitTitle} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#9DB5FF] ring-1 ring-white/15">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{benefitTitle}</span>
                    <span className="mt-0.5 block text-sm text-white/70">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          <div className="px-5 py-8 sm:px-10 sm:py-12">
            <div className="mx-auto max-w-sm">
              <h1 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-black/60">{description}</p>
              <div className="mt-7">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
