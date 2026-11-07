import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";

export class MigrationError extends Error {}

export interface MigrationFile {
  version: string; // e.g. "0001"
  name: string;
  sql: string;
  checksum: string;
}

const FILE = /^(\d{4})_([a-z0-9_]+)\.sql$/;

/** SHA-256 of the LF-normalised file, so Windows checkouts match Linux CI. */
export const checksum = (sql: string): string => createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");

export function loadMigrations(dir: string): MigrationFile[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const seen = new Set<string>();
  return files.map((f, i) => {
    const m = FILE.exec(f);
    if (!m) throw new MigrationError(`Invalid migration file name: ${f} (expected NNNN_name.sql)`);
    const [, version, name] = m as unknown as [string, string, string];
    if (seen.has(version)) throw new MigrationError(`Duplicate migration version ${version}`);
    seen.add(version);
    if (Number(version) !== i + 1) throw new MigrationError(`Migration versions must be contiguous from 0001; got ${version} at position ${i + 1}`);
    const sql = readFileSync(join(dir, f), "utf8");
    return { version, name, sql, checksum: checksum(sql) };
  });
}

export interface MigrateOptions {
  /** Apply only up to and including this version (for upgrade-path tests). */
  upTo?: string;
  /** Run each migration as this role (SET LOCAL ROLE). Omit when connecting as the migrator itself. */
  asRole?: string;
}

const LEDGER = "migrations.applied";

/**
 * Applies pending migrations, each in its own transaction (a failure leaves no partial state),
 * verifying that already-applied migrations have not been edited. Returns applied versions.
 */
export async function migrate(client: Client, migrations: MigrationFile[], opts: MigrateOptions = {}): Promise<string[]> {
  const exists = await client.query("SELECT to_regnamespace('migrations') AS s");
  if (!exists.rows[0].s) throw new MigrationError("Schema 'migrations' missing: run db/bootstrap/001_roles_and_schemas.sql first");
  await client.query("SELECT pg_advisory_lock(7360001)"); // one migrator at a time
  try {
    await client.query("BEGIN");
    if (opts.asRole) await client.query(`SET LOCAL ROLE ${client.escapeIdentifier(opts.asRole)}`);
    await client.query(`CREATE TABLE IF NOT EXISTS ${LEDGER} (version text PRIMARY KEY, name text NOT NULL, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    await client.query("COMMIT");

    const done = new Map<string, string>((await client.query(`SELECT version, checksum FROM ${LEDGER}`)).rows.map((r) => [r.version, r.checksum]));
    for (const m of migrations) {
      const prior = done.get(m.version);
      if (prior !== undefined && prior !== m.checksum) {
        throw new MigrationError(`Migration ${m.version}_${m.name} was modified after it was applied (checksum mismatch)`);
      }
    }
    for (const v of done.keys()) {
      if (!migrations.some((m) => m.version === v)) throw new MigrationError(`Database has migration ${v} that is missing from this checkout`);
    }

    const applied: string[] = [];
    for (const m of migrations) {
      if (opts.upTo && m.version > opts.upTo) break;
      if (done.has(m.version)) continue;
      try {
        await client.query("BEGIN");
        if (opts.asRole) await client.query(`SET LOCAL ROLE ${client.escapeIdentifier(opts.asRole)}`);
        await client.query(m.sql);
        await client.query(`INSERT INTO ${LEDGER} (version, name, checksum) VALUES ($1, $2, $3)`, [m.version, m.name, m.checksum]);
        await client.query("COMMIT");
        applied.push(m.version);
      } catch (e) {
        await client.query("ROLLBACK");
        throw new MigrationError(`Migration ${m.version}_${m.name} failed and was rolled back: ${(e as Error).message}`);
      }
    }
    return applied;
  } finally {
    await client.query("SELECT pg_advisory_unlock(7360001)");
  }
}
