import {
  ModelGatewayConfigViewSchema,
  ModelGatewayConsentInputSchema,
  ModelGatewayCreateInputSchema,
  ModelGatewayOriginViewSchema,
  ModelGatewayRotateKeyInputSchema,
} from "@/contracts";

const origin = {
  id: "10000000-0000-4000-8000-000000000008",
  slug: "approved-compatible",
  displayName: "Approved compatible gateway",
  canonicalOrigin: "https://models.example.com",
  adapterKind: "openai-compatible" as const,
};

describe("user model gateway contracts", () => {
  it("accepts only the closed adapter and an exact canonical HTTPS origin view", () => {
    expect(ModelGatewayOriginViewSchema.parse(origin)).toEqual(origin);

    expect(
      ModelGatewayOriginViewSchema.safeParse({ ...origin, adapterKind: "dynamic-plugin" }).success,
    ).toBe(false);
    expect(
      ModelGatewayOriginViewSchema.safeParse({
        ...origin,
        canonicalOrigin: "https://models.example.com/v1",
      }).success,
    ).toBe(false);
  });

  it("accepts a write-only key with catalog selection and no caller URL or adapter", () => {
    const input = {
      originId: origin.id,
      displayName: "My Mandarin model",
      model: "provider/model-v1",
      apiKey: "secret-value",
    };

    expect(ModelGatewayCreateInputSchema.parse(input)).toEqual(input);
    expect(
      ModelGatewayCreateInputSchema.safeParse({
        ...input,
        baseUrl: "https://attacker.invalid/v1",
      }).success,
    ).toBe(false);
    expect(
      ModelGatewayCreateInputSchema.safeParse({ ...input, apiKey: " secret-value " }).success,
    ).toBe(false);
  });

  it("binds consent to one config, exact origin, and policy version", () => {
    const consent = {
      configId: "20000000-0000-4000-8000-000000000008",
      exactOrigin: origin.canonicalOrigin,
      policyVersion: "model-egress-v1" as const,
      confirmed: true as const,
    };

    expect(ModelGatewayConsentInputSchema.parse(consent)).toEqual(consent);
    expect(
      ModelGatewayConsentInputSchema.safeParse({
        ...consent,
        exactOrigin: "https://models.example.com/",
      }).success,
    ).toBe(false);
    expect(
      ModelGatewayConsentInputSchema.safeParse({ ...consent, confirmed: false }).success,
    ).toBe(false);
  });

  it("returns metadata and hasApiKey without accepting secret fields in a view", () => {
    const view = {
      id: "20000000-0000-4000-8000-000000000008",
      displayName: "My Mandarin model",
      origin,
      model: "provider/model-v1",
      revision: 1,
      configFingerprint: "a".repeat(64),
      state: "active" as const,
      consent: {
        exactOrigin: origin.canonicalOrigin,
        policyVersion: "model-egress-v1" as const,
        consentedAt: "2026-08-19T10:00:00.000Z",
      },
      hasApiKey: true,
      createdAt: "2026-08-19T09:59:00.000Z",
      updatedAt: "2026-08-19T10:00:00.000Z",
    };

    expect(ModelGatewayConfigViewSchema.parse(view)).toEqual(view);
    expect(
      ModelGatewayConfigViewSchema.safeParse({ ...view, apiKey: "must-not-echo" }).success,
    ).toBe(false);
    expect(
      ModelGatewayConfigViewSchema.safeParse({ ...view, vaultSecretId: origin.id }).success,
    ).toBe(false);
  });

  it("keeps key rotation write-only and owner identity server-derived", () => {
    const input = {
      configId: "20000000-0000-4000-8000-000000000008",
      apiKey: "rotated-secret",
    };

    expect(ModelGatewayRotateKeyInputSchema.parse(input)).toEqual(input);
    expect(
      ModelGatewayRotateKeyInputSchema.safeParse({ ...input, userId: origin.id }).success,
    ).toBe(false);
  });
});
