import type { SupabaseClient } from "@supabase/supabase-js";

import type { SourceRegistry, SourceRegistryRecord } from "./types";

type RawRow = {
  id: number;
  name: string;
  slug: string;
  type: string;
  is_active: boolean;
  reliability_score?: number | null;
};

export class SourceRegistryImpl implements SourceRegistry {
  private byId = new Map<number, SourceRegistryRecord>();
  private bySlug = new Map<string, SourceRegistryRecord>();
  private byName = new Map<string, SourceRegistryRecord>();

  async initialize(supabase: SupabaseClient): Promise<void> {
    let data: RawRow[] | null = null;
    let error: unknown = null;

    // Try with reliability_score first (full schema)
    const result = await supabase
      .from("sources")
      .select("id, name, slug, type, is_active, reliability_score")
      .order("id");

    if (result.error && isColumnError(result.error)) {
      // Column doesn't exist in prod DB yet — retry without it
      const fallback = await supabase
        .from("sources")
        .select("id, name, slug, type, is_active")
        .order("id");
      data = (fallback.data ?? []) as RawRow[];
      error = fallback.error;
    } else {
      data = (result.data ?? []) as RawRow[];
      error = result.error;
    }

    if (error) throw error;

    for (const row of data ?? []) {
      const record = this.rowToRecord(row);
      this.byId.set(record.sourceId, record);
      this.bySlug.set(record.sourceSlug, record);
      this.byName.set(record.sourceName.toLowerCase(), record);
    }
  }

  getById(sourceId: number): SourceRegistryRecord | null {
    return this.byId.get(sourceId) ?? null;
  }

  getBySlug(slug: string): SourceRegistryRecord | null {
    return this.bySlug.get(slug) ?? null;
  }

  getByName(name: string): SourceRegistryRecord | null {
    return this.byName.get(name.toLowerCase()) ?? null;
  }

  getAllActive(): SourceRegistryRecord[] {
    return Array.from(this.byId.values()).filter((r) => r.isActive);
  }

  getAll(): SourceRegistryRecord[] {
    return Array.from(this.byId.values());
  }

  getReliability(sourceId: number): number {
    return this.byId.get(sourceId)?.reliabilityScore ?? 65;
  }

  resolveSourceCount(
    id1: number | null | undefined,
    id2: number | null | undefined
  ): number {
    if (id1 == null || id2 == null) return 1;
    return id1 === id2 ? 1 : 2;
  }

  register(record: SourceRegistryRecord): void {
    this.byId.set(record.sourceId, record);
    this.bySlug.set(record.sourceSlug, record);
    this.byName.set(record.sourceName.toLowerCase(), record);
  }

  private rowToRecord(row: RawRow): SourceRegistryRecord {
    // listingSource is derived from the source name at runtime.
    // The DB stores the canonical name; the ListingSource union matches it.
    return {
      sourceId: row.id,
      sourceName: row.name,
      sourceSlug: row.slug,
      type: row.type,
      isActive: row.is_active,
      reliabilityScore: row.reliability_score ?? 65,
      listingSource: row.name as SourceRegistryRecord["listingSource"],
    };
  }
}

function isColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string };
  return record.code === "42703";
}
