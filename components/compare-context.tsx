"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "2elbul-compare-selection";
const MAX_SELECTION = 2;

export type CompareSelectionEntry = {
  listingId: string;
  productName: string;
};

type CompareContextValue = {
  selection: CompareSelectionEntry[];
  hasSelection: boolean;
  isFull: boolean;
  isSelected: (listingId: string) => boolean;
  addToSelection: (entry: CompareSelectionEntry) => { overflow: boolean };
  removeFromSelection: (listingId: string) => void;
  clearSelection: () => void;
  compareUrl: string | null;
};

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<CompareSelectionEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          setSelection(parseSelection(parsed));
        }
      }
    } catch {
      // sessionStorage erişilemez veya bozuk — sessizce boş başla
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (selection.length > 0) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // sessionStorage yazılamaz — UI state yine de çalışır
    }
  }, [selection, hydrated]);

  const isSelected = useCallback(
    (listingId: string) => selection.some((entry) => entry.listingId === listingId),
    [selection],
  );

  const addToSelection = useCallback(
    (entry: CompareSelectionEntry): { overflow: boolean } => {
      let overflow = false;
      setSelection((current) => {
        if (current.some((item) => item.listingId === entry.listingId)) {
          return current;
        }
        if (current.length < MAX_SELECTION) {
          return [...current, entry];
        }
        // En eski seçimi çıkar, yenisini ekle (FIFO overflow)
        overflow = true;
        return [...current.slice(1), entry];
      });
      return { overflow };
    },
    [],
  );

  const removeFromSelection = useCallback((listingId: string) => {
    setSelection((current) =>
      current.filter((entry) => entry.listingId !== listingId),
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelection([]);
  }, []);

  const value = useMemo<CompareContextValue>(
    () => ({
      selection,
      hasSelection: selection.length > 0,
      isFull: selection.length >= MAX_SELECTION,
      isSelected,
      addToSelection,
      removeFromSelection,
      clearSelection,
      compareUrl: buildCompareUrl(selection),
    }),
    [selection, isSelected, addToSelection, removeFromSelection, clearSelection],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareContextValue {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error("useCompare, CompareProvider içinde kullanılmalıdır.");
  }
  return context;
}

export function buildCompareUrl(
  selection: CompareSelectionEntry[],
): string | null {
  if (selection.length !== MAX_SELECTION) return null;
  const [first, second] = selection;
  return `/compare?a=${encodeURIComponent(first.listingId)}&b=${encodeURIComponent(second.listingId)}`;
}

export function selectNextEntry(
  current: CompareSelectionEntry[],
  entry: CompareSelectionEntry,
): { selection: CompareSelectionEntry[]; overflow: boolean } {
  if (current.some((item) => item.listingId === entry.listingId)) {
    return { selection: current, overflow: false };
  }
  if (current.length < MAX_SELECTION) {
    return { selection: [...current, entry], overflow: false };
  }
  return { selection: [...current.slice(1), entry], overflow: true };
}

function parseSelection(value: unknown): CompareSelectionEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is CompareSelectionEntry => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Record<string, unknown>;
      return (
        typeof candidate.listingId === "string" &&
        typeof candidate.productName === "string"
      );
    })
    .slice(0, MAX_SELECTION);
}
