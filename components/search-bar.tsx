"use client";

import { AudioLines, Clock, FolderTree, MapPin, Mic, MicOff, Search, Tag, TrendingUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { buildIntentSummary } from "@/lib/search/ai/intent-summary";
import {
  addRecentSearch,
  buildSuggestionGroups,
  highlightParts,
  moveActiveIndex,
  type BrandSuggestion,
  type CategorySuggestion,
  type SuggestionItem,
  type SuggestionKind,
} from "@/lib/search/suggestion-items";

const RECENT_SEARCHES_KEY = "2elbul-recent-searches";

function readRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(recents: string[]) {
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recents));
  } catch {
    // Storage can be unavailable (private mode); history is a convenience only.
  }
}

const KIND_ICONS: Record<SuggestionKind, typeof Search> = {
  recent: Clock,
  product: TrendingUp,
  brand: Tag,
  category: FolderTree,
};

type SearchBarProps = {
  compact?: boolean;
  initialQuery?: string;
  actionPath?: string;
  showLocation?: boolean;
};

type SearchSuggestion = {
  id: string;
  name: string;
  listingCount: number;
  href: string;
};

type SpeechStatus = "idle" | "listening" | "unsupported" | "denied" | "error";

/** Minimal shape of the Web Speech API recognition instance we use. */
type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function SearchBar({
  compact = false,
  initialQuery = "",
  actionPath = "/arama",
  showLocation = true,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [brandSuggestions, setBrandSuggestions] = useState<BrandSuggestion[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("idle");
  const [hasTranscript, setHasTranscript] = useState(false);
  const [intentExpanded, setIntentExpanded] = useState(false);
  const recognitionRef = useRef<{
    stop: () => void;
  } | null>(null);
  const speechSupported =
    typeof window !== "undefined" && getSpeechRecognition() !== null;

  const speechSupportedRef = useRef(speechSupported);
  speechSupportedRef.current = speechSupported;

  /** AŞAMA 2: deterministic intent read-back from the typed query (pure). */
  const intentSummary = useMemo(
    () => buildIntentSummary(query),
    [query],
  );
  const intentSlots = [
    intentSummary.productTypeLabel,
    intentSummary.deviceLabel,
    intentSummary.priceLabel,
    intentSummary.preferenceLabel,
  ].filter((slot): slot is string => Boolean(slot));

  const speechStatusLabel =
    speechStatus === "listening"
      ? hasTranscript
        ? "Yazıldı — düzenleyin"
        : "Dinleniyor"
      : speechStatus === "unsupported"
        ? "Desteklenmiyor"
        : speechStatus === "denied"
          ? "Mikrofon kapalı"
          : speechStatus === "error"
            ? "Hata — yeniden deneyin"
            : "";

  const micIsActive = speechStatus === "listening";
  const micIsInactive = speechStatus === "unsupported" || speechStatus === "denied";
  const micUnavailable = micIsInactive || speechStatus === "error";

  const micTitle = micIsInactive
    ? "Mikrofon kullanılamıyor — yazılı arama kullanılabilir"
    : micIsActive
      ? hasTranscript
        ? "Sesli aramayı durdur"
        : "Dinliyorum — konuşun, bitince yazılan metni düzenleyebilirsiniz"
      : "Sesli arayın";

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    setRecents(readRecentSearches());
  }, []);

  const groups = useMemo(
    () =>
      buildSuggestionGroups({
        query,
        products: suggestions,
        brands: brandSuggestions,
        categories: categorySuggestions,
        recents,
      }),
    [query, suggestions, brandSuggestions, categorySuggestions, recents],
  );
  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const listboxId = "search-suggestions-listbox";
  const activeItem = activeIndex >= 0 ? flatItems[activeIndex] : undefined;

  // A new list invalidates the highlighted row.
  useEffect(() => {
    setActiveIndex(-1);
  }, [flatItems.length, query]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length > 0 && trimmedQuery.length < 2) {
        setSuggestions([]);
        setBrandSuggestions([]);
        setCategorySuggestions([]);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const response = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setSuggestions([]);
          setBrandSuggestions([]);
          setCategorySuggestions([]);
          return;
        }

        const data = (await response.json()) as {
          suggestions?: SearchSuggestion[];
          brands?: BrandSuggestion[];
          categories?: CategorySuggestion[];
        };
        setSuggestions((data.suggestions ?? []).slice(0, 8));
        setBrandSuggestions(data.brands ?? []);
        setCategorySuggestions(data.categories ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Search suggestions request failed:", error);
        }
        setSuggestions([]);
        setBrandSuggestions([]);
        setCategorySuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function rememberSearch(text: string) {
    const next = addRecentSearch(recents, text);
    setRecents(next);
    writeRecentSearches(next);
  }

  function clearRecentSearches() {
    setRecents([]);
    writeRecentSearches([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter on a highlighted row opens that row instead of the typed text.
    if (activeItem) {
      openSuggestion(activeItem);
      return;
    }
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) params.set("city", city);
    if (query.trim()) rememberSearch(query);
    setSuggestionsOpen(false);
    router.push(`${actionPath}?${params.toString()}`);
  }

  function openSuggestion(item: SuggestionItem) {
    setSuggestionsOpen(false);
    // Brand and category rows are pages, not searches: keep them out of the history.
    if (item.kind === "product" || item.kind === "recent") rememberSearch(item.label);
    router.push(item.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!suggestionsOpen) {
      setSuggestionsOpen(true);
      return;
    }
    setActiveIndex((current) =>
      moveActiveIndex(current, event.key === "ArrowDown" ? "down" : "up", flatItems.length),
    );
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setSpeechStatus("idle");
  }

  function toggleSpeech() {
    if (!speechSupportedRef.current) {
      setSpeechStatus("unsupported");
      return;
    }
    if (speechStatus === "listening") {
      stopListening();
      return;
    }

    const Recorder = getSpeechRecognition();
    if (!Recorder) {
      setSpeechStatus("unsupported");
      return;
    }

    const recorder = new Recorder();
    recorder.lang = "tr-TR";
    recorder.interimResults = false;
    recorder.maxAlternatives = 1;
    recognitionRef.current = recorder;

    setSpeechStatus("listening");

    recorder.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setQuery((current) => (current.trim() ? `${current} ${transcript}` : transcript));
        setHasTranscript(true);
        setSuggestionsOpen(true);
      }
    };

    recorder.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSpeechStatus("denied");
      } else if (event.error === "aborted") {
        setSpeechStatus("idle");
      } else {
        setSpeechStatus("error");
      }
      setHasTranscript(false);
      recognitionRef.current = null;
    };

    recorder.onstart = () => {
      setHasTranscript(false);
    };

    recorder.onend = () => {
      recognitionRef.current = null;
      setSpeechStatus((current) => (current === "listening" ? "idle" : current));
    };

    try {
      recorder.start();
    } catch {
      setSpeechStatus("unsupported");
      recognitionRef.current = null;
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex w-full min-w-0 flex-col gap-2 overflow-visible bg-white p-2 shadow-[0_18px_60px_rgba(0,0,0,0.1)] sm:flex-row sm:gap-0 ${
        compact ? "rounded-2xl border border-black/8" : "rounded-2xl"
      }`}
    >
      <div className="relative min-w-0 w-full flex-1">
        <label className="flex min-w-0 w-full items-center gap-3 px-3">
          <Search size={20} className="shrink-0 text-[#3B66E0]" />
          <span className="sr-only">Ne arıyorsun?</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSuggestionsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setSuggestionsOpen(true)}
            role="combobox"
            aria-expanded={suggestionsOpen && flatItems.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeItem ? `suggestion-${activeItem.key}` : undefined}
            onBlur={() => {
              window.setTimeout(() => setSuggestionsOpen(false), 120);
            }}
            className="h-13 min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-black/40"
            placeholder="Ne arıyorsun? Örn. iPhone 13"
            autoComplete="off"
          />
          <span
            role="status"
            aria-live="polite"
            className="shrink-0 text-[11px] font-black uppercase tracking-[0.16em]"
            aria-hidden={!speechStatusLabel}
          >
            {speechStatusLabel}
          </span>
          <button
            type="button"
            onClick={toggleSpeech}
            disabled={micUnavailable}
            aria-label={
              micIsInactive
                ? "Mikrofon kullanılamıyor"
                : micIsActive
                  ? "Sesli aramayı durdur"
                  : "Sesli arayın"
            }
            title={micTitle}
            aria-pressed={micIsActive}
            className={`relative shrink-0 rounded-full transition ${
              micIsActive
                ? "bg-[#3B66E0] text-white"
                : micIsInactive
                  ? "cursor-not-allowed text-black/25"
                  : "text-black/45 hover:bg-black/5 hover:text-black/80 focus-visible:ring-2 focus-visible:ring-[#3B66E0]/60"
            }`}
          >
            {micIsActive && <span aria-hidden className="mic-ring" />}
            {micUnavailable ? (
              <MicOff size={20} className="relative" />
            ) : micIsActive && !hasTranscript ? (
              <AudioLines size={20} className="relative" />
            ) : (
              <Mic size={20} className="relative" />
            )}
          </button>
        </label>

        {intentSlots.length > 0 && (
          <div
            className="mt-2 flex flex-col gap-2 rounded-xl border border-[#C9D9FF] bg-[#EEF3FF] px-3 py-2"
            data-intent-summary
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2A4FBF]">
                Anlaşılan niyet
              </span>
              <button
                type="button"
                aria-expanded={intentExpanded}
                aria-label={intentExpanded ? "Detayları gizle" : "Detayları göster"}
                onClick={() => setIntentExpanded((open) => !open)}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-[#2A4FBF] transition hover:bg-[#C9D9FF]"
              >
                {intentExpanded ? "Gizle" : "Açıklama"}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold leading-5 text-black/75">
                {!intentExpanded
                  ? intentSlots.slice(0, 2).join(" · ")
                  : intentSlots.join(" · ")}
              </span>
              <span
                role="status"
                aria-live="polite"
                className="shrink-0 text-[11px] font-black uppercase tracking-[0.16em] text-[#2A4FBF]"
              >
                {query.trim() ? "Düzenlenebilir" : "Konuşarak ekleyin"}
              </span>
            </div>
          </div>
        )}

        {suggestionsOpen && (flatItems.length > 0 || isLoadingSuggestions) && (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Arama önerileri"
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-96 overflow-y-auto rounded-2xl border border-black/10 bg-white p-2 shadow-[0_18px_60px_rgba(0,0,0,0.14)]"
          >
            {isLoadingSuggestions && flatItems.length === 0 ? (
              <div className="px-3 py-3 text-sm font-semibold text-black/45">
                Öneriler yükleniyor...
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.title} className="mb-1 last:mb-0">
                  <div className="flex items-center justify-between px-3 pb-1 pt-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-black/35">
                      {group.title}
                    </span>
                    {group.title === "Son aramalarınız" && (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={clearRecentSearches}
                        className="flex items-center gap-1 text-[11px] font-bold text-black/40 hover:text-[#3B66E0]"
                      >
                        <X size={12} /> Temizle
                      </button>
                    )}
                  </div>
                  <div className="grid gap-0.5">
                    {group.items.map((item) => {
                      const Icon = KIND_ICONS[item.kind];
                      const isActive = activeItem?.key === item.key;
                      return (
                        <button
                          key={item.key}
                          id={`suggestion-${item.key}`}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => openSuggestion(item)}
                          className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[#EEF3FF] ${
                            isActive ? "bg-[#EEF3FF]" : ""
                          }`}
                        >
                          <Icon size={16} className="shrink-0 text-black/35" />
                          <span className="min-w-0 flex-1 truncate font-semibold">
                            {highlightParts(item.label, query).map((part, index) =>
                              part.match ? (
                                <strong key={index} className="font-black text-[#2A4FBF]">
                                  {part.text}
                                </strong>
                              ) : (
                                <span key={index}>{part.text}</span>
                              ),
                            )}
                          </span>
                          {item.meta && (
                            <span className="shrink-0 rounded-full bg-black/5 px-2 py-1 text-[11px] font-black text-black/45">
                              {item.meta}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showLocation && (
        <>
          <div className="mx-3 h-px bg-black/10 sm:mx-0 sm:my-2 sm:h-auto sm:w-px" />
          <label className="flex min-w-0 w-full items-center gap-2 px-3 sm:w-auto">
            <MapPin size={18} className="text-black/45" />
            <span className="sr-only">Şehir</span>
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="h-13 min-w-0 w-full appearance-none border-0 bg-transparent pr-5 text-sm font-semibold outline-none sm:min-w-36 sm:w-auto"
            >
              <option value="">Tüm Türkiye</option>
              <option>İstanbul</option>
              <option>Ankara</option>
              <option>İzmir</option>
              <option>Bursa</option>
              <option>Antalya</option>
            </select>
          </label>
        </>
      )}

      <button
        type="submit"
        className="orange-button h-13 w-full shrink-0 px-7 sm:w-auto sm:min-w-28"
      >
        <Search size={18} />
        Ara
      </button>
    </form>
  );
}
