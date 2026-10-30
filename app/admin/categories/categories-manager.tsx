"use client";

import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  EyeOff,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  countProductsInScope,
  slugifyCategoryName,
  type AdminCategory,
  type CategoryErrors,
  type CategoryInput,
} from "@/lib/category-admin-rules";
import { CATEGORY_ICON_MAP, resolveCategoryIcon } from "@/lib/category-icons";
import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  moveCategoryProductsAction,
  reclassifyFallbackAction,
  updateCategoryAction,
  type CategoryActionResult,
} from "./actions";

type Dialog =
  | { kind: "create"; parentId: number | null }
  | { kind: "edit"; id: number }
  | { kind: "delete"; id: number };

const ICON_NAMES = Object.keys(CATEGORY_ICON_MAP);

function categoryLabel(category: AdminCategory, all: AdminCategory[]): string {
  const parent = category.parentId ? all.find((c) => c.id === category.parentId) : null;
  return parent ? `${parent.name} › ${category.name}` : category.name;
}

export function CategoriesManager({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [feedback, setFeedback] = useState<CategoryActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const mains = useMemo(
    () => categories.filter((c) => c.parentId === null).sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id),
    [categories],
  );
  const childrenOf = (id: number) =>
    categories.filter((c) => c.parentId === id).sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
  const fallback = categories.find((c) => c.isFallback);

  /** Runs a server action, shows its message and refreshes the tree on success. */
  function run(action: () => Promise<CategoryActionResult>, onDone?: () => void) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.ok) {
        onDone?.();
        router.refresh();
      }
    });
  }

  function reorder(id: number, direction: "up" | "down") {
    run(() => moveCategoryAction(id, direction));
  }

  const siblingPosition = (category: AdminCategory) => {
    if (category.isFallback) return { first: true, last: true };
    const siblings = categories
      .filter((c) => c.parentId === category.parentId && !c.isFallback)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
    const index = siblings.findIndex((c) => c.id === category.id);
    return { first: index <= 0, last: index === siblings.length - 1 };
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-black/50">
          Sıra, ana kategorilerde aynı zamanda <strong>eşleştirme önceliğidir</strong>: bir ürün birden fazla
          kategoriye uyuyorsa üstteki kazanır.
        </p>
        <div className="flex flex-wrap gap-2">
          {fallback && fallback.productCount > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(reclassifyFallbackAction)}
              className="flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              title={`"${fallback.name}" içindeki ürünleri güncel kurallarla yeniden dene`}
            >
              <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
              Diğer&apos;i yeniden sınıflandır
            </button>
          )}
          <button
            type="button"
            onClick={() => setDialog({ kind: "create", parentId: null })}
            className="orange-button px-4 py-2.5 text-sm"
          >
            <Plus size={16} /> Ana kategori ekle
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-xl border p-3 text-sm font-bold ${
            feedback.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <ul className="grid gap-3">
        {mains.map((main) => {
          const children = childrenOf(main.id);
          return (
            <li key={main.id} className="overflow-hidden rounded-2xl border border-black/8 bg-white">
              <CategoryRow
                category={main}
                total={countProductsInScope(categories, main.id)}
                position={siblingPosition(main)}
                disabled={pending}
                onMove={reorder}
                onEdit={() => setDialog({ kind: "edit", id: main.id })}
                onDelete={() => setDialog({ kind: "delete", id: main.id })}
                onAddChild={main.isFallback ? undefined : () => setDialog({ kind: "create", parentId: main.id })}
              />
              {children.length > 0 && (
                <ul className="border-t border-black/7 bg-[#fafaf8]">
                  {children.map((child) => (
                    <li key={child.id} className="border-b border-black/5 last:border-b-0">
                      <CategoryRow
                        category={child}
                        nested
                        total={child.productCount}
                        position={siblingPosition(child)}
                        disabled={pending}
                        onMove={reorder}
                        onEdit={() => setDialog({ kind: "edit", id: child.id })}
                        onDelete={() => setDialog({ kind: "delete", id: child.id })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {dialog?.kind === "delete" && (
        <DeleteDialog
          key={`delete-${dialog.id}`}
          category={categories.find((c) => c.id === dialog.id)}
          categories={categories}
          pending={pending}
          onClose={() => setDialog(null)}
          onConfirm={(moveTo) => run(() => deleteCategoryAction(dialog.id, moveTo), () => setDialog(null))}
        />
      )}

      {(dialog?.kind === "create" || dialog?.kind === "edit") && (
        <CategoryEditor
          key={dialog.kind === "edit" ? `edit-${dialog.id}` : `create-${dialog.parentId}`}
          categories={categories}
          editing={dialog.kind === "edit" ? categories.find((c) => c.id === dialog.id) ?? null : null}
          initialParentId={dialog.kind === "create" ? dialog.parentId : null}
          onClose={() => setDialog(null)}
          onSaved={(result) => {
            setFeedback(result);
            setDialog(null);
            router.refresh();
          }}
          onMoveProducts={(fromId, toId) => run(() => moveCategoryProductsAction(fromId, toId), () => setDialog(null))}
        />
      )}
    </div>
  );
}

function CategoryRow({
  category,
  nested = false,
  total,
  position,
  disabled,
  onMove,
  onEdit,
  onDelete,
  onAddChild,
}: {
  category: AdminCategory;
  nested?: boolean;
  total: number;
  position: { first: boolean; last: boolean };
  disabled: boolean;
  onMove: (id: number, direction: "up" | "down") => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild?: () => void;
}) {
  const Icon = resolveCategoryIcon(category.icon);
  const iconButton =
    "grid size-9 shrink-0 place-items-center rounded-lg border border-black/10 bg-white transition hover:border-[#3B66E0]/40 disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${nested ? "pl-8 sm:pl-12" : ""}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#E4ECFF] text-[#3B66E0]">
        <Icon size={19} />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-black">{category.name}</span>
          {category.isFallback && <Badge tone="amber">Yedek kategori</Badge>}
          {!category.isActive && (
            <Badge tone="gray">
              <EyeOff size={11} /> Gizli
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-black/40">
          /category/{category.slug} · {total} ürün
          {!nested && total !== category.productCount ? ` (${category.productCount} doğrudan)` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" className={iconButton} disabled={disabled || position.first} onClick={() => onMove(category.id, "up")} aria-label={`${category.name} yukarı taşı`}>
          <ArrowUp size={16} />
        </button>
        <button type="button" className={iconButton} disabled={disabled || position.last} onClick={() => onMove(category.id, "down")} aria-label={`${category.name} aşağı taşı`}>
          <ArrowDown size={16} />
        </button>
        {onAddChild && (
          <button type="button" className={iconButton} disabled={disabled} onClick={onAddChild} aria-label={`${category.name} altına alt kategori ekle`} title="Alt kategori ekle">
            <Plus size={16} />
          </button>
        )}
        {category.isActive && (
          <Link href={`/category/${category.slug}`} target="_blank" className={iconButton} aria-label={`${category.name} sayfasını aç`}>
            <ExternalLink size={16} />
          </Link>
        )}
        <button type="button" className={iconButton} disabled={disabled} onClick={onEdit} aria-label={`${category.name} düzenle`}>
          <Pencil size={16} />
        </button>
        {!category.isFallback && (
          <button
            type="button"
            className={`${iconButton} border-red-200 text-red-600`}
            disabled={disabled}
            onClick={onDelete}
            aria-label={`${category.name} sil`}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: "amber" | "gray"; children: React.ReactNode }) {
  const styles = tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-black/6 text-black/55";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${styles}`}>
      {children}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="my-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-black">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg border border-black/10" aria-label="Kapat">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="mt-1 block text-xs font-semibold text-red-600">{message}</span> : null;
}

function CategoryEditor({
  categories,
  editing,
  initialParentId,
  onClose,
  onSaved,
  onMoveProducts,
}: {
  categories: AdminCategory[];
  editing: AdminCategory | null;
  initialParentId: number | null;
  onClose: () => void;
  onSaved: (result: CategoryActionResult) => void;
  onMoveProducts: (fromId: number, toId: number) => void;
}) {
  const [form, setForm] = useState<CategoryInput>({
    name: editing?.name ?? "",
    slug: editing?.slug ?? "",
    parentId: editing ? editing.parentId : initialParentId,
    icon: editing?.icon ?? null,
    shortDescription: editing?.shortDescription ?? "",
    longDescription: editing?.longDescription ?? "",
    matchKeywords: editing?.matchKeywords.join(", ") ?? "",
    excludeKeywords: editing?.excludeKeywords.join(", ") ?? "",
    isActive: editing?.isActive ?? true,
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(editing));
  const [errors, setErrors] = useState<CategoryErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [pending, startTransition] = useTransition();

  const hasChildren = editing ? categories.some((c) => c.parentId === editing.id) : false;
  const canChangeParent = !editing?.isFallback && !hasChildren;
  const parentOptions = categories.filter((c) => c.parentId === null && !c.isFallback && c.id !== editing?.id);
  const moveOptions = categories.filter((c) => c.isActive && c.id !== editing?.id);
  const slugChanged = Boolean(editing && form.slug.trim() && form.slug.trim() !== editing.slug);

  function set<K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = editing ? await updateCategoryAction(editing.id, form) : await createCategoryAction(form);
      if (result.ok) {
        onSaved(result);
        return;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message);
    });
  }

  const title = editing
    ? `Kategoriyi düzenle: ${editing.name}`
    : form.parentId
      ? "Alt kategori ekle"
      : "Ana kategori ekle";

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={save} className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            Ad
            <input
              value={form.name}
              onChange={(event) => {
                set("name", event.target.value);
                if (!slugTouched) set("slug", slugifyCategoryName(event.target.value));
              }}
              className="field mt-2 px-3 py-2.5"
              required
            />
            <FieldError message={errors.name} />
          </label>
          <label className="block text-sm font-bold">
            Slug (adres)
            <input
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                set("slug", event.target.value);
              }}
              className="field mt-2 px-3 py-2.5 font-mono text-sm"
            />
            <FieldError message={errors.slug} />
          </label>
        </div>
        {slugChanged && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            Slug değişirse eski sayfa adresi (/category/{editing?.slug}) artık çalışmaz. Dışarıdan gelen bağlantılar
            kırılabilir.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            Üst kategori
            <select
              value={form.parentId ?? ""}
              onChange={(event) => set("parentId", event.target.value ? Number(event.target.value) : null)}
              disabled={!canChangeParent}
              className="field mt-2 px-3 py-2.5 disabled:bg-black/4"
            >
              <option value="">Yok (ana kategori)</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            {hasChildren && <span className="mt-1 block text-xs font-normal text-black/45">Alt kategorisi olan kategori ana kategori kalır.</span>}
            <FieldError message={errors.parentId} />
          </label>
          <label className="block text-sm font-bold">
            Simge
            <select
              value={form.icon ?? ""}
              onChange={(event) => set("icon", event.target.value || null)}
              className="field mt-2 px-3 py-2.5"
            >
              <option value="">Varsayılan</option>
              {ICON_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <FieldError message={errors.icon} />
          </label>
        </div>

        <label className="block text-sm font-bold">
          Kısa açıklama
          <input value={form.shortDescription} onChange={(event) => set("shortDescription", event.target.value)} className="field mt-2 px-3 py-2.5" />
          <FieldError message={errors.shortDescription} />
        </label>
        <label className="block text-sm font-bold">
          Uzun açıklama
          <textarea value={form.longDescription} onChange={(event) => set("longDescription", event.target.value)} rows={3} className="field mt-2 px-3 py-2.5" />
          <FieldError message={errors.longDescription} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            Eşleşen anahtar kelimeler
            <textarea
              value={form.matchKeywords}
              onChange={(event) => set("matchKeywords", event.target.value)}
              rows={4}
              placeholder="laptop, notebook, macbook"
              className="field mt-2 px-3 py-2.5 text-sm"
            />
            <FieldError message={errors.matchKeywords} />
          </label>
          <label className="block text-sm font-bold">
            Hariç tutulan kelimeler
            <textarea
              value={form.excludeKeywords}
              onChange={(event) => set("excludeKeywords", event.target.value)}
              rows={4}
              placeholder="kılıf, çanta"
              className="field mt-2 px-3 py-2.5 text-sm"
            />
            <FieldError message={errors.excludeKeywords} />
          </label>
        </div>
        <p className="-mt-2 text-xs text-black/45">
          Virgül veya satır ile ayırın. Kelimeler ürün adında kelime başı olarak aranır (Türkçe harfler duyarsız).
          Yeni ürünler bu kurallarla yerleşir; mevcut ürünler için &quot;Diğer&apos;i yeniden sınıflandır&quot; kullanılabilir.
        </p>

        <label className="flex items-center justify-between rounded-xl bg-[#fafaf8] p-4">
          <span className="text-sm font-bold">
            Sitede göster
            <span className="block text-xs font-normal text-black/45">Kapalı kategori menüde ve sayfalarda görünmez.</span>
          </span>
          <input type="checkbox" checked={form.isActive} onChange={(event) => set("isActive", event.target.checked)} className="size-5 accent-[#3B66E0]" />
        </label>
        <FieldError message={errors.isActive} />

        {editing && editing.productCount > 0 && (
          <div className="rounded-xl border border-black/8 p-4">
            <p className="text-sm font-bold">Ürünleri taşı ({editing.productCount} ürün)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)} className="field min-w-0 flex-1 px-3 py-2.5 text-sm">
                <option value="">Hedef kategori seçin</option>
                {moveOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {categoryLabel(option, categories)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!moveTarget || pending}
                onClick={() => onMoveProducts(editing.id, Number(moveTarget))}
                className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-bold disabled:opacity-40"
              >
                Taşı
              </button>
            </div>
          </div>
        )}

        {message && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-black/10 px-4 py-3 font-bold">
            Vazgeç
          </button>
          <button type="submit" disabled={pending} className="orange-button px-5 py-3 disabled:opacity-60">
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({
  category,
  categories,
  pending,
  onClose,
  onConfirm,
}: {
  category: AdminCategory | undefined;
  categories: AdminCategory[];
  pending: boolean;
  onClose: () => void;
  onConfirm: (moveProductsTo: number | null) => void;
}) {
  const [target, setTarget] = useState("");
  if (!category) return null;

  const children = categories.filter((c) => c.parentId === category.id);
  const needsTarget = category.productCount > 0;
  const options = categories.filter((c) => c.isActive && c.id !== category.id);
  const blocked = children.length > 0;

  return (
    <Modal title={`"${category.name}" silinsin mi?`} onClose={onClose}>
      <div className="mt-4 grid gap-4 text-sm">
        {blocked ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-800">
            Bu kategorinin {children.length} alt kategorisi var. Önce alt kategorileri silin ya da başka bir ana
            kategoriye taşıyın (düzenle → üst kategori).
          </p>
        ) : (
          <p className="text-black/60">Bu işlem geri alınamaz. Kategori sayfası ve menü bağlantısı kalkar.</p>
        )}

        {needsTarget && !blocked && (
          <label className="block font-bold">
            Bu kategorideki {category.productCount} ürün nereye taşınsın?
            <select value={target} onChange={(event) => setTarget(event.target.value)} className="field mt-2 px-3 py-2.5">
              <option value="">Hedef kategori seçin</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {categoryLabel(option, categories)}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-black/10 px-4 py-3 font-bold">
            Vazgeç
          </button>
          <button
            type="button"
            disabled={pending || blocked || (needsTarget && !target)}
            onClick={() => onConfirm(needsTarget ? Number(target) : null)}
            className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-40"
          >
            {pending ? "Siliniyor…" : "Sil"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
