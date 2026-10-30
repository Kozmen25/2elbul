// Applies tracked SQL migrations from supabase/migrations via the Supabase
// Management API.
//
// Usage:
//   npm run db:status              list applied / pending migrations
//   npm run db:migrate             apply all pending migrations in order
//   npm run db:migrate -- --dry-run  show what would be applied

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { readManagementApiConfig, runSql } from "./management-api";
import {
  ENSURE_MIGRATIONS_TABLE_SQL,
  MIGRATIONS_TABLE,
  buildApplySql,
  isBaseline,
  parseMigrationFile,
  planMigrations,
  type MigrationFile,
} from "./migrations";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

function readLocalMigrations(): MigrationFile[] {
  const files: MigrationFile[] = [];
  for (const fileName of readdirSync(MIGRATIONS_DIR)) {
    if (!fileName.endsWith(".sql")) continue;
    const parsed = parseMigrationFile(fileName, readFileSync(path.join(MIGRATIONS_DIR, fileName), "utf8"));
    if (!parsed) {
      throw new Error(`Invalid migration file name: ${fileName} (expected <YYYYMMDDHHMMSS>_<name>.sql)`);
    }
    files.push(parsed);
  }
  return files;
}

async function main() {
  const [command = "status", ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  const config = readManagementApiConfig();

  await runSql(config, ENSURE_MIGRATIONS_TABLE_SQL);
  const appliedRows = await runSql<{ version: string }>(
    config,
    `select version from ${MIGRATIONS_TABLE} order by version`,
  );
  const plan = planMigrations(
    readLocalMigrations(),
    appliedRows.map((row) => row.version),
  );

  console.log(`Project: ${config.projectRef}`);
  for (const file of plan.applied) console.log(`  applied  ${file.fileName}`);
  for (const file of plan.pending) console.log(`  pending  ${file.fileName}${isBaseline(file) ? " (baseline: record only)" : ""}`);
  for (const version of plan.unknown) console.log(`  unknown  ${version} (recorded in DB, no local file)`);

  if (command === "status") return;
  if (command !== "up") throw new Error(`Unknown command "${command}". Use "status" or "up".`);

  if (plan.pending.length === 0) {
    console.log("Database is up to date.");
    return;
  }
  if (dryRun) {
    console.log(`Dry run: ${plan.pending.length} migration(s) would be applied.`);
    return;
  }

  for (const file of plan.pending) {
    process.stdout.write(`Applying ${file.fileName} ... `);
    await runSql(config, buildApplySql(file));
    console.log("ok");
  }
  console.log(`Applied ${plan.pending.length} migration(s).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
