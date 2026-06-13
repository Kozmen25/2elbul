import {
  ArrowUpRight,
  BellRing,
  CalendarDays,
  Heart,
  ListPlus,
  LogOut,
  Mail,
  MapPin,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  if (!supabase || !data.user) {
    redirect("/giris?next=/hesabim");
  }

  const [favoritesResult, alertsResult, listingsResult] = await Promise.all([
    supabase
      .from("favorites")
      .select("listing_id", { count: "exact", head: true })
      .eq("user_id", data.user.id),
    supabase
      .from("price_alerts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id),
    supabase
      .from("listings")
      .select(
        "id, product_id, title, price, city, source, url, condition, created_at",
      )
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  if (favoritesResult.error) {
    console.error("Supabase account favorites query failed:", favoritesResult.error);
  }
  if (alertsResult.error) {
    console.error("Supabase account price alerts query failed:", alertsResult.error);
  }
  if (listingsResult.error) {
    console.error("Supabase account listings query failed:", listingsResult.error);
  }

  const favoriteCount = favoritesResult.count ?? 0;
  const alertCount = alertsResult.count ?? 0;
  const listings = listingsResult.data ?? [];

  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8] py-10 sm:py-14">
      <div className="container-shell">
        <div className="rounded-3xl border border-black/8 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)] sm:p-9">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div>
              <span className="grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
                <UserRound size={24} />
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-[-0.04em]">
                Hesabım
              </h1>
              <p className="mt-2 text-black/50">
                İlanlarını, favorilerini ve fiyat alarmlarını buradan yönet.
              </p>
            </div>

            <form action={logout}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 font-bold text-red-600 transition hover:bg-red-50 sm:w-auto"
              >
                <LogOut size={18} /> Çıkış yap
              </button>
            </form>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <InfoCard
              icon={<Mail size={19} />}
              label="E-posta adresi"
              value={data.user.email ?? "E-posta bulunamadı"}
            />
            <InfoCard
              icon={<CalendarDays size={19} />}
              label="Hesap oluşturma tarihi"
              value={formatDate(data.user.created_at)}
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={<Heart size={22} />}
              label="Favori ilan"
              count={favoriteCount}
              emptyMessage="Henüz favori ilanınız yok"
              href="/favoriler"
            />
            <StatCard
              icon={<BellRing size={22} />}
              label="Fiyat alarmı"
              count={alertCount}
              emptyMessage="Henüz fiyat alarmınız yok"
            />
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-black/8 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-9">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-bold text-[#ff6b00]">İlanlarım</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
                Eklediğim ilanlar
              </h2>
            </div>
            <Link href="/listing-ekle" className="orange-button px-4 py-3">
              <ListPlus size={18} /> Yeni ilan ekle
            </Link>
          </div>

          {listings.length ? (
            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => (
                <article
                  key={listing.id}
                  className="flex flex-col rounded-2xl border border-black/8 bg-[#fafaf8] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black/50">
                      {String(listing.condition)}
                    </span>
                    <span className="text-xs font-semibold text-black/35">
                      {formatDate(String(listing.created_at))}
                    </span>
                  </div>
                  <h3 className="mt-4 font-black leading-6">
                    {String(listing.title)}
                  </h3>
                  <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#ff6b00]">
                    {formatPrice(Number(listing.price))}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-black/50">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={15} /> {String(listing.city)}
                    </span>
                    <span>{String(listing.source)}</span>
                  </div>
                  <a
                    href={String(listing.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex items-center gap-1.5 text-sm font-bold text-[#ff6b00] hover:underline"
                  >
                    İlana git <ArrowUpRight size={16} />
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-12 text-center">
              <ListPlus size={28} className="mx-auto text-black/20" />
              <p className="mt-4 font-bold">Henüz ilan eklemediniz</p>
              <p className="mt-1 text-sm text-black/45">
                Eklediğiniz ilanlar burada listelenecek.
              </p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4 sm:p-5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-black/40">
        <span className="text-[#ff6b00]">{icon}</span>
        {label}
      </p>
      <p className="mt-3 break-all font-bold">{value}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  count,
  emptyMessage,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  emptyMessage: string;
  href?: string;
}) {
  const content = (
    <div className="h-full rounded-2xl border border-black/8 p-5 transition hover:border-[#ff6b00]/30">
      <div className="flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
          {icon}
        </span>
        <span className="text-3xl font-black tracking-[-0.04em]">{count}</span>
      </div>
      <p className="mt-4 font-black">{label}</p>
      <p className="mt-1 text-sm text-black/45">
        {count > 0 ? `${count} kayıt bulunuyor` : emptyMessage}
      </p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
