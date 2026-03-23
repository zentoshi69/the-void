import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgresql://void:void_dev@localhost:5432/the_void"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default("0.0.0.0"),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(8).default("change-me-in-production"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    console.error("Invalid environment variables:", formatted);
    throw new Error("Invalid environment configuration");
  }
  _env = result.data;
  return _env;
}
