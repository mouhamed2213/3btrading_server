import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET doit faire au moins 32 caractères"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  TAX_RATE: z.coerce.number().int().min(0).max(100).default(18),
  S3_REGION: z.string(),
  S3_ENDPOINT: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  SEAWEEDFS_BUCKET: z.string(),

  // SUPABASE_URL: z.string().optional(),
  // SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // SUPABASE_BUCKET: z.string().default("3b-trading"),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
