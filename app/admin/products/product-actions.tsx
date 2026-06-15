"use client";

import { Pencil, Trash2 } from "lucide-react";
import { deleteProduct, updateProduct } from "./actions";

export function ProductActions({
  product,
}: {
  product: { id: number; name: string; slug: string };
}) {
  return (
    <div className="flex justify-end gap-2">
      <details>
        <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-black/10">
          <Pencil size={16} />
        </summary>
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
          <form
            action={updateProduct}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2 className="text-xl font-black">Ürünü düzenle</h2>
            <input type="hidden" name="id" value={product.id} />
            <label className="mt-5 block text-sm font-bold">
              Ürün adı
              <input
                name="name"
                defaultValue={product.name}
                className="field mt-2 px-3 py-2.5"
                required
              />
            </label>
            <label className="mt-4 block text-sm font-bold">
              Slug
              <input
                name="slug"
                defaultValue={product.slug}
                className="field mt-2 px-3 py-2.5"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={(event) => {
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = false;
                }}
                className="rounded-xl border border-black/10 px-4 py-3 font-bold"
              >
                Vazgeç
              </button>
              <button className="orange-button px-5 py-3">Kaydet</button>
            </div>
          </form>
        </div>
      </details>
      <form
        action={deleteProduct}
        onSubmit={(event) => {
          if (
            !window.confirm(
              "Bu ürün silinsin mi? Ürüne bağlı ilan varsa işlem reddedilir.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={product.id} />
        <button
          className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-600"
          aria-label="Ürünü sil"
        >
          <Trash2 size={16} />
        </button>
      </form>
    </div>
  );
}
