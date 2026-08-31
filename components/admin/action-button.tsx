"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * One server-action trigger button: runs an admin user action, shows the
 * returned message inline, and refreshes the page on success so the detail
 * page's badges/audit-trail reflect the new state. The action object is a
 * server-action wrapper like verifyUser/sendResetMail — never a value-bearing
 * payload (no passwords, tokens, or recovery links are ever surfaced).
 */
export function ActionButton({
  label,
  pendingLabel,
  run,
  tone = "primary",
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  run: () => Promise<{ ok: boolean; message: string }>;
  tone?: "primary" | "danger" | "ghost";
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function onClick() {
    setError("");
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  const tones = {
    primary:
      "bg-[#ff6b00] text-white hover:bg-[#e85f00]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost:
      "border border-black/10 bg-white font-bold text-black/70 hover:bg-[#fafaf8]",
  };

  return (
    <div>
      <button
        type="button"
        disabled={pending || disabled}
        onClick={onClick}
        className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${tones[tone]}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {error && (
        <p className="mt-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
