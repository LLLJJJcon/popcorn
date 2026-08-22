import { z } from "zod";

const extensionRedirectOriginPattern = /^https:\/\/([a-p]{32})\.chromiumapp\.org$/;
const extensionRequestOriginPattern = /^chrome-extension:\/\/([a-p]{32})$/;

export const ExtensionRedirectOriginSchema = z
  .string()
  .refine(
    (value) => extensionRedirectOriginPattern.exec(value)?.[0] === value,
    "Expected an exact Chrome Identity redirect origin",
  )
  .brand<"ExtensionRedirectOrigin">();

export type ExtensionRedirectOrigin = z.infer<typeof ExtensionRedirectOriginSchema>;
export type ExtensionRequestOrigin = `chrome-extension://${string}`;

export const ServerEnvSchema = z.strictObject({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPADATA_API_KEY: z.string().min(1),
  APP_URL: z.string().url(),
  EXTENSION_REDIRECT_ORIGIN: ExtensionRedirectOriginSchema,
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

export function deriveExtensionRequestOrigin(
  redirectOrigin: ExtensionRedirectOrigin,
): ExtensionRequestOrigin {
  const match = extensionRedirectOriginPattern.exec(redirectOrigin);

  if (match?.[0] !== redirectOrigin) {
    throw new Error("Invalid Chrome Identity redirect origin");
  }

  return `chrome-extension://${match[1]}`;
}

export function assertExtensionRequestOrigin(
  redirectOrigin: ExtensionRedirectOrigin,
  requestOrigin: string,
): ExtensionRequestOrigin {
  const exactRequestOrigin = deriveExtensionRequestOrigin(redirectOrigin);
  const match = extensionRequestOriginPattern.exec(requestOrigin);

  if (match?.[0] !== requestOrigin || requestOrigin !== exactRequestOrigin) {
    throw new Error("Request origin does not match the configured Chrome extension identity");
  }

  return exactRequestOrigin;
}

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
    EXTENSION_REDIRECT_ORIGIN: environment.EXTENSION_REDIRECT_ORIGIN,
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
