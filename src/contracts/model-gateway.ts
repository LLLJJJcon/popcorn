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
    /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
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

export const ModelGatewayBaseUrlSchema = z
  .string()
  .max(453)
  .superRefine((value, context) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      context.addIssue({ code: "custom", message: "Expected an exact public HTTPS gateway base URL" });
      return;
    }
    const canonicalOrigin = CanonicalModelGatewayOriginSchema.safeParse(parsed.origin);
    const basePath = parsed.pathname === "/" ? "" : parsed.pathname;
    if (
      !canonicalOrigin.success ||
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.port !== "" ||
      parsed.search !== "" ||
      parsed.hash !== "" ||
      basePath.length > 200 ||
      (basePath !== "" && !/^\/(?:[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)$/.test(basePath)) ||
      value !== `${parsed.origin}${basePath}`
    ) {
      context.addIssue({ code: "custom", message: "Expected an exact public HTTPS gateway base URL" });
    }
  });

export const ModelGatewayOriginViewSchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  displayName: TrimmedStringSchema.max(100),
  canonicalOrigin: CanonicalModelGatewayOriginSchema,
  adapterKind: ModelGatewayAdapterKindSchema,
});

export const ModelGatewayCreateInputSchema = z.strictObject({
  displayName: TrimmedStringSchema.max(80),
  baseUrl: ModelGatewayBaseUrlSchema,
  model: TrimmedStringSchema.max(100),
  apiKey: TrimmedStringSchema.max(4_096),
});

export const ModelGatewayConsentInputSchema = z.strictObject({
  configId: z.string().uuid(),
  exactBaseUrl: ModelGatewayBaseUrlSchema,
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
  exactBaseUrl: ModelGatewayBaseUrlSchema,
  policyVersion: ModelGatewayConsentPolicyVersionSchema,
  consentedAt: IsoDateTimeSchema,
});

export const ModelGatewayConfigViewSchema = z.strictObject({
  id: z.string().uuid(),
  displayName: TrimmedStringSchema.max(80),
  baseUrl: ModelGatewayBaseUrlSchema,
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
  configs: z.array(ModelGatewayConfigViewSchema).max(20),
});

export type ModelGatewayCreateInput = z.infer<typeof ModelGatewayCreateInputSchema>;
export type ModelGatewayConsentInput = z.infer<typeof ModelGatewayConsentInputSchema>;
export type ModelGatewayRotateKeyInput = z.infer<typeof ModelGatewayRotateKeyInputSchema>;
export type ModelGatewayRenameInput = z.infer<typeof ModelGatewayRenameInputSchema>;
export type ModelGatewayRevokeInput = z.infer<typeof ModelGatewayRevokeInputSchema>;
export type ModelGatewayConfigView = z.infer<typeof ModelGatewayConfigViewSchema>;
export type ModelGatewaySettingsView = z.infer<typeof ModelGatewaySettingsViewSchema>;
