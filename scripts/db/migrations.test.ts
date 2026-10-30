import { describe, expect, it } from "vitest";
import { projectRefFromUrl, readManagementApiConfig } from "./management-api";
import {
  BASELINE_DIRECTIVE,
  MIGRATIONS_TABLE,
  buildApplySql,
  parseMigrationFile,
  planMigrations,
  sortMigrations,
  type MigrationFile,
} from "./migrations";

function migration(version: string, name = "change", sql = "select 1;"): MigrationFile {
  return { version, name, fileName: `${version}_${name}.sql`, sql };
}

describe("parseMigrationFile", () => {
  it("parses Supabase CLI style file names", () => {
    expect(parseMigrationFile("20260930000100_add_table.sql", "select 1;")).toEqual({
      version: "20260930000100",
      name: "add_table",
      fileName: "20260930000100_add_table.sql",
      sql: "select 1;",
    });
  });

  it("rejects legacy or malformed names", () => {
    expect(parseMigrationFile("20260920-categories-table.sql", "")).toBeNull();
    expect(parseMigrationFile("saved-searches.sql", "")).toBeNull();
    expect(parseMigrationFile("2026093000_short.sql", "")).toBeNull();
  });
});

describe("sortMigrations", () => {
  it("orders by version", () => {
    const sorted = sortMigrations([migration("20260930000300"), migration("20260930000100")]);
    expect(sorted.map((file) => file.version)).toEqual(["20260930000100", "20260930000300"]);
  });

  it("rejects duplicate versions", () => {
    expect(() => sortMigrations([migration("20260930000100", "a"), migration("20260930000100", "b")])).toThrow(
      /Duplicate migration version/,
    );
  });
});

describe("planMigrations", () => {
  it("splits applied, pending and unknown versions", () => {
    const plan = planMigrations(
      [migration("20260930000200"), migration("20260930000100"), migration("20260930000300")],
      ["20260930000100", "20250101000000"],
    );
    expect(plan.applied.map((file) => file.version)).toEqual(["20260930000100"]);
    expect(plan.pending.map((file) => file.version)).toEqual(["20260930000200", "20260930000300"]);
    expect(plan.unknown).toEqual(["20250101000000"]);
  });
});

describe("buildApplySql", () => {
  it("runs the migration and records it in one transaction", () => {
    const sql = buildApplySql(migration("20260930000100", "add_col", "alter table t add column c int;"));
    expect(sql.startsWith("begin;")).toBe(true);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql).toContain("alter table t add column c int;");
    expect(sql).toContain(`insert into ${MIGRATIONS_TABLE}`);
    expect(sql).toContain("'20260930000100', 'add_col'");
  });

  it("records a baseline without executing it", () => {
    const sql = buildApplySql(migration("20260930000000", "baseline", `${BASELINE_DIRECTIVE}\ncreate table x ();`));
    const beforeInsert = sql.slice(0, sql.indexOf("insert into"));
    expect(beforeInsert).not.toContain("create table x");
    expect(sql).toContain("create table x");
  });

  it("chooses a dollar-quote tag that does not collide with the migration body", () => {
    const body = "create function f() returns int language sql as $mig$ select 1 $mig$;";
    const sql = buildApplySql(migration("20260930000100", "fn", body));
    expect(sql).toContain(`array[$mig0$${body}$mig0$]`);
  });
});

describe("management api config", () => {
  it("derives the project ref from the Supabase URL", () => {
    expect(projectRefFromUrl("https://tbdewzsfdhzoyqvkhhye.supabase.co")).toBe("tbdewzsfdhzoyqvkhhye");
    expect(projectRefFromUrl("https://example.com")).toBeNull();
  });

  it("requires an access token", () => {
    expect(() => readManagementApiConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" })).toThrow(
      /SUPABASE_ACCESS_TOKEN/,
    );
  });

  it("prefers an explicit project ref", () => {
    expect(
      readManagementApiConfig({
        SUPABASE_ACCESS_TOKEN: "token",
        SUPABASE_PROJECT_REF: "override",
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      }),
    ).toEqual({ accessToken: "token", projectRef: "override" });
  });
});
