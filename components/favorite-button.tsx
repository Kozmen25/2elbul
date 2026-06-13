"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFavorite } from "@/app/favoriler/actions";

type FavoriteButtonProps = {
  listingId: string;
  initialIsFavorite: boolean;
  isAuthenticated: boolean;
  loginNext: string;
  compact?: boolean;
};

export function FavoriteButton({
  listingId,
  initialIsFavorite,
  isAuthenticated,
  loginNext,
  compact = false,
}: FavoriteButtonProps) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!isAuthenticated) {
      router.push(`/giris?next=${encodeURIComponent(loginNext)}`);
      return;
    }

    const previousValue = isFavorite;
    setIsFavorite(!previousValue);
    setMessage("");

    startTransition(async () => {
      const result = await setFavorite(listingId);

      if (result.requiresAuth) {
        router.push(`/giris?next=${encodeURIComponent(loginNext)}`);
        return;
      }

      if (!result.ok) {
        setIsFavorite(previousValue);
        setMessage(result.message ?? "Favori işlemi tamamlanamadı.");
        return;
      }

      setIsFavorite(result.isFavorite);
      router.refresh();
    });
  }

  return (
    <div className={compact ? "" : "relative"}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
        aria-pressed={isFavorite}
        title={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border font-bold transition disabled:opacity-60 ${
          compact ? "size-10" : "px-3 py-2 text-sm"
        } ${
          isFavorite
            ? "border-[#ff6b00]/30 bg-[#fff1e7] text-[#d95700]"
            : "border-black/10 bg-white text-black/55 hover:border-[#ff6b00]/35 hover:text-[#ff6b00]"
        }`}
      >
        <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
        {!compact && (isFavorite ? "Favoride" : "Favorile")}
      </button>
      {message && (
        <p className="mt-2 text-xs font-semibold text-red-600">{message}</p>
      )}
    </div>
  );
}
