"use client";

import { useState, useTransition } from "react";
import { MAX_HEADER_CATEGORIES } from "@/lib/header-category-limits";
import { saveHeaderCategories, type SettingsActionResult } from "./actions";

export type HeaderCategoryOption = {
  slug: string;
  name: string;
  children: { slug: string; name: string }[];
};

export function HeaderCategoriesForm({
  options,
  selectedSlugs,
  settingsAvailable,
}: {
  options: HeaderCategoryOption[];
  /** `null` = not configured, the header lists every main category. */
  selectedSlugs: string[] | null;
  settingsAvailable: boolean;
}) {
  const [useDefault, setUseDefault] = useState(selectedSlugs === null);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(selectedSlugs ?? options.map((option) => option.slug)),
  );
  const [result, setResult] = useState<SettingsActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const overLimit = !useDefault && selected.size > MAX_HEADER_CATEGORIES;
  const disabled = !settingsAvailable || pending;

  function toggle(slug: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function save() {
    setResult(null);
    startTransition(async () => {
      setResult(await saveHeaderCategories({ slugs: useDefault ? null : [...selected] }));
    });
  }

  return (
    <section className="mt-5 rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-black">Menü kategorileri</h2>
      <p className="mt-2 text-sm leading-6 text-black/50">
        Sitenin üst menüsündeki &quot;Kategoriler&quot; listesinde hangi kategorilerin
        görüneceğini seçin. Kısa bir liste menüyü ve sayfaları hızlı tutar. Tüm
        kategorilere her zaman &quot;Tüm kategorileri incele&quot; bağlantısıyla ulaşılır.
      </p>

      {result && (
        <div
          className={`mt-4 rounded-xl border p-3 text-sm font-bold ${
            result.ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </div>
      )}

      <label className="mt-5 flex items-center justify-between rounded-xl bg-[#fafaf8] p-4">
        <span className="font-bold">Varsayılan: tüm ana kategorileri göster</span>
        <input
          type="checkbox"
          checked={useDefault}
          onChange={(event) => setUseDefault(event.target.checked)}
          disabled={disabled}
          className="size-5 accent-[#3B66E0]"
        />
      </label>

      <fieldset
        disabled={useDefault || disabled}
        className={`mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${useDefault ? "opacity-45" : ""}`}
      >
        <legend className="sr-only">Menüde gösterilecek kategoriler</legend>
        {options.map((option) => (
          <div key={option.slug} className="rounded-xl border border-black/8 p-3">
            <CategoryCheckbox
              label={option.name}
              checked={selected.has(option.slug)}
              onChange={() => toggle(option.slug)}
              strong
            />
            {option.children.map((child) => (
              <div key={child.slug} className="ml-6 mt-1.5">
                <CategoryCheckbox
                  label={child.name}
                  checked={selected.has(child.slug)}
                  onChange={() => toggle(child.slug)}
                />
              </div>
            ))}
          </div>
        ))}
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm font-bold ${overLimit ? "text-red-600" : "text-black/45"}`}>
          {useDefault
            ? "Tüm ana kategoriler gösterilecek"
            : `${selected.size} / ${MAX_HEADER_CATEGORIES} kategori seçili`}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={disabled || overLimit}
          className="orange-button px-6 py-3 disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : "Menüyü kaydet"}
        </button>
      </div>
    </section>
  );
}

function CategoryCheckbox({
  label,
  checked,
  onChange,
  strong = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  strong?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2.5 text-sm ${strong ? "font-black" : "font-semibold text-black/65"}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 accent-[#3B66E0]" />
      {label}
    </label>
  );
}
