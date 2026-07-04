import type { SourceRunRecord, SourceRunResult } from "@/lib/bots/source-runner";

export type SourceEngineMode = "scheduled" | "manual" | "real_test" | "debug";

export type SourceEngineRunOptions = {
  mode: SourceEngineMode;
  force?: boolean;
  sourceId?: number;
  sourceSlug?: string;
  limit?: number;
  includeUnsupported?: boolean;
};

export type SourceEngineSource = SourceRunRecord & {
  is_active?: boolean | null;
  cron_enabled?: boolean | null;
  integration_type?: string | null;
  cron_schedule?: string | null;
  last_run_at?: string | null;
};

export type SourceEngineSkippedSource = {
  id: number;
  name: string;
  slug: string;
  reason: string;
};

export type SourceEngineSummary = {
  ok: boolean;
  mode: SourceEngineMode;
  force: boolean;
  scanned: number;
  ran: number;
  skipped: number;
  found: number;
  imported: number;
  updated: number;
  inactive: number;
  reactivated: number;
  matchedProducts: number;
  errorCount: number;
  durationMs: number;
  skippedSources: SourceEngineSkippedSource[];
  results: SourceRunResult[];
};
