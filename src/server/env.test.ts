import {
  assertExtensionRequestOrigin,
  deriveExtensionRequestOrigin,
  getModelGatewaySettingsEnv,
  getServerEnv,
  parseModelGatewaySettingsEnv,
  parseServerEnv,
} from "./env";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const extensionRedirectOrigin = `https://${extensionId}.chromiumapp.org`;
const extensionRequestOrigin = `chrome-extension://${extensionId}`;

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPADATA_API_KEY: "supadata-key",
  APP_URL: "https://popcorn.example",
  EXTENSION_REDIRECT_ORIGIN: extensionRedirectOrigin,
  INTERNAL_JOB_SECRET: "job-secret",
};

describe("parseServerEnv", () => {
  it("accepts the fixed server environment", () => {
    expect(parseServerEnv(validEnvironment)).toEqual(validEnvironment);
  });

  it("requires every server-only value", () => {
    const incomplete: Record<string, string> = { ...validEnvironment };
    delete incomplete.SUPADATA_API_KEY;

    expect(() => parseServerEnv(incomplete)).toThrow();
  });

  it("does not accept deferred embedding configuration", () => {
    expect(() =>
      parseServerEnv({ ...validEnvironment, OPENAI_EMBEDDING_MODEL: "text-embedding-3-small" }),
    ).toThrow();
  });

  it("rejects the retired global model configuration", () => {
    expect(() =>
      parseServerEnv({ ...validEnvironment, OPENAI_API_KEY: "legacy-key" }),
    ).toThrow();
    expect(() =>
      parseServerEnv({ ...validEnvironment, OPENAI_MODEL: "legacy-model" }),
    ).toThrow();
  });

  it("selects only declared keys from a process environment", () => {
    expect(getServerEnv({ ...validEnvironment, PATH: "/usr/bin" })).toEqual(validEnvironment);
  });

  it.each([
    `chrome-extension://${extensionId}`,
    `https://${extensionId}.chromiumapp.com`,
    `https://subdomain.${extensionId}.chromiumapp.org`,
    `https://abcdefghijklmnop.chromiumapp.org`,
    "https://ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP.chromiumapp.org",
    `https://${extensionId}.chromiumapp.org/`,
    `https://${extensionId}.chromiumapp.org/supabase`,
    `https://${extensionId}.chromiumapp.org:443`,
    `https://${extensionId}.chromiumapp.org?state=123`,
    `https://${extensionId}.chromiumapp.org#callback`,
    `https://user:password@${extensionId}.chromiumapp.org`,
    "https://*.chromiumapp.org",
  ])("rejects an inexact Chrome Identity redirect origin: %s", (origin) => {
    expect(() =>
      parseServerEnv({ ...validEnvironment, EXTENSION_REDIRECT_ORIGIN: origin }),
    ).toThrow();
  });

  it("derives the trusted extension request origin from the redirect origin", () => {
    const environment = parseServerEnv(validEnvironment);

    expect(deriveExtensionRequestOrigin(environment.EXTENSION_REDIRECT_ORIGIN)).toBe(
      extensionRequestOrigin,
    );
  });

  it("rejects request origins that do not prove the configured extension identity", () => {
    const environment = parseServerEnv(validEnvironment);

    expect(() =>
      assertExtensionRequestOrigin(
        environment.EXTENSION_REDIRECT_ORIGIN,
        "chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba",
      ),
    ).toThrow();

    expect(() =>
      assertExtensionRequestOrigin(
        environment.EXTENSION_REDIRECT_ORIGIN,
        `${extensionRequestOrigin}/`,
      ),
    ).toThrow();

    expect(
      assertExtensionRequestOrigin(
        environment.EXTENSION_REDIRECT_ORIGIN,
        extensionRequestOrigin,
      ),
    ).toBe(extensionRequestOrigin);
  });
});

describe("parseModelGatewaySettingsEnv", () => {
  const settingsEnvironment = {
    NEXT_PUBLIC_SUPABASE_URL: validEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: validEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: validEnvironment.SUPABASE_SERVICE_ROLE_KEY,
    APP_URL: validEnvironment.APP_URL,
  };

  it("initializes gateway settings without legacy Provider or extension environment", () => {
    expect(parseModelGatewaySettingsEnv(settingsEnvironment)).toEqual(settingsEnvironment);
    expect(getModelGatewaySettingsEnv({ ...settingsEnvironment, PATH: "/usr/bin" })).toEqual(
      settingsEnvironment,
    );
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "APP_URL",
  ] as const)("still requires settings dependency %s", (key) => {
    const incomplete: Record<string, string> = { ...settingsEnvironment };
    delete incomplete[key];
    expect(() => parseModelGatewaySettingsEnv(incomplete)).toThrow();
  });

  it("rejects unrelated fields at the explicit parser boundary", () => {
    expect(() => parseModelGatewaySettingsEnv({ ...settingsEnvironment, OPENAI_API_KEY: "legacy" }))
      .toThrow();
  });
});
