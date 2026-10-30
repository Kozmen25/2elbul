"use client";

import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type ComboboxItem = { id: string; label: string; hint?: string };

type ComboboxProps = {
  label: string;
  placeholder?: string;
  /** Label of the currently chosen item; shown in the field while not typing. */
  selectedLabel: string;
  items: ComboboxItem[];
  loading?: boolean;
  emptyText?: string;
  error?: string;
  required?: boolean;
  /** Called on every keystroke so the parent can filter / fetch `items`. */
  onQueryChange: (query: string) => void;
  onSelect: (item: ComboboxItem) => void;
  onClear?: () => void;
};

/**
 * Search-as-you-type select with full keyboard support (↑ ↓ Enter Esc) and the
 * ARIA combobox pattern, for lists too long for a native <select> (81 cities,
 * thousands of products).
 */
export function Combobox({
  label,
  placeholder,
  selectedLabel,
  items,
  loading = false,
  emptyText = "Sonuç bulunamadı.",
  error,
  required,
  onQueryChange,
  onSelect,
  onClear,
}: ComboboxProps) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const errorId = `${baseId}-error`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const typing = query !== "";

  useEffect(() => setActive(0), [items]);

  function choose(item: ComboboxItem) {
    onSelect(item);
    setQuery("");
    onQueryChange("");
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && items[active]) {
      event.preventDefault();
      choose(items[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={baseId} className="mb-2 block text-sm font-bold">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={baseId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${baseId}-opt-${active}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          value={typing ? query : selectedLabel}
          placeholder={selectedLabel ? undefined : placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            onQueryChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            onQueryChange(query);
          }}
          onBlur={() => {
            setOpen(false);
            setQuery("");
          }}
          onKeyDown={handleKeyDown}
          className={`field h-13 px-4 pr-20 ${error ? "border-red-400" : ""}`}
        />
        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-black/35">
          {loading && <Loader2 size={16} className="animate-spin" aria-label="Aranıyor" />}
          {selectedLabel && onClear && !typing && (
            <button
              type="button"
              aria-label={`${label} seçimini temizle`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onClear();
                inputRef.current?.focus();
              }}
              className="rounded-md p-1 hover:bg-black/5"
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown size={18} aria-hidden />
        </span>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-black/10 bg-white py-1 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
        >
          {items.length === 0 ? (
            <li className="px-4 py-3 text-sm text-black/45">{loading ? "Aranıyor..." : emptyText}</li>
          ) : (
            items.map((item, index) => (
              <li
                key={item.id}
                id={`${baseId}-opt-${index}`}
                role="option"
                aria-selected={item.label === selectedLabel}
                // mousedown (not click) so the input's blur does not close the list first
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(item);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                  index === active ? "bg-[#EEF3FF]" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{item.label}</span>
                  {item.hint && <span className="block truncate text-xs text-black/45">{item.hint}</span>}
                </span>
                {item.label === selectedLabel && <Check size={16} className="shrink-0 text-[#3B66E0]" aria-hidden />}
              </li>
            ))
          )}
        </ul>
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-bold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
