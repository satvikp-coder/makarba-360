import { z } from "zod";

/** Server-only environment. Never import this from browser bundles. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
});

export type ServerEnv = z.infer<typeof schema>;

export class EnvError extends Error {}

export function loadServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const r = schema.safeParse(source);
  if (!r.success) {
    // Report variable names and reasons only; never echo values (they may be secrets).
    const msg = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new EnvError(`Invalid environment: ${msg}`);
  }
  return r.data;
}
