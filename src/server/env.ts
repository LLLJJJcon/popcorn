import { z } from "zod";

export const ServerEnvSchema = z.strictObject({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPADATA_API_KEY: z.string().min(1),
  APP_URL: z.string().url(),
  INTERNAL_JOB_SECRET: z.string().min(1),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export const ModelGatewaySettingsEnvSchema = ServerEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  SUPABASE_SERVICE_ROLE_KEY: true,
  APP_URL: true,
});

export type ModelGatewaySettingsEnv = z.infer<typeof ModelGatewaySettingsEnvSchema>;

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
    APP_URL: environment.APP_URL,
    INTERNAL_JOB_SECRET: environment.INTERNAL_JOB_SECRET,
  });
}

export function parseModelGatewaySettingsEnv(input: unknown): ModelGatewaySettingsEnv {
  return ModelGatewaySettingsEnvSchema.parse(input);
}

export function getModelGatewaySettingsEnv(
  environment: Record<string, string | undefined> = process.env,
): ModelGatewaySettingsEnv {
  return parseModelGatewaySettingsEnv({
    NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: environment.SUPABASE_SERVICE_ROLE_KEY,
    APP_URL: environment.APP_URL,
  });
}
