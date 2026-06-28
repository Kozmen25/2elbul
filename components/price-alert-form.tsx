"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { createPriceAlert } from "@/app/price-alerts/actions";

export function PriceAlertForm({
  productId,
  productName,
  suggestedPrice,
  isAuthenticated,
  loginNext,
}: {
  productId: string;
  productName: string;
  suggestedPrice: number | null;
  isAuthenticated: boolean;
  loginNext: string;
}) {
  const [targetPrice, setTargetPrice] = useState(
    suggestedPrice ? String(Math.round(suggestedPrice)) : "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-[#ff6b00]/15 bg-[#fff7f1] p-5">
        <div className="flex items-center gap-2 text-[#d95700]">
          <BellRing size={18} />
          <p className="font-black">Fiyat alarmı</p>
        </div>
        <p className="mt-2 text-sm text-black/55">
          {productName} için hedef fiyat belirleyip düşüşlerden haberdar olun.
        </p>
        <Link
          href={`/giris?next=${encodeURIComponent(loginNext)}`}
          className="orange-button mt-4 inline-flex px-4 py-3"
        >
          Giriş yap ve alarm kur
        </Link>
      </div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createPriceAlert({
        productId,
        targetPrice: Number(targetPrice),
      });
      setOk(result.ok);
      setMessage(result.message);
      if (result.requiresAuth) {
        setOk(false);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.03)]"
    >
      <div className="flex items-center gap-2 text-[#ff6b00]">
        <BellRing size={18} />
        <p className="font-black">Fiyat alarmı kur</p>
      </div>
      <p className="mt-2 text-sm text-black/55">
        {productName} ilanları hedef fiyatın altına düştüğünde alarmınız aktif
        kalır.
      </p>
      <label className="mt-4 block text-sm font-bold">
        Hedef fiyat (TL)
        <input
          type="number"
          min="1"
          step="1"
          required
          value={targetPrice}
          onChange={(event) => setTargetPrice(event.target.value)}
          className="field mt-2 px-3 py-3"
          placeholder="Örn. 20000"
          disabled={pending}
        />
      </label>
      {message && (
        <p
          className={`mt-3 text-sm font-bold ${ok ? "text-green-700" : "text-red-600"}`}
        >
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="orange-button mt-4 w-full py-3 disabled:opacity-50"
      >
        {pending ? "Kaydediliyor..." : "Alarmı kaydet"}
      </button>
    </form>
  );
}
