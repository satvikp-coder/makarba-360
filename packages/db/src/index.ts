import { fileURLToPath } from "node:url";

export { checksum, loadMigrations, migrate, MigrationError } from "./migrate.js";
export type { MigrateOptions, MigrationFile } from "./migrate.js";

/** Absolute path of the versioned SQL migrations shipped with this package. */
export const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url));
