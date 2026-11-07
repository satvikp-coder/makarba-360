import { createHash } from "node:crypto";
import { z } from "zod";

/** Server-only environment. Never import this from browser bundles. */

export class EnvError extends Error {}

export const APP_ENVS = ["local", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Variables that must never reach a browser bundle, logs or CI output. */
export const SERVER_ONLY_VARS = ["DATABASE_URL", "SESSION_SECRET"] as const;

const PLACEHOLDER = /replace-with|changeme|change-me|makarba_dev|example|password|secret123|test-secret/i;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "db"]);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(APP_ENVS).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
});

export type ServerEnv = Omit<z.infer<typeof schema>, "APP_ENV"> & { APP_ENV: AppEnv };

function dbHost(url: string): { host: string; tls: boolean } | null {
  try {
    const u = new URL(url);
    if (!/^postgres(ql)?:$/.test(u.protocol)) return null;
    return { host: u.hostname.toLowerCase(), tls: ["require", "verify-ca", "verify-full"].includes(u.searchParams.get("sslmode") ?? "") };
  } catch {
    return null;
  }
}

function credentialsOf(url: string): string {
  try {
    const u = new URL(url);
    return `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`;
  } catch {
    return "";
  }
}

/** Environment isolation rules. Messages name variables only, never values. */
function isolationProblems(e: z.infer<typeof schema>, appEnv: AppEnv): string[] {
  const out: string[] = [];
  const db = dbHost(e.DATABASE_URL);
  if (!db) return ["DATABASE_URL: must be a valid postgres:// URL"];
  const isLocalHost = LOCAL_HOSTS.has(db.host);
  if (appEnv === "local") {
    if (e.NODE_ENV === "production") out.push("APP_ENV=local is not allowed with NODE_ENV=production");
    // Prevent a developer machine from silently holding a staging/production database.
    if (!isLocalHost) out.push("DATABASE_URL: local environment must use a local database host");
    return out;
  }
  if (PLACEHOLDER.test(e.SESSION_SECRET)) out.push(`SESSION_SECRET: placeholder or development value not allowed in ${appEnv}`);
  if (PLACEHOLDER.test(credentialsOf(e.DATABASE_URL))) out.push(`DATABASE_URL: placeholder or development credentials not allowed in ${appEnv}`);
  if (isLocalHost) out.push(`DATABASE_URL: ${appEnv} must not use a local database host`);
  if (!db.tls) out.push(`DATABASE_URL: ${appEnv} requires sslmode=require, verify-ca or verify-full`);
  if (appEnv === "production" && e.SESSION_SECRET.length < 48) out.push("SESSION_SECRET: production requires at least 48 characters");
  if (new Set(e.SESSION_SECRET).size < 12) out.push("SESSION_SECRET: too little variety to be a random secret");
  return out;
}

export function loadServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const r = schema.safeParse(source);
  if (!r.success) {
    // Report variable names and reasons only; never echo values (they may be secrets).
    const msg = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new EnvError(`Invalid environment: ${msg}`);
  }
  const data = r.data;
  // Production-like runs must say explicitly which environment they are; never guess.
  if (data.NODE_ENV === "production" && !data.APP_ENV) {
    throw new EnvError("Invalid environment: APP_ENV: required (staging or production) when NODE_ENV=production");
  }
  const appEnv: AppEnv = data.APP_ENV ?? "local";
  const problems = isolationProblems(data, appEnv);
  if (problems.length) throw new EnvError(`Invalid environment: ${problems.join("; ")}`);
  return { ...data, APP_ENV: appEnv };
}

/** A copy that is safe to log: server-only values are replaced, never partially shown. */
export function redactEnv(env: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(env)) {
    out[k] = (SERVER_ONLY_VARS as readonly string[]).includes(k) || /SECRET|PASSWORD|TOKEN|KEY/i.test(k) ? "[REDACTED]" : v;
  }
  return out;
}

const fingerprint = (s: string) => createHash("sha256").update(s).digest("hex");

/** Deployment check: two environments (e.g. staging and production) must not share secrets. */
export function sharedSecretNames(a: Record<string, string | undefined>, b: Record<string, string | undefined>): string[] {
  return SERVER_ONLY_VARS.filter((k) => a[k] && b[k] && fingerprint(a[k]!) === fingerprint(b[k]!));
}

/** Mock public API needs no database, identity provider or secret. Refused in production. */
const mockSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4010),
});

export function loadMockEnv(source: Record<string, string | undefined>) {
  const r = mockSchema.safeParse(source);
  if (!r.success) throw new EnvError(`Invalid environment: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  if (r.data.NODE_ENV === "production") throw new EnvError("The synthetic mock API must never run with NODE_ENV=production");
  return r.data;
}
