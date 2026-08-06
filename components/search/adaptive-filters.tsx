"use client";

import { useMemo } from "react";
import { detectQueryIntent } from "@/lib/search/query-intent-detector";
import { getFilterConfigForQuery, type FilterConfig } from "@/lib/search/filter-configs";

type AdaptiveFiltersProps = {
  query: string;
  onFilterChange?: (attributeType: string, value: string) => void;
  filters?: Record<string, string>;
};

/** Returns true when every config is a generic "condition" filter (the fallback). */
function isGeneralConfig(configs: FilterConfig[]): boolean {
  if (configs.length === 0) return true;
  return configs.every((c) => c.attributeType === "condition");
}

/**
 * Dynamic search filters that adapt to the user's query intent.
 *
 * Analyzes the search query with detectQueryIntent(), looks up relevant
 * filter configs via getFilterConfigForQuery(), and renders them as
 * labelled select/input controls.
 *
 * Returns null when the query has no product-type-specific filters
 * (e.g. generic searches that only surface a condition filter).
 */
export function AdaptiveFilters({
  query,
  onFilterChange,
  filters = {},
}: AdaptiveFiltersProps) {
  const configs = useMemo(() => {
    if (!query.trim()) return [];
    const intent = detectQueryIntent(query);
    return getFilterConfigForQuery(intent);
  }, [query]);

  // Render nothing when no product-type-specific filters match
  if (configs.length === 0 || isGeneralConfig(configs)) return null;

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-4">
      <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-black/50">
        Detaylı Filtreler
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {configs.map((cfg) => (
          <label
            key={cfg.attributeType}
            className={cfg.values && cfg.values.length > 6 ? "col-span-2" : ""}
          >
            <span className="mb-1.5 block text-xs font-bold text-black/50">
              {cfg.label}
            </span>
            {cfg.values ? (
              <select
                value={filters[cfg.attributeType] ?? ""}
                onChange={(e) => onFilterChange?.(cfg.attributeType, e.target.value)}
                className="field h-12 w-full px-3 text-sm font-semibold"
              >
                <option value="">{cfg.placeholder ?? `Tümü`}</option>
                {cfg.values.map((v) => (
                  <option key={v} value={v}>
                    {v}
                    {cfg.unit ? ` ${cfg.unit}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={filters[cfg.attributeType] ?? ""}
                onChange={(e) => onFilterChange?.(cfg.attributeType, e.target.value)}
                placeholder={cfg.placeholder ?? cfg.label}
                className="field h-12 w-full px-3 text-sm font-semibold"
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
