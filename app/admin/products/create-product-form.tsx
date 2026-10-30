"use client";

import { Plus } from "lucide-react";
import { AdminActionForm } from "@/components/admin-action-form";
import { createProduct } from "./actions";

/** Adds a catalog product by hand. Without a category the database rules choose one. */
export function CreateProductForm({ categoryOptions }: { categoryOptions: { id: number; label: string }[] }) {
  return (
    <details className="mb-5 rounded-2xl border border-black/8 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-black">
        <Plus size={18} className="text-[#3B66E0]" /> Ürün ekle
      </summary>
      <AdminActionForm
        action={createProduct}
        closeDetailsOnSuccess
        className="grid gap-4 border-t border-black/8 p-5 sm:grid-cols-2"
      >
        <label className="block text-sm font-bold">
          Ürün adı
          <input name="name" required minLength={2} className="field mt-2 px-3 py-2.5" placeholder="iPhone 15 Pro 256GB" />
        </label>
        <label className="block text-sm font-bold">
          Slug (boş bırakılırsa addan üretilir)
          <input name="slug" className="field mt-2 px-3 py-2.5 font-mono text-sm" />
        </label>
        <label className="block text-sm font-bold sm:col-span-2">
          Kategori
          <select name="categoryId" defaultValue="" className="field mt-2 px-3 py-2.5">
            <option value="">Otomatik (ürün adına göre)</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="orange-button px-5 py-3">
            Ürünü ekle
          </button>
        </div>
      </AdminActionForm>
    </details>
  );
}
