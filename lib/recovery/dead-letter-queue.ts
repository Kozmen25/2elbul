import type { SupabaseClient } from "@supabase/supabase-js";
import type { DLQEntry, DLQStatus, ErrorCategory } from "./types";

export interface DLQInsertPayload {
  source_id: number | null;
  source_slug: string;
  queue_type: "scrape" | "search_queue";
  retry_count: number;
  max_retries: number;
  last_error: string;
  error_category: ErrorCategory;
  payload: Record<string, unknown>;
  status: DLQStatus;
  next_retry_at: string | null;
  resolved_at: string | null;
  notes: string | null;
}

export interface DLQListFilter {
  sourceSlug?: string;
  status?: DLQStatus;
  errorCategory?: ErrorCategory;
  limit?: number;
  offset?: number;
}

export interface DLQStats {
  pending: number;
  retrying: number;
  resolved: number;
  dead: number;
  total: number;
}

export class DeadLetterQueue {
  constructor(private supabase: SupabaseClient) {}

  async insert(entry: DLQInsertPayload): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("dead_letter_queue")
      .insert({
        source_id: entry.source_id,
        source_slug: entry.source_slug,
        queue_type: entry.queue_type,
        retry_count: entry.retry_count,
        max_retries: entry.max_retries,
        last_error: entry.last_error,
        error_category: entry.error_category,
        payload: entry.payload,
        status: entry.status,
        next_retry_at: entry.next_retry_at,
        resolved_at: entry.resolved_at,
        notes: entry.notes,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[DLQ] insert hatası:", error);
      return null;
    }
    return data?.id ?? null;
  }

  async list(filter?: DLQListFilter): Promise<DLQEntry[]> {
    let query = this.supabase
      .from("dead_letter_queue")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter?.sourceSlug) {
      query = query.eq("source_slug", filter.sourceSlug);
    }
    if (filter?.status) {
      query = query.eq("status", filter.status);
    }
    if (filter?.errorCategory) {
      query = query.eq("error_category", filter.errorCategory);
    }
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }
    if (filter?.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit ?? 50) - 1);
    }

    const { data, error } = await query;

    if (error || !data) return [];
    return data as DLQEntry[];
  }

  async getById(id: string): Promise<DLQEntry | null> {
    const { data, error } = await this.supabase
      .from("dead_letter_queue")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as DLQEntry;
  }

  async retry(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("dead_letter_queue")
      .update({
        status: "retrying",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[DLQ] retry hatası:", error);
    }
  }

  async resolve(id: string, notes?: string): Promise<void> {
    const update: Record<string, unknown> = {
      status: "resolved",
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (notes !== undefined) update.notes = notes;

    const { error } = await this.supabase
      .from("dead_letter_queue")
      .update(update)
      .eq("id", id);

    if (error) {
      console.error("[DLQ] resolve hatası:", error);
    }
  }

  async markDead(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("dead_letter_queue")
      .update({
        status: "dead",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[DLQ] markDead hatası:", error);
    }
  }

  async getStats(): Promise<DLQStats> {
    const { data, error } = await this.supabase
      .from("dead_letter_queue")
      .select("status");

    if (error || !data) {
      return { pending: 0, retrying: 0, resolved: 0, dead: 0, total: 0 };
    }

    const stats: DLQStats = {
      pending: 0,
      retrying: 0,
      resolved: 0,
      dead: 0,
      total: data.length,
    };

    for (const row of data) {
      const s = row.status as DLQStatus;
      if (s === "pending") stats.pending++;
      else if (s === "retrying") stats.retrying++;
      else if (s === "resolved") stats.resolved++;
      else if (s === "dead") stats.dead++;
    }

    return stats;
  }

  async retryAllPending(): Promise<number> {
    const { data, error } = await this.supabase
      .from("dead_letter_queue")
      .update({
        status: "retrying",
        updated_at: new Date().toISOString(),
      })
      .eq("status", "pending")
      .select("id");

    if (error) {
      console.error("[DLQ] retryAllPending hatası:", error);
      return 0;
    }

    return data?.length ?? 0;
  }
}
