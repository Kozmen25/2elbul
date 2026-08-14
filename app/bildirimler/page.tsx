import {
  ArrowRight,
  BellRing,
  CheckCheck,
  Inbox,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Bildirimlerim | 2ElBul",
  robots: {
    index: false,
    follow: false,
  },
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

function formatRelativeTime(dateStr: string) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat önce`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "Dün";
  if (diffDay < 7) return `${diffDay} gün önce`;
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getTypeIcon(type: string) {
  switch (type) {
    case "price_alert":
      return "📉";
    case "new_listing":
      return "🆕";
    case "price_drop":
      return "💰";
    case "system":
      return "🔔";
    default:
      return "🔔";
  }
}

function getNotificationLink(notif: NotificationRow): string {
  const meta = notif.metadata;
  if (meta?.product_id) return `/product/${meta.product_id}`;
  if (notif.type === "new_listing" && meta?.query) return `/search?q=${encodeURIComponent(String(meta.query))}`;
  if (meta?.listing_id) return `/listing/${meta.listing_id}`;
  return "#";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page) || 1);
  const perPage = 20;
  const offset = (currentPage - 1) * perPage;

  const supabase = await createSupabaseServerClient();
  const { data: authData } = (await supabase?.auth.getUser()) ?? {
    data: { user: null },
  };

  if (!supabase || !authData.user) {
    redirect("/giris?next=/bildirimler");
  }

  const [notificationsResult, countResult] = await Promise.all([
    supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1),
    supabase
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", authData.user.id),
  ]);

  const notifications = (notificationsResult.data ?? []) as NotificationRow[];
  const totalCount = countResult.count ?? 0;
  const totalPages = Math.ceil(totalCount / perPage);
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (notificationsResult.error) {
    console.error("Notifications page query failed:", notificationsResult.error);
  }

  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8] py-10 sm:py-14">
      <div className="container-shell">
        <div className="mb-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
            <BellRing size={23} />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
            Bildirimlerim
          </h1>
          <p className="mt-2 text-black/50">
            Fiyat alarmları ve sistem bildirimleri.
          </p>
        </div>

        {notificationsResult.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
            Bildirimler yüklenirken bir sorun oluştu. Lütfen daha sonra tekrar
            deneyin.
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/15 bg-white px-6 py-16 text-center">
            <Inbox size={30} className="mx-auto text-black/20" />
            <h2 className="mt-4 text-xl font-black">
              Henüz bildiriminiz yok.
            </h2>
            <p className="mt-2 text-sm text-black/45">
              Fiyat alarmı oluşturduğunuzda bildirimleriniz burada görünecek.
            </p>
            <Link href="/search" className="orange-button mt-6 inline-flex px-5 py-3">
              İlan ara <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <>
            {unreadCount > 0 && (
              <MarkAllReadButton />
            )}

            <div className="divide-y divide-black/6 rounded-2xl border border-black/8 bg-white">
              {notifications.map((notif) => (
                <article
                  key={notif.id}
                  className={`flex items-start gap-4 px-5 py-4 transition ${
                    !notif.read_at ? "bg-[#fff8f0]" : ""
                  } ${getNotificationLink(notif) !== "#" ? "hover:bg-black/2" : ""}`}
                >
                  <span className="mt-0.5 shrink-0 text-lg leading-none">
                    {getTypeIcon(notif.type)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-bold leading-tight">
                        {notif.title}
                      </h3>
                      {!notif.read_at && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#ff6b00]" />
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-black/55">
                      {notif.body}
                    </p>
                    <p className="mt-1.5 text-xs text-black/30">
                      {formatRelativeTime(notif.created_at)}
                    </p>
                  </div>

                  {getNotificationLink(notif) !== "#" && (
                    <Link
                      href={getNotificationLink(notif)}
                      className="mt-1 shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#ff6b00] transition hover:bg-[#fff1e7]"
                    >
                      Görüntüle
                    </Link>
                  )}
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => {
                    const isCurrent = page === currentPage;
                    return (
                      <Link
                        key={page}
                        href={`/bildirimler?page=${page}`}
                        className={`grid size-9 place-items-center rounded-xl text-sm font-bold transition ${
                          isCurrent
                            ? "bg-[#ff6b00] text-white"
                            : "border border-black/10 text-black/60 hover:border-[#ff6b00]/30 hover:text-[#ff6b00]"
                        }`}
                      >
                        {page}
                      </Link>
                    );
                  },
                )}
              </div>
            )}

            <p className="mt-4 text-center text-xs text-black/35">
              Toplam {totalCount} bildirim
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function MarkAllReadButton() {
  return (
    <div className="mb-4 flex justify-end">
      <form
        action={async () => {
          "use server";
          const supabase = await createSupabaseServerClient();
          const { data: auth } = await supabase?.auth.getUser() ?? {
            data: { user: null },
          };
          if (!supabase || !auth?.user) return;
          await supabase
            .from("user_notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", auth.user.id)
            .is("read_at", null);
        }}
      >
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-[#ff6b00] transition hover:bg-[#fff1e7]"
        >
          <CheckCheck size={15} /> Tümünü okundu işaretle
        </button>
      </form>
    </div>
  );
}
