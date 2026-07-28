/**
 * Load test metrics collector.
 *
 * Wraps timing, counting, and memory sampling for structured metric reports.
 * Uses performance.now() for precision timing, process.memoryUsage() for memory.
 */
export interface MetricSnapshot {
  /** Human-readable label for this snapshot. */
  label: string;
  /** Elapsed milliseconds since the collector was created. */
  elapsedMs: number;
  /** RSS memory in MB (Node.js). 0 if unavailable. */
  rssMb: number;
  /** Heap used in MB. 0 if unavailable. */
  heapUsedMb: number;
}

export interface MetricCount {
  /** Items processed in this phase. */
  items: number;
  /** Number of products matched by the matcher. */
  matched: number;
  /** Number of new products created. */
  created: number;
  /** Number of duplicate groups detected. */
  duplicateGroups: number;
  /** Number of errors encountered. */
  errors: number;
}

export interface StubCallMetrics {
  /** Total Supabase queries made. */
  totalQueries: number;
  /** Breakdown by table. */
  queriesByTable: Record<string, number>;
  /** Breakdown by method. */
  queriesByMethod: Record<string, number>;
  /** Total product INSERT count. */
  productInserts: number;
  /** Total SELECT queries. */
  productSelects: number;
}

export interface TimingResult {
  /** Phase label. */
  phase: string;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Throughput: items per second. */
  throughputPerSec: number;
}

export interface LoadTestMetrics {
  /** Test configuration: scale, source, path type. */
  config: {
    scale: number;
    source: string;
    path: string;
  };
  /** Timing breakdown by phase. */
  timings: TimingResult[];
  /** Total test duration in ms. */
  totalMs: number;
  /** Final metric counts. */
  counts: MetricCount;
  /** Memory snapshots throughout the test. */
  memorySnapshots: MetricSnapshot[];
  /** Supabase stub call metrics. */
  stubCalls: StubCallMetrics;
  /** Throughput in items/second (total). */
  throughputPerSec: number;
}

export class MetricsCollector {
  private startTime: number;
  private phaseStart: number;
  private snapshots: MetricSnapshot[] = [];
  private counts: MetricCount = {
    items: 0,
    matched: 0,
    created: 0,
    duplicateGroups: 0,
    errors: 0,
  };
  private timings: TimingResult[] = [];

  constructor() {
    this.startTime = performance.now();
    this.phaseStart = this.startTime;
    this.takeSnapshot("start");
  }

  /** Mark the beginning of a new phase. Returns elapsed since start. */
  beginPhase(label: string): void {
    this.phaseStart = performance.now();
    this.takeSnapshot(`begin:${label}`);
  }

  /** End the current phase and record timing. */
  endPhase(label: string, itemCount?: number): TimingResult {
    const now = performance.now();
    const durationMs = now - this.phaseStart;
    const result: TimingResult = {
      phase: label,
      durationMs: Math.round(durationMs * 100) / 100,
      throughputPerSec: itemCount ? Math.round((itemCount / (durationMs / 1000)) * 100) / 100 : 0,
    };
    this.timings.push(result);
    this.takeSnapshot(`end:${label}`);
    return result;
  }

  /** Sample memory and record a snapshot. */
  takeSnapshot(label: string): MetricSnapshot {
    let rssMb = 0;
    let heapUsedMb = 0;
    try {
      const mem = process.memoryUsage();
      rssMb = Math.round((mem.rss / 1024 / 1024) * 100) / 100;
      heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
    } catch {
      // process.memoryUsage() might not be available in all environments
    }

    const snapshot: MetricSnapshot = {
      label,
      elapsedMs: Math.round((performance.now() - this.startTime) * 100) / 100,
      rssMb,
      heapUsedMb,
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  /** Record numeric counts. Accumulates with existing. */
  recordCounts(partial: Partial<MetricCount>): void {
    if (partial.items !== undefined) this.counts.items += partial.items;
    if (partial.matched !== undefined) this.counts.matched += partial.matched;
    if (partial.created !== undefined) this.counts.created += partial.created;
    if (partial.duplicateGroups !== undefined) this.counts.duplicateGroups += partial.duplicateGroups;
    if (partial.errors !== undefined) this.counts.errors += partial.errors;
  }

  /** Analyze stub call records and produce StubCallMetrics. */
  analyzeStubCalls(calls: Array<{ table: string; method: string; args: unknown[] }>): StubCallMetrics {
    const queriesByTable: Record<string, number> = {};
    const queriesByMethod: Record<string, number> = {};
    let productInserts = 0;
    let productSelects = 0;

    for (const call of calls) {
      queriesByTable[call.table] = (queriesByTable[call.table] || 0) + 1;
      queriesByMethod[call.method] = (queriesByMethod[call.method] || 0) + 1;
      if (call.table === "products" && call.method === "insert") {
        productInserts++;
      }
      if (call.table === "products" && call.method === "select") {
        productSelects++;
      }
    }

    return {
      totalQueries: calls.length,
      queriesByTable,
      queriesByMethod,
      productInserts,
      productSelects,
    };
  }

  /** Produce the final metric report. */
  finalize(config: LoadTestMetrics["config"], stubCalls: StubCallMetrics): LoadTestMetrics {
    const totalMs = performance.now() - this.startTime;

    return {
      config,
      timings: this.timings,
      totalMs: Math.round(totalMs * 100) / 100,
      counts: { ...this.counts },
      memorySnapshots: [...this.snapshots],
      stubCalls,
      throughputPerSec: Math.round((this.counts.items / (totalMs / 1000)) * 100) / 100,
    };
  }
}

/** Format metrics as a human-readable block (for inline test output). */
export function formatMetrics(m: LoadTestMetrics): string {
  const lines: string[] = [
    `=== Load Test: ${m.config.path} | ${m.config.scale} listings | ${m.config.source} ===`,
    `Total duration: ${(m.totalMs / 1000).toFixed(2)}s | Throughput: ${m.throughputPerSec}/s`,
    ``,
    `  Items: ${m.counts.items} | Matched: ${m.counts.matched} | Created: ${m.counts.created}`,
    `  Duplicate groups: ${m.counts.duplicateGroups} | Errors: ${m.counts.errors}`,
    ``,
    `  ── Timing Breakdown ──`,
  ];

  for (const t of m.timings) {
    lines.push(`  ${t.phase}: ${(t.durationMs / 1000).toFixed(2)}s (${t.throughputPerSec}/s)`);
  }

  lines.push(
    ``,
    `  ── DB Queries (stub) ──`,
    `  Total: ${m.stubCalls.totalQueries} | Inserts: ${m.stubCalls.productInserts} | Selects: ${m.stubCalls.productSelects}`,
  );

  if (Object.keys(m.stubCalls.queriesByTable).length > 0) {
    lines.push(`  By table:`);
    for (const [table, count] of Object.entries(m.stubCalls.queriesByTable).sort()) {
      lines.push(`    ${table}: ${count}`);
    }
  }

  if (m.memorySnapshots.length > 0) {
    const last = m.memorySnapshots[m.memorySnapshots.length - 1];
    lines.push(
      ``,
      `  ── Memory ──`,
      `  RSS: ${last.rssMb.toFixed(1)} MB | Heap: ${last.heapUsedMb.toFixed(1)} MB`,
      `  Start RSS: ${m.memorySnapshots[0].rssMb.toFixed(1)} MB`,
    );
  }

  return lines.join("\n");
}
