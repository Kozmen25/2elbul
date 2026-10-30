"use client";

import { Bell, BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setProductFollow } from "@/app/follows/actions";

type FollowProductButtonProps = {
  productId: string;
  initialFollowing: boolean;
  isAuthenticated: boolean;
  loginNext: string;
};

/** One-click product follow: the daily check notifies on price drops and new cheaper listings. */
export function FollowProductButton({
  productId,
  initialFollowing,
  isAuthenticated,
  loginNext,
}: FollowProductButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!isAuthenticated) {
      router.push(`/giris?next=${encodeURIComponent(loginNext)}`);
      return;
    }

    const next = !following;
    setFollowing(next);
    setMessage("");

    startTransition(async () => {
      const result = await setProductFollow(productId, next);
      if (result.requiresAuth) {
        router.push(`/giris?next=${encodeURIComponent(loginNext)}`);
        return;
      }
      setFollowing(result.following);
      setMessage(result.message);
    });
  }

  const Icon = following ? BellRing : Bell;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:opacity-60 ${
          following
            ? "border-[#3B66E0]/30 bg-[#EEF3FF] text-[#2A4FBF]"
            : "border-black/15 bg-white text-black/70 hover:border-[#3B66E0]/40 hover:text-[#2A4FBF]"
        }`}
      >
        <Icon size={16} />
        {following ? "Takip ediliyor" : "Ürünü takip et"}
      </button>
      {message ? (
        <p role="status" className="mt-2 text-xs font-semibold text-black/55">
          {message}
        </p>
      ) : null}
    </div>
  );
}
