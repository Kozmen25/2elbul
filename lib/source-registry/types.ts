import type { ListingSource } from "@/lib/listings";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SourceRegistryRecord = {
  sourceId: number;
  sourceName: string;
  sourceSlug: string;
  type: string;
  isActive: boolean;
  reliabilityScore: number;
  listingSource: ListingSource;
};

export interface SourceRegistry {
  initialize(supabase: SupabaseClient): Promise<void>;
  getById(sourceId: number): SourceRegistryRecord | null;
  getBySlug(slug: string): SourceRegistryRecord | null;
  getByName(name: string): SourceRegistryRecord | null;
  getAllActive(): SourceRegistryRecord[];
  getAll(): SourceRegistryRecord[];
  getReliability(sourceId: number): number;
  resolveSourceCount(
    id1: number | null | undefined,
    id2: number | null | undefined
  ): number;
  register(record: SourceRegistryRecord): void;
}
