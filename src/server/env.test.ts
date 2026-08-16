import { getServerEnv, parseServerEnv } from "./env";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPADATA_API_KEY: "supadata-key",
  OPENAI_API_KEY: "openai-key",
  OPENAI_MODEL: "gpt-5-mini",
  APP_URL: "https://popcorn.example",
  EXTENSION_REDIRECT_ORIGIN: "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
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

  it("rejects origins that are not exact Chrome extension IDs", () => {
    expect(() =>
      parseServerEnv({
        ...validEnvironment,
        EXTENSION_REDIRECT_ORIGIN: "chrome-extension://abcdefghijklmnop",
      }),
    ).toThrow();
  });
});
