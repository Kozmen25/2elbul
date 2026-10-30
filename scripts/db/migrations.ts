// Pure migration planning logic (no I/O) — see scripts/db/migrate.ts.
//
// Files follow the Supabase CLI convention `<14-digit version>_<name>.sql`
// and are tracked in `supabase_migrations.schema_migrations`, the same table
// the Supabase CLI uses, so `supabase migration list` / `db push` keep
// working if the project later switches to a direct DB connection.

export const MIGRATION_FILE_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;

export const MIGRATIONS_TABLE = "supabase_migrations.schema_migrations";

/**
 * Directive a migration may carry on its first line to be recorded without
 * being executed. Used only for the baseline, which describes schema that
 * already existed before migrations were tracked.
 */
export const BASELINE_DIRECTIVE = "-- migrate:baseline";

export type MigrationFile = {
  version: string;
  name: string;
  fileName: string;
  sql: string;
};

export type MigrationPlan = {
  applied: MigrationFile[];
  pending: MigrationFile[];
  /** Versions recorded in the database with no matching local file. */
  unknown: string[];
};

export function parseMigrationFile(fileName: string, sql: string): MigrationFile | null {
  const match = MIGRATION_FILE_PATTERN.exec(fileName);
  if (!match) return null;
  return { version: match[1], name: match[2], fileName, sql };
}

export function sortMigrations(files: MigrationFile[]): MigrationFile[] {
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.version)) {
      throw new Error(`Duplicate migration version ${file.version} (${file.fileName}).`);
    }
    seen.add(file.version);
  }
  return [...files].sort((a, b) => a.version.localeCompare(b.version));
}

export function planMigrations(files: MigrationFile[], appliedVersions: string[]): MigrationPlan {
  const sorted = sortMigrations(files);
  const applied = new Set(appliedVersions);
  const local = new Set(sorted.map((file) => file.version));
  return {
    applied: sorted.filter((file) => applied.has(file.version)),
    pending: sorted.filter((file) => !applied.has(file.version)),
    unknown: appliedVersions.filter((version) => !local.has(version)).sort(),
  };
}

export function isBaseline(file: MigrationFile): boolean {
  return file.sql.trimStart().startsWith(BASELINE_DIRECTIVE);
}

/** Postgres dollar-quote tag that does not occur inside `text`. */
function dollarQuote(text: string): string {
  let tag = "$mig$";
  for (let i = 0; text.includes(tag); i += 1) tag = `$mig${i}$`;
  return `${tag}${text}${tag}`;
}

export const ENSURE_MIGRATIONS_TABLE_SQL = `
create schema if not exists supabase_migrations;
create table if not exists ${MIGRATIONS_TABLE} (
  version text primary key,
  statements text[],
  name text
);`;

/**
 * Wraps a migration so its statements and its tracking row commit atomically:
 * either the whole file applies and is recorded, or nothing changes.
 */
export function buildApplySql(file: MigrationFile): string {
  const body = isBaseline(file) ? "" : `${file.sql.trim()}\n;\n`;
  return [
    "begin;",
    body,
    `insert into ${MIGRATIONS_TABLE} (version, name, statements) values ` +
      `('${file.version}', '${file.name}', array[${dollarQuote(file.sql)}]);`,
    "commit;",
  ].join("\n");
}
