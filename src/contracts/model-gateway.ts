import { z } from "zod";

const TrimmedStringSchema = z
  .string()
  .min(1)
  .refine((value) => value === value.trim(), "Expected no surrounding whitespace");
const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const ModelGatewayAdapterKindSchema = z.literal("openai-compatible");
export const ModelGatewayConsentPolicyVersionSchema = z.literal("model-egress-v1");
export const ModelGatewayConfigStateSchema = z.enum([
  "pending_consent",
  "active",
  "revoked",
]);

export const CanonicalModelGatewayOriginSchema = z
  .string()
  .max(253)
  .regex(
    /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    "Expected an exact lowercase HTTPS domain origin without port, path, query, or fragment",
  )
  .refine((value) => {
    try {
      const hostname = new URL(value).hostname;
      return (
        !/^\d+(?:\.\d+){3}$/.test(hostname) &&
        hostname !== "localhost" &&
        !hostname.endsWith(".localhost") &&
        hostname !== "local" &&
        !hostname.endsWith(".local") &&
        hostname !== "internal" &&
        !hostname.endsWith(".internal") &&
        hostname !== "metadata" &&
        !hostname.startsWith("metadata.")
      );
    } catch {
      return false;
    }
  }, "Expected a public DNS gateway origin, not an IP, local, internal, or metadata target");

export const ModelGatewayOriginViewSchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  displayName: TrimmedStringSchema.max(100),
  canonicalOrigin: CanonicalModelGatewayOriginSchema,
  adapterKind: ModelGatewayAdapterKindSchema,
});

export const ModelGatewayCreateInputSchema = z.strictObject({
  originId: z.string().uuid(),
  displayName: TrimmedStringSchema.max(80),
  model: TrimmedStringSchema.max(100),
  apiKey: TrimmedStringSchema.max(4_096),
});

export const ModelGatewayConsentInputSchema = z.strictObject({
  configId: z.string().uuid(),
  exactOrigin: CanonicalModelGatewayOriginSchema,
  policyVersion: ModelGatewayConsentPolicyVersionSchema,
  confirmed: z.literal(true),
});

export const ModelGatewayRotateKeyInputSchema = z.strictObject({
  configId: z.string().uuid(),
  apiKey: TrimmedStringSchema.max(4_096),
});

export const ModelGatewayRenameInputSchema = z.strictObject({
  configId: z.string().uuid(),
  displayName: TrimmedStringSchema.max(80),
});

export const ModelGatewayRevokeInputSchema = z.strictObject({
  configId: z.string().uuid(),
});

export const ModelGatewayConsentViewSchema = z.strictObject({
  exactOrigin: CanonicalModelGatewayOriginSchema,
  policyVersion: ModelGatewayConsentPolicyVersionSchema,
  consentedAt: IsoDateTimeSchema,
});

export const ModelGatewayConfigViewSchema = z.strictObject({
  id: z.string().uuid(),
  displayName: TrimmedStringSchema.max(80),
  origin: ModelGatewayOriginViewSchema,
  model: TrimmedStringSchema.max(100),
  revision: z.number().int().positive(),
  configFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  state: ModelGatewayConfigStateSchema,
  consent: ModelGatewayConsentViewSchema.nullable(),
  hasApiKey: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ModelGatewaySettingsViewSchema = z.strictObject({
  origins: z.array(ModelGatewayOriginViewSchema).max(50),
  configs: z.array(ModelGatewayConfigViewSchema).max(20),
});

export type ModelGatewayCreateInput = z.infer<typeof ModelGatewayCreateInputSchema>;
export type ModelGatewayConsentInput = z.infer<typeof ModelGatewayConsentInputSchema>;
export type ModelGatewayRotateKeyInput = z.infer<typeof ModelGatewayRotateKeyInputSchema>;
export type ModelGatewayRenameInput = z.infer<typeof ModelGatewayRenameInputSchema>;
export type ModelGatewayRevokeInput = z.infer<typeof ModelGatewayRevokeInputSchema>;
export type ModelGatewayConfigView = z.infer<typeof ModelGatewayConfigViewSchema>;
export type ModelGatewaySettingsView = z.infer<typeof ModelGatewaySettingsViewSchema>;
