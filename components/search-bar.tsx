"use client";

import { MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SearchBarProps = {
  compact?: boolean;
  initialQuery?: string;
  actionPath?: string;
  showLocation?: boolean;
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) params.set("sehir", city);
    router.push(`${actionPath}?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex w-full min-w-0 flex-col gap-2 overflow-hidden bg-white p-2 shadow-[0_18px_60px_rgba(0,0,0,0.1)] sm:flex-row sm:gap-0 ${
        compact ? "rounded-2xl border border-black/8" : "rounded-2xl"
      }`}
    >
      <label className="flex min-w-0 w-full flex-1 items-center gap-3 px-3">
        <Search size={20} className="shrink-0 text-[#ff6b00]" />
        <span className="sr-only">Ne arıyorsun?</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-13 min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-black/40"
          placeholder="Ne arıyorsun? Örn. iPhone 13"
        />
      </label>
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
