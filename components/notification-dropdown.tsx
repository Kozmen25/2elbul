"use client";

import { Bell, ArrowRight, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationDropdown({ initialUnreadCount = 0 }: { initialUnreadCount?: number }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=5&unread_count=true");
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) {
        setNotifications(json.notifications ?? []);
        setUnreadCount(json.unreadCount ?? 0);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }

  function getLink(notif: Notification): string {
    const meta = notif.metadata;
    if (meta?.product_id) return `/product/${meta.product_id}`;
    if (notif.type === "new_listing" && meta?.query) return `/search?q=${encodeURIComponent(String(meta.query))}`;
    if (meta?.listing_id) return `/listing/${meta.listing_id}`;
    return "/bildirimler";
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center gap-1.5 rounded-xl px-3 py-2.5 transition hover:bg-black/4"
        aria-label={`Bildirimler${unreadCount > 0 ? ` (${unreadCount} okunmamış)` : ""}`}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid size-4.5 place-items-center rounded-full bg-red-500 text-[9px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-black/8 bg-white shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
          <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
            <span className="text-sm font-bold">Bildirimler</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-semibold text-[#ff6b00] hover:underline"
              >
                <CheckCheck size={14} /> Tümünü okundu işaretle
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell size={24} className="text-black/20" />
                <p className="text-sm font-semibold text-black/45">
                  Bildirimin bulunmuyor
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <Link
                  key={notif.id}
                  href={getLink(notif)}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col gap-1 border-b border-black/4 px-4 py-3 transition last:border-0 hover:bg-black/2 ${
                    !notif.read_at ? "bg-[#fff8f0]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold leading-tight">
                      {notif.title}
                    </span>
                    {!notif.read_at && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-[#ff6b00]" />
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-black/50">
                    {notif.body}
                  </p>
                  <span className="text-[10px] text-black/30">
                    {formatRelativeTime(notif.created_at)}
                  </span>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/bildirimler"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-black/8 px-4 py-3 text-sm font-semibold text-[#ff6b00] transition hover:bg-black/2"
          >
            Tüm bildirimleri gör <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </div>
  );
}

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
  return new Date(dateStr).toLocaleDateString("tr-TR");
}
