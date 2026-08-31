import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recursively deletes every key whose name matches a sensitive marker
 * (password, token, secret, api key, service role, authorization, cookie,
 * session, refresh). Metadata written to the admin audit log MUST pass through
 * this before any DB write or log — a single choke point enforcing the
 * never-persist-secrets guarantee (§5, §13-14).
 */
const SENSITIVE_KEY = /password|token|secret|api.?key|service.?role|authorization|cookie|session|refresh|key/i;

export function sanitizeAuditMetadata(
  input: unknown,
): Record<string, unknown> {
  if (input === null || typeof input !== "object") return {};
  if (Array.isArray(input)) {
    return { values: input.map((v) => sanitizeAuditMetadata(v)) };
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (value !== null && typeof value === "object") {
      out[key] = sanitizeAuditMetadata(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export type LogAdminActionInput = {
  action: string;
  targetUserId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
};

export async function logAdminAction(
  adminClient: SupabaseClient | null,
  adminUserId: string,
  input: LogAdminActionInput,
): Promise<void> {
  if (!adminClient) return;
  try {
    await adminClient.from("admin_audit_logs").insert({
      admin_user_id: adminUserId,
      action: input.action,
      target_user_id: input.targetUserId ?? null,
      // Always sanitized before the DB write — never the raw input.
      metadata: sanitizeAuditMetadata(input.metadata ?? {}),
      ip_address: input.ipAddress ?? null,
    });
  } catch (error) {
    console.error(`[audit] failed to log ${input.action}:`, error);
  }
}
