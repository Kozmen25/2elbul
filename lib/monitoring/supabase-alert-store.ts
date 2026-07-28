/**
 * SupabaseAlertStore — AlertStore backed by alert_snapshots table.
 *
 * Feature flag: ALERT_STORE=supabase (default: memory)
 * Graceful fallback: returns empty results on DB error (never throws).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Alert, AlertFilter, AlertStore } from "./types";

interface AlertSnapshotRow {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  source_id: number | null;
  source_name: string | null;
  metadata: Record<string, unknown>;
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  expires_at: string | null;
  count: number;
}

function rowToAlert(row: AlertSnapshotRow): Alert {
  return {
    id: row.id,
    type: row.type as Alert["type"],
    severity: row.severity as Alert["severity"],
    status: row.status as Alert["status"],
    title: row.title,
    message: row.message,
    sourceId: row.source_id,
    sourceName: row.source_name,
    metadata: row.metadata ?? {},
    triggeredAt: row.triggered_at,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    resolvedAt: row.resolved_at,
    expiresAt: row.expires_at,
    count: row.count,
  };
}

export class SupabaseAlertStore implements AlertStore {
  private supabase: SupabaseClient | null = null;
  private warned = false;

  private getClient(): SupabaseClient | null {
    if (!this.supabase) {
      this.supabase = createSupabaseAdminClient();
      if (!this.supabase && !this.warned) {
        this.warned = true;
        console.warn(
          "[SupabaseAlertStore] Supabase admin client not available — falling back to no-op",
        );
      }
    }
    return this.supabase;
  }

  async save(alert: Alert): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    const { error } = await supabase.from("alert_snapshots").upsert(
      {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        message: alert.message,
        source_id: alert.sourceId,
        source_name: alert.sourceName,
        metadata: alert.metadata,
        triggered_at: alert.triggeredAt,
        acknowledged_at: alert.acknowledgedAt,
        acknowledged_by: alert.acknowledgedBy,
        resolved_at: alert.resolvedAt,
        expires_at: alert.expiresAt,
        count: alert.count,
      },
      { onConflict: "id" },
    );

    if (error) {
      console.error("[SupabaseAlertStore] save failed:", error.message);
    }
  }

  async list(filter?: AlertFilter): Promise<Alert[]> {
    const supabase = this.getClient();
    if (!supabase) return [];

    let query = supabase
      .from("alert_snapshots")
      .select("*")
      .order("triggered_at", { ascending: false });

    if (filter?.type) query = query.eq("type", filter.type);
    if (filter?.severity) query = query.eq("severity", filter.severity);
    if (filter?.status) query = query.eq("status", filter.status);
    if (filter?.sourceId) query = query.eq("source_id", filter.sourceId);

    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error("[SupabaseAlertStore] list failed:", error.message);
      return [];
    }

    return ((data ?? []) as AlertSnapshotRow[]).map(rowToAlert);
  }

  async acknowledge(id: string, by: string): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    const { error } = await supabase
      .from("alert_snapshots")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: by,
      })
      .eq("id", id)
      .eq("status", "active");

    if (error) {
      console.error("[SupabaseAlertStore] acknowledge failed:", error.message);
    }
  }

  async resolve(id: string): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    const { error } = await supabase
      .from("alert_snapshots")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .in("status", ["active", "acknowledged"]);

    if (error) {
      console.error("[SupabaseAlertStore] resolve failed:", error.message);
    }
  }

  async getActive(): Promise<Alert[]> {
    const supabase = this.getClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("alert_snapshots")
      .select("*")
      .in("status", ["active", "acknowledged"])
      .order("triggered_at", { ascending: false });

    if (error) {
      console.error("[SupabaseAlertStore] getActive failed:", error.message);
      return [];
    }

    return ((data ?? []) as AlertSnapshotRow[]).map(rowToAlert);
  }
}
