import type { BotAdapterListing } from "@/lib/bots/types";
import { classifyError, isRetryableByCategory } from "./failure-classification";
import { CircuitBreakerRegistry } from "./circuit-breaker";
import type { ErrorCategory } from "./types";
import { DeadLetterQueue } from "./dead-letter-queue";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export function withRecoveryPolicy(
  fetcher: (url: string, limit: number) => Promise<BotAdapterListing[]>,
  sourceSlug: string,
): (url: string, limit: number) => Promise<BotAdapterListing[]> {
  return async (url: string, limit: number) => {
    const cb = CircuitBreakerRegistry.getInstance();

    if (!cb.isAvailable(sourceSlug)) {
      console.warn(
        `[Recovery] CB açık, atlanıyor: ${sourceSlug} (${url})`,
      );
      return [];
    }

    try {
      const result = await fetcher(url, limit);
      cb.recordSuccess(sourceSlug);
      return result;
    } catch (error) {
      const category: ErrorCategory = classifyError(error);

      // Auth hataları CB/DLQ'ya gitmez — kalıcı hatalardır
      if (category === "auth") {
        throw error;
      }

      cb.recordFailure(sourceSlug);

      // CB açıldıysa DLQ'ya kaydet
      const cbState = cb.getState(sourceSlug);
      if (cbState.state === "open") {
        const supabase = createSupabaseAdminClient();
        if (supabase) {
          const dlq = new DeadLetterQueue(supabase);
          const message =
            error instanceof Error ? error.message : String(error);
          dlq.insert({
            source_id: null,
            source_slug: sourceSlug,
            queue_type: "scrape",
            retry_count: cbState.failureCount,
            max_retries: 5,
            last_error: message,
            error_category: category,
            payload: {},
            status: "pending",
            next_retry_at: null,
            resolved_at: null,
            notes: null,
          });
        }
      }

      if (isRetryableByCategory(category)) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[Recovery] ${sourceSlug} başarısız (${category}): ${message}`,
        );
      }

      throw error;
    }
  };
}
