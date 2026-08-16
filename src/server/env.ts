import { z } from "zod";

export const ServerEnvSchema = z.strictObject({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPADATA_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
  APP_URL: z.string().url(),
  EXTENSION_REDIRECT_ORIGIN: z
    .string()
    .regex(/^chrome-extension:\/\/[a-p]{32}$/, "Expected an exact Chrome extension origin"),
  INTERNAL_JOB_SECRET: z.string().min(1),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function parseServerEnv(input: unknown): ServerEnv {
  return ServerEnvSchema.parse(input);
}

export function getServerEnv(
  environment: Record<string, string | undefined> = process.env,
): ServerEnv {
  return parseServerEnv({
    NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: environment.SUPABASE_SERVICE_ROLE_KEY,
    SUPADATA_API_KEY: environment.SUPADATA_API_KEY,
    OPENAI_API_KEY: environment.OPENAI_API_KEY,
    OPENAI_MODEL: environment.OPENAI_MODEL,
    APP_URL: environment.APP_URL,
    EXTENSION_REDIRECT_ORIGIN: environment.EXTENSION_REDIRECT_ORIGIN,
    INTERNAL_JOB_SECRET: environment.INTERNAL_JOB_SECRET,
  });
}
