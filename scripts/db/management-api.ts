// Thin client for the Supabase Management API, used by local DB tooling
// (migrations, type generation). Requires a personal access token — this
// is developer tooling only and must never run inside the Next.js app.
//
// Env:
//   SUPABASE_ACCESS_TOKEN      personal access token (Account → Access Tokens)
//   NEXT_PUBLIC_SUPABASE_URL   used to derive the project ref
//   SUPABASE_PROJECT_REF       optional override for the project ref

const MANAGEMENT_API_BASE = "https://api.supabase.com/v1";
const PROJECT_REF_PATTERN = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/;

export type ManagementApiConfig = {
  accessToken: string;
  projectRef: string;
};

export function projectRefFromUrl(url: string): string | null {
  return PROJECT_REF_PATTERN.exec(url.trim())?.[1] ?? null;
}

export function readManagementApiConfig(
  env: Record<string, string | undefined> = process.env,
): ManagementApiConfig {
  const accessToken = env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef =
    env.SUPABASE_PROJECT_REF?.trim() || projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL ?? "");

  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is not set (see .env.example).");
  }
  if (!projectRef) {
    throw new Error("Could not determine the project ref from NEXT_PUBLIC_SUPABASE_URL.");
  }
  return { accessToken, projectRef };
}

async function request(config: ManagementApiConfig, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${MANAGEMENT_API_BASE}/projects/${config.projectRef}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Management API ${path} failed (${response.status}): ${body.slice(0, 2000)}`);
  }
  return response;
}

/** Runs SQL as the database owner. Multiple statements run in one implicit transaction. */
export async function runSql<Row = Record<string, unknown>>(
  config: ManagementApiConfig,
  query: string,
): Promise<Row[]> {
  const response = await request(config, "/database/query", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!text) return [];
  const parsed: unknown = JSON.parse(text);
  return Array.isArray(parsed) ? (parsed as Row[]) : [];
}

export async function generateTypeScriptTypes(config: ManagementApiConfig, schemas: string[]): Promise<string> {
  const response = await request(
    config,
    `/types/typescript?included_schemas=${encodeURIComponent(schemas.join(","))}`,
  );
  const body = (await response.json()) as { types?: string };
  if (!body.types) {
    throw new Error("Management API returned no types.");
  }
  return body.types;
}

export type AuthConfigPatch = Record<string, string | number | boolean>;

export async function updateAuthConfig(config: ManagementApiConfig, patch: AuthConfigPatch): Promise<void> {
  await request(config, "/config/auth", { method: "PATCH", body: JSON.stringify(patch) });
}

export async function getAuthConfig(config: ManagementApiConfig): Promise<Record<string, unknown>> {
  const response = await request(config, "/config/auth");
  return (await response.json()) as Record<string, unknown>;
}
