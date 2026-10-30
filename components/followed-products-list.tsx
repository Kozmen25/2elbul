"use client";

import { BellOff } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setProductFollow } from "@/app/follows/actions";
import { formatCurrencyTRY } from "@/lib/formatters";

export type FollowedProduct = {
  productId: string;
  name: string;
  slug: string | null;
  /** Lowest visible price now; null when the product has no listing. */
  lowestPrice: number | null;
  listingCount: number;
};

export function FollowedProductsList({ products }: { products: FollowedProduct[] }) {
  const [items, setItems] = useState(products);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function unfollow(productId: string) {
    setMessage("");
    startTransition(async () => {
      const result = await setProductFollow(productId, false);
      if (result.ok) setItems((current) => current.filter((item) => item.productId !== productId));
      else setMessage(result.message);
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/15 bg-white px-6 py-10 text-center">
        <h3 className="text-lg font-black">Takip ettiğin ürün yok.</h3>
        <p className="mt-2 text-sm text-black/45">
          Ürün sayfasındaki &quot;Ürünü takip et&quot; düğmesiyle fiyat düşüşlerinden ve yeni uygun ilanlardan haberdar ol.
        </p>
      </div>
    );
  }

  return (
    <div>
      {message ? <p className="mb-3 text-sm font-semibold text-red-700">{message}</p> : null}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.productId} className="flex flex-col rounded-2xl border border-black/9 bg-white p-5">
            <h3 className="font-black leading-6">{item.name}</h3>
            <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#3B66E0]">
              {item.lowestPrice !== null ? formatCurrencyTRY(item.lowestPrice) : "Şu an ilan yok"}
            </p>
            <p className="mt-1 text-xs font-bold text-black/40">
              {item.lowestPrice !== null ? `En düşük fiyat · ${item.listingCount} ilan` : "Yeni ilan gelince haber vereceğiz"}
            </p>
            <div className="mt-5 flex items-center gap-2">
              {item.slug ? (
                <Link
                  href={`/product/${item.slug}`}
                  className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-center text-sm font-bold text-black/65 transition hover:border-[#3B66E0]/35 hover:text-[#2A4FBF]"
                >
                  Ürünü gör
                </Link>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => unfollow(item.productId)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-bold text-black/55 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50"
              >
                <BellOff size={15} /> Takibi bırak
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
