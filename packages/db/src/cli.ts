import pg from "pg";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "./index.js";

// Uses a dedicated migration credential, never the runtime API credential.
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error("MIGRATION_DATABASE_URL is required (migrator credential, separate from DATABASE_URL)");
  process.exit(2);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const applied = await migrate(client, loadMigrations(MIGRATIONS_DIR), { asRole: process.env.MIGRATION_SET_ROLE });
  console.log(applied.length ? `applied: ${applied.join(", ")}` : "database is up to date");
} finally {
  await client.end();
}
