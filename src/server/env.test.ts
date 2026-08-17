import {
  assertExtensionRequestOrigin,
  deriveExtensionRequestOrigin,
  getServerEnv,
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
  OPENAI_API_KEY: "openai-key",
  OPENAI_MODEL: "gpt-5-mini",
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
