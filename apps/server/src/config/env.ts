import { z } from "zod";

export const envSchema = z.object({
  PORT: z
    .string()
    .optional()
    .default("4000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(65535)),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  API_PREFIX: z.string().default("/api/v1"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  SUPABASE_URL: z
    .string()
    .trim()
    .url("SUPABASE_URL must be a valid URL")
    .optional()
    .or(z.literal("")),
  SUPABASE_ANON_KEY: z.string().trim().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().optional().or(z.literal("")),
});

export type RawEnv = z.input<typeof envSchema>;
export type ValidatedEnv = z.output<typeof envSchema>;

export function validateEnv(input: Record<string, unknown>): ValidatedEnv {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
