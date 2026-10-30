"use client";

import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminActionResult } from "@/lib/admin-action-result";

const TOAST_EVENT = "admin-toast";
const TOAST_DURATION_MS = 6000;

/** Shows a notice at the bottom right of the admin panel from anywhere in client code. */
export function showAdminToast(result: AdminActionResult) {
  window.dispatchEvent(new CustomEvent<AdminActionResult>(TOAST_EVENT, { detail: result }));
}

/** Mounted once in the admin layout. */
export function AdminToaster() {
  const [toast, setToast] = useState<(AdminActionResult & { id: number }) | null>(null);

  useEffect(() => {
    let counter = 0;
    function handle(event: Event) {
      counter += 1;
      setToast({ ...(event as CustomEvent<AdminActionResult>).detail, id: counter });
    }
    window.addEventListener(TOAST_EVENT, handle);
    return () => window.removeEventListener(TOAST_EVENT, handle);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const Icon = toast.ok ? CheckCircle2 : TriangleAlert;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border p-4 text-sm font-bold shadow-2xl ${
        toast.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">{toast.message}</span>
      <button type="button" onClick={() => setToast(null)} aria-label="Kapat" className="shrink-0 opacity-60 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  );
}
