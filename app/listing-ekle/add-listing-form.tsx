"use client";

import { CheckCircle2, ClipboardPlus, Send, TriangleAlert } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ProductOption } from "@/lib/listings";
import {
  submitListing,
  type SubmissionState,
} from "./actions";

const sources = [
  "Sahibinden",
  "Letgo",
  "Facebook Marketplace",
  "Dolap",
];

const conditions = [
  "Sıfır",
  "Yeni gibi",
  "Çok iyi",
  "İyi",
  "İkinci El",
  "Kullanılmış",
];

const cities = [
  "İstanbul",
  "Ankara",
  "İzmir",
  "Bursa",
  "Antalya",
  "Kocaeli",
  "Eskişehir",
  "Konya",
  "Adana",
  "Mersin",
];

const initialState: SubmissionState = {
  status: "idle",
  message: "",
};

export function AddListingForm({
  products,
  loadError,
}: {
  products: ProductOption[];
  loadError?: string;
}) {
  const [state, formAction] = useActionState(submitListing, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.status]);

  const formDisabled = Boolean(loadError) || products.length === 0;

  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8] py-10 sm:py-14">
      <div className="container-shell">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
              <ClipboardPlus size={24} />
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              İlan ekle
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-black/50 sm:text-base">
              Başka bir platformdaki ilanı 2ElBul&apos;a gönder. İncelendikten
              sonra fiyat karşılaştırmalarında yayınlayalım.
            </p>
          </div>

          {(loadError || state.status === "error") && (
            <div
              role="alert"
              className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 sm:p-5"
            >
              <TriangleAlert className="mt-0.5 shrink-0" size={22} />
              <p className="font-bold">{loadError || state.message}</p>
            </div>
          )}

          {state.status === "success" && (
            <div
              role="status"
              className="mt-8 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800 sm:p-5"
            >
              <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
              <p className="font-bold">{state.message}</p>
            </div>
          )}

          <form
            ref={formRef}
            action={formAction}
            className="mt-8 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] sm:p-8"
          >
            <fieldset disabled={formDisabled} className="grid gap-5 sm:grid-cols-2">
              <FormSelect label="Ürün adı" name="product_id" required>
                <option value="">Ürün seç</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </FormSelect>

              <FormInput
                label="İlan başlığı"
                name="title"
                maxLength={160}
                placeholder="Örn. Kutulu iPhone 13 128 GB"
                required
              />

              <FormInput
                label="Fiyat"
                name="price"
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                placeholder="25.000"
                suffix="TL"
                required
              />

              <FormSelect label="Şehir" name="city" required>
                <option value="">Şehir seç</option>
                {cities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </FormSelect>

              <FormSelect label="Kaynak" name="source" required>
                <option value="">Kaynak seç</option>
                {sources.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </FormSelect>

              <FormSelect label="Durum" name="condition" required>
                <option value="">Durum seç</option>
                {conditions.map((condition) => (
                  <option key={condition}>{condition}</option>
                ))}
              </FormSelect>

              <div className="sm:col-span-2">
                <FormInput
                  label="İlan linki"
                  name="url"
                  type="url"
                  inputMode="url"
                  placeholder="https://..."
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <FormInput
                  label="Görsel linki"
                  name="image_url"
                  type="url"
                  inputMode="url"
                  placeholder="https://..."
                />
              </div>
            </fieldset>

            <div className="mt-7 border-t border-black/8 pt-6">
              <SubmitButton disabled={formDisabled} />
              <p className="mt-3 text-center text-xs leading-5 text-black/40">
                Gönderilen ilanlar yönetici onayından sonra arama sonuçlarında
                yayınlanır.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="orange-button w-full py-4 disabled:cursor-not-allowed disabled:opacity-55 sm:px-10"
    >
      <Send size={18} />
      {pending ? "Gönderiliyor..." : "İlanı gönder"}
    </button>
  );
}

function FormInput({
  label,
  suffix,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  suffix?: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <span className="relative block">
        <input
          {...props}
          className={`field h-13 px-4 disabled:bg-black/3 ${suffix ? "pr-12" : ""}`}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-black/35">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

function FormSelect({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        {...props}
        defaultValue=""
        className="field h-13 px-4 disabled:bg-black/3"
      >
        {children}
      </select>
    </label>
  );
}
