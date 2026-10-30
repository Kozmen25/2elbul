"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, Loader2, RotateCcw, Send, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Combobox, type ComboboxItem } from "@/components/combobox";
import { LISTING_CONDITIONS, LISTING_SOURCES } from "@/lib/listings";
import { searchCities } from "@/lib/listing-submission/cities";
import { DRAFT_STORAGE_KEY, isEmptyDraft, parseDraft, serializeDraft, type ListingDraft } from "@/lib/listing-submission/draft";
import { ACCEPTED_IMAGE_TYPES, shrinkImage, UnsupportedImageError } from "@/lib/listing-submission/image-client";
import { formatTlInput } from "@/lib/listing-submission/price";
import { detectSourceFromHost, normalizeListingUrl, SOURCE_DOMAINS } from "@/lib/listing-submission/url";
import {
  listingWarnings,
  STEP_FIELDS,
  TITLE_MAX_LENGTH,
  validateListingSubmission,
  validateStep,
  type ListingField,
  type ListingFieldErrors,
  type ListingSubmissionInput,
} from "@/lib/listing-submission/validation";
import { submitListing } from "./actions";
import { ListingPreview } from "./listing-preview";

const STEPS = ["Ürün", "Detaylar", "Önizleme"] as const;
const PRODUCT_SEARCH_DEBOUNCE_MS = 250;
const DRAFT_SAVE_DEBOUNCE_MS = 500;

const EMPTY_INPUT: ListingSubmissionInput = {
  productId: "",
  title: "",
  price: "",
  city: "",
  source: "",
  condition: "",
  url: "",
};

type ProductHit = { id: string; name: string; category: string | null };

export function AddListingWizard() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<ListingSubmissionInput>(EMPTY_INPUT);
  const [productName, setProductName] = useState("");
  const [errors, setErrors] = useState<ListingFieldErrors>({});
  const [serverMessage, setServerMessage] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [image, setImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [imageNotice, setImageNotice] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [submitting, startSubmit] = useTransition();

  // --- draft ---------------------------------------------------------------
  useEffect(() => {
    try {
      setDraft(parseDraft(window.localStorage.getItem(DRAFT_STORAGE_KEY)));
    } catch {
      // storage blocked: no draft feature, the form still works
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (isEmptyDraft(input)) window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        else window.localStorage.setItem(DRAFT_STORAGE_KEY, serializeDraft(input, productName));
      } catch {
        // storage blocked or full: ignore
      }
    }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input, productName]);

  function restoreDraft() {
    if (!draft) return;
    setInput(draft.input);
    setProductName(draft.productName);
    setDraft(null);
  }

  function discardDraft() {
    setDraft(null);
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  // --- fields --------------------------------------------------------------
  const setField = useCallback((field: ListingField, value: string) => {
    setInput((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }, []);

  const warnings = useMemo(() => listingWarnings(input), [input]);

  // --- product search ------------------------------------------------------
  const [productItems, setProductItems] = useState<ComboboxItem[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const productAbort = useRef<AbortController | null>(null);
  const productTimer = useRef<number | undefined>(undefined);

  const searchProducts = useCallback((query: string) => {
    window.clearTimeout(productTimer.current);
    productAbort.current?.abort();
    if (query.trim().length < 2) {
      setProductItems([]);
      setProductLoading(false);
      return;
    }
    setProductLoading(true);
    productTimer.current = window.setTimeout(async () => {
      const controller = new AbortController();
      productAbort.current = controller;
      try {
        const response = await fetch(`/api/products/lookup?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = (await response.json()) as { products?: ProductHit[] };
        setProductItems((data.products ?? []).map((hit) => ({ id: hit.id, label: hit.name, hint: hit.category ?? undefined })));
        setProductLoading(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setProductItems([]);
          setProductLoading(false);
        }
      }
    }, PRODUCT_SEARCH_DEBOUNCE_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(productTimer.current), []);

  // --- city ----------------------------------------------------------------
  const [cityQuery, setCityQuery] = useState("");
  const cityItems = useMemo(() => searchCities(cityQuery).map((city) => ({ id: city, label: city })), [cityQuery]);

  // --- link: pasting one picks the marketplace for the user ------------------
  function handleUrlChange(value: string) {
    setField("url", value);
    const normalized = normalizeListingUrl(value);
    if (normalized.ok && !input.source) {
      const detected = detectSourceFromHost(normalized.host);
      if (detected) setField("source", detected);
    }
  }

  // --- photo ---------------------------------------------------------------
  async function handleImage(file: File | undefined) {
    if (!file) return;
    setImageNotice("");
    setImageBusy(true);
    try {
      const shrunk = await shrinkImage(file);
      setImage((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return { file: shrunk, previewUrl: URL.createObjectURL(shrunk) };
      });
    } catch (error) {
      setImageNotice(error instanceof UnsupportedImageError ? error.message : "Fotoğraf işlenemedi.");
    } finally {
      setImageBusy(false);
    }
  }

  function removeImage() {
    setImage((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }

  // --- navigation ----------------------------------------------------------
  const headingRef = useRef<HTMLHeadingElement>(null);

  function goTo(next: number) {
    setStep(next);
    setServerMessage("");
    window.setTimeout(() => headingRef.current?.focus(), 0);
  }

  function next() {
    const stepErrors = validateStep(step, input);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    goTo(step + 1);
  }

  function submit() {
    const validation = validateListingSubmission(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      goTo(STEP_FIELDS.findIndex((fields) => fields.some((field) => validation.errors[field])));
      return;
    }

    const formData = new FormData();
    formData.set("product_id", input.productId);
    formData.set("title", input.title);
    formData.set("price", input.price);
    formData.set("city", input.city);
    formData.set("source", input.source);
    formData.set("condition", input.condition);
    formData.set("url", input.url);
    if (image) formData.set("image", image.file);

    setServerMessage("");
    startSubmit(async () => {
      const result = await submitListing(formData);
      if (result.ok) {
        discardDraft();
        removeImage();
        setDone(result.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setServerMessage(result.message);
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        const target = STEP_FIELDS.findIndex((fields) => fields.some((field) => result.fieldErrors?.[field]));
        if (target >= 0) goTo(target);
      }
    });
  }

  function reset() {
    setInput(EMPTY_INPUT);
    setProductName("");
    setErrors({});
    setServerMessage("");
    setDone(null);
    setStep(0);
  }

  const preview = {
    productName,
    title: input.title,
    price: input.price,
    condition: input.condition,
    city: input.city,
    source: input.source,
    imageUrl: image?.previewUrl ?? null,
  };

  if (done) {
    return (
      <Shell>
        <div role="status" className="mx-auto mt-10 max-w-xl rounded-3xl border border-green-200 bg-white p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
          <CheckCircle2 className="mx-auto text-green-600" size={48} aria-hidden />
          <h2 className="mt-4 text-2xl font-black tracking-[-0.03em]">İlanın gönderildi</h2>
          <p className="mt-3 text-sm leading-6 text-black/55">{done}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/hesabim" className="orange-button px-6 py-3">
              İlanlarımı gör
            </Link>
            <button type="button" onClick={reset} className="rounded-xl border border-black/10 px-6 py-3 font-bold text-black/70 hover:bg-[#fafaf8]">
              Başka ilan ekle
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {draft && (
        <div role="status" className="mx-auto mt-6 flex max-w-5xl flex-col gap-3 rounded-2xl border border-[#3B66E0]/20 bg-[#EEF3FF] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-[#2A4FBF]">
            Yarım kalan bir ilanın var{draft.productName ? ` (${draft.productName})` : ""}. Kaldığın yerden devam etmek ister misin?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={restoreDraft} className="flex items-center gap-1.5 rounded-lg bg-[#3B66E0] px-3 py-2 text-sm font-bold text-white">
              <RotateCcw size={14} aria-hidden /> Devam et
            </button>
            <button type="button" onClick={discardDraft} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black/60">
              Sil
            </button>
          </div>
        </div>
      )}

      <nav aria-label="Adımlar" className="mx-auto mt-8 max-w-5xl">
        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map((label, index) => {
            const state = index < step ? "done" : index === step ? "current" : "todo";
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={index > step}
                  onClick={() => goTo(index)}
                  aria-current={state === "current" ? "step" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    state === "current" ? "border-[#3B66E0] bg-[#EEF3FF]" : state === "done" ? "border-green-200 bg-green-50" : "border-black/8 bg-white opacity-60"
                  }`}
                >
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${state === "done" ? "bg-green-600 text-white" : state === "current" ? "bg-[#3B66E0] text-white" : "bg-black/10 text-black/50"}`}>
                    {state === "done" ? "✓" : index + 1}
                  </span>
                  {/* On narrow screens only the current step keeps its label, so none get cut off. */}
                  <span className={`truncate text-sm font-black ${state === "current" ? "" : "sr-only sm:not-sr-only"}`}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (step < STEPS.length - 1) next();
            else submit();
          }}
          noValidate
          className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] sm:p-8"
        >
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-black tracking-[-0.03em] outline-none">
            {step === 0 && "Hangi ürünü ekliyorsun?"}
            {step === 1 && "İlanın detayları"}
            {step === 2 && "Son bir kontrol"}
          </h2>

          <div aria-live="polite">
            {serverMessage && (
              <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                <TriangleAlert className="mt-0.5 shrink-0" size={18} aria-hidden />
                <p>{serverMessage}</p>
              </div>
            )}
          </div>

          {step === 0 && (
            <div className="mt-6">
              <Combobox
                label="Ürün"
                required
                placeholder="Ürün ara (ör. iPhone 13)"
                selectedLabel={productName}
                items={productItems}
                loading={productLoading}
                emptyText="Bu aramayla ürün bulunamadı. Adı daha kısa yazmayı dene."
                error={errors.productId}
                onQueryChange={searchProducts}
                onSelect={(item) => {
                  setField("productId", item.id);
                  setProductName(item.label);
                }}
                onClear={() => {
                  setField("productId", "");
                  setProductName("");
                }}
              />
              <p className="mt-3 text-sm leading-6 text-black/50">
                İlanı, 2ElBul&apos;da takip edilen bir ürüne bağlıyoruz; böylece fiyatı aynı ürünün diğer ilanlarıyla karşılaştırabiliyoruz.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 grid gap-6">
              <Field label="İlan başlığı" error={errors.title} required hint={`${input.title.trim().length}/${TITLE_MAX_LENGTH}`}>
                {(props) => (
                  <input
                    {...props}
                    value={input.title}
                    maxLength={TITLE_MAX_LENGTH + 40}
                    onChange={(event) => setField("title", event.target.value)}
                    placeholder="Örn. Kutulu iPhone 13 128 GB, pil sağlığı %92"
                    className={`field h-13 px-4 ${errors.title ? "border-red-400" : ""}`}
                  />
                )}
              </Field>

              <Field label="Fiyat" error={errors.price} required>
                {(props) => (
                  <span className="relative block">
                    <input
                      {...props}
                      value={input.price}
                      inputMode="decimal"
                      onChange={(event) => setField("price", formatTlInput(event.target.value))}
                      placeholder="25.000"
                      className={`field h-13 px-4 pr-12 ${errors.price ? "border-red-400" : ""}`}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-black/35">TL</span>
                  </span>
                )}
              </Field>

              <fieldset>
                <legend className="mb-2 text-sm font-bold">
                  Ürünün durumu <span className="text-red-500">*</span>
                </legend>
                <div role="radiogroup" aria-label="Ürünün durumu" className="flex flex-wrap gap-2">
                  {LISTING_CONDITIONS.map((condition) => (
                    <Chip key={condition} selected={input.condition === condition} onClick={() => setField("condition", condition)}>
                      {condition}
                    </Chip>
                  ))}
                </div>
                {errors.condition && <p role="alert" className="mt-1.5 text-xs font-bold text-red-600">{errors.condition}</p>}
              </fieldset>

              <Combobox
                label="Şehir"
                required
                placeholder="Şehir ara (ör. Ankara)"
                selectedLabel={input.city}
                items={cityItems}
                error={errors.city}
                onQueryChange={setCityQuery}
                onSelect={(item) => setField("city", item.label)}
                onClear={() => setField("city", "")}
              />

              <Field label="İlan bağlantısı" error={errors.url} required warning={warnings.url}>
                {(props) => (
                  <input
                    {...props}
                    value={input.url}
                    inputMode="url"
                    onChange={(event) => handleUrlChange(event.target.value)}
                    placeholder="https://www.sahibinden.com/ilan/..."
                    className={`field h-13 px-4 ${errors.url ? "border-red-400" : ""}`}
                  />
                )}
              </Field>

              <fieldset>
                <legend className="mb-2 text-sm font-bold">
                  İlanın yayınlandığı site <span className="text-red-500">*</span>
                </legend>
                <div role="radiogroup" aria-label="İlanın yayınlandığı site" className="flex flex-wrap gap-2">
                  {LISTING_SOURCES.map((source) => (
                    <Chip key={source} selected={input.source === source} onClick={() => setField("source", source)} title={SOURCE_DOMAINS[source][0]}>
                      {source}
                    </Chip>
                  ))}
                </div>
                {errors.source && <p role="alert" className="mt-1.5 text-xs font-bold text-red-600">{errors.source}</p>}
              </fieldset>

              <div>
                <p className="mb-2 text-sm font-bold">
                  Fotoğraf <span className="font-normal text-black/40">(isteğe bağlı)</span>
                </p>
                {image ? (
                  <div className="flex items-center gap-4 rounded-xl border border-black/10 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview */}
                    <img src={image.previewUrl} alt="Seçilen fotoğraf" className="size-20 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-bold">Fotoğraf eklendi</p>
                      <p className="text-xs text-black/45">{Math.round(image.file.size / 1024)} KB (otomatik küçültüldü)</p>
                    </div>
                    <button type="button" onClick={removeImage} aria-label="Fotoğrafı kaldır" className="rounded-lg border border-black/10 p-2 text-black/55 hover:bg-[#fafaf8]">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-black/20 p-6 text-center text-sm text-black/55 hover:border-[#3B66E0]/50 hover:bg-[#fafaf8]"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void handleImage(event.dataTransfer.files[0]);
                    }}
                  >
                    {imageBusy ? <Loader2 className="animate-spin" size={24} aria-hidden /> : <ImagePlus size={24} aria-hidden />}
                    <span className="font-bold">{imageBusy ? "Fotoğraf hazırlanıyor..." : "Fotoğraf seç ya da buraya sürükle"}</span>
                    <span className="text-xs text-black/40">JPEG, PNG veya WebP. Büyük fotoğraflar otomatik küçültülür.</span>
                    <input
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(",")}
                      className="sr-only"
                      onChange={(event) => {
                        void handleImage(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
                {imageNotice && <p role="alert" className="mt-1.5 text-xs font-bold text-red-600">{imageNotice}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-6">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Summary label="Ürün" value={productName} />
                <Summary label="Başlık" value={input.title.trim()} />
                <Summary label="Fiyat" value={input.price ? `${input.price} TL` : ""} />
                <Summary label="Durum" value={input.condition} />
                <Summary label="Şehir" value={input.city} />
                <Summary label="Site" value={input.source} />
                <Summary label="Bağlantı" value={input.url.trim()} wide />
              </dl>
              {warnings.url && (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  <TriangleAlert className="mt-0.5 shrink-0" size={16} aria-hidden /> {warnings.url}
                </p>
              )}
              <p className="mt-5 text-xs leading-5 text-black/45">
                Gönderilen ilanlar yönetici onayından sonra yayınlanır. Onay bekleyen ilanını Hesabım sayfasında görebilirsin.
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-black/8 pt-6">
            {step > 0 ? (
              <button type="button" onClick={() => goTo(step - 1)} disabled={submitting} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-4 py-3 font-bold text-black/65 hover:bg-[#fafaf8] disabled:opacity-50">
                <ChevronLeft size={18} aria-hidden /> Geri
              </button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <button type="submit" className="orange-button px-6 py-3">
                Devam et <ChevronRight size={18} aria-hidden />
              </button>
            ) : (
              <button type="submit" disabled={submitting} className="orange-button px-6 py-3 disabled:opacity-60">
                {submitting ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Send size={18} aria-hidden />}
                {submitting ? "Gönderiliyor..." : "İlanı gönder"}
              </button>
            )}
          </div>
        </form>

        <aside aria-label="Önizleme" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-black/40">İlanın şöyle görünecek</p>
          <ListingPreview data={preview} />
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8] px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">İlan ekle</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-black/50 sm:text-base">
          Başka bir sitedeki ilanı 2ElBul&apos;a gönder. İncelendikten sonra fiyat karşılaştırmalarında yayınlayalım.
        </p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  warning,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  warning?: string;
  hint?: string;
  required?: boolean;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = `field-${label.replace(/\s+/g, "-").toLocaleLowerCase("tr-TR")}`;
  const messageId = `${id}-message`;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
        {hint && <span className="text-xs text-black/35">{hint}</span>}
      </div>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": error || warning ? messageId : undefined })}
      {error ? (
        <p id={messageId} role="alert" className="mt-1.5 text-xs font-bold text-red-600">{error}</p>
      ) : warning ? (
        <p id={messageId} className="mt-1.5 text-xs font-bold text-amber-700">{warning}</p>
      ) : null}
    </div>
  );
}

function Chip({ selected, onClick, children, title }: { selected: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={title}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
        selected ? "border-[#3B66E0] bg-[#3B66E0] text-white" : "border-black/10 bg-white text-black/65 hover:border-[#3B66E0]/40"
      }`}
    >
      {children}
    </button>
  );
}

function Summary({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-[#fafaf8] p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-bold text-black/40">{label}</dt>
      <dd className="mt-1 break-words font-bold">{value || "—"}</dd>
    </div>
  );
}
