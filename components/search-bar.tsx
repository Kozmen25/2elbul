"use client";

import { MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length > 0 && trimmedQuery.length < 2) {
        setSuggestions([]);
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
          return;
        }

        const data = (await response.json()) as {
          suggestions?: SearchSuggestion[];
        };
        setSuggestions((data.suggestions ?? []).slice(0, 8));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Search suggestions request failed:", error);
        }
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) params.set("sehir", city);
    setSuggestionsOpen(false);
    router.push(`${actionPath}?${params.toString()}`);
  }

  function openSuggestion(name: string) {
    setSuggestionsOpen(false);
    router.push(`/search?q=${encodeURIComponent(name)}`);
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
          <Search size={20} className="shrink-0 text-[#ff6b00]" />
          <span className="sr-only">Ne arıyorsun?</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setSuggestionsOpen(false), 120);
            }}
            className="h-13 min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-black/40"
            placeholder="Ne arıyorsun? Örn. iPhone 13"
            autoComplete="off"
          />
        </label>

        {suggestionsOpen && (suggestions.length > 0 || isLoadingSuggestions) && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-80 overflow-y-auto rounded-2xl border border-black/10 bg-white p-2 shadow-[0_18px_60px_rgba(0,0,0,0.14)]">
            <div className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-black/35">
              {query.trim() ? "Arama önerileri" : "Popüler aramalar"}
            </div>
            {isLoadingSuggestions && suggestions.length === 0 ? (
              <div className="px-3 py-3 text-sm font-semibold text-black/45">
                Öneriler yükleniyor...
              </div>
            ) : (
              <div className="grid gap-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openSuggestion(suggestion.name)}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition hover:bg-[#fff4eb]"
                  >
                    <span className="min-w-0 truncate">{suggestion.name}</span>
                    <span className="shrink-0 rounded-full bg-black/5 px-2 py-1 text-[11px] font-black text-black/45">
                      {suggestion.listingCount} ilan
                    </span>
                  </button>
                ))}
              </div>
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
