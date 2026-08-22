import {
  createModelGatewayHttpHandlers,
  type ModelGatewaySettingsService,
} from "@/server/model-gateway/settings-service";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => undefined,
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({}),
}));

const USER = "11111111-1111-4111-8111-111111111111";
const CONFIG_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const publicConfig = {
  id: CONFIG_ID,
  displayName: "Gateway",
  baseUrl: "https://gateway.example.com/v1",
  model: "model-a",
  revision: 1,
  configFingerprint: "a".repeat(64),
  state: "pending_consent" as const,
  consent: null,
  hasApiKey: true,
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

function harness(auth: "valid" | "missing" | "expired" = "valid", failCreate = false) {
  const calls: string[] = [];
  const service: ModelGatewaySettingsService = {
    read: async (userId) => { calls.push(`read:${userId}`); return { configs: [publicConfig] }; },
    create: async (userId, input) => {
      if (failCreate) throw new Error("db raw vault=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee service-role-secret supplied-key");
      calls.push(`create:${userId}:${input.apiKey.length}`);
      return publicConfig;
    },
    activate: async (userId) => { calls.push(`activate:${userId}`); return { ...publicConfig, state: "active" as const, consent: { exactBaseUrl: publicConfig.baseUrl, policyVersion: "model-egress-v1" as const, consentedAt: publicConfig.updatedAt } }; },
    rename: async (userId) => { calls.push(`rename:${userId}`); return { ...publicConfig, displayName: "Renamed" }; },
    rotate: async (userId, input) => { calls.push(`rotate:${userId}:${input.apiKey.length}`); return publicConfig; },
    revoke: async (userId) => { calls.push(`revoke:${userId}`); return { ...publicConfig, state: "revoked" as const, hasApiKey: false }; },
  };
  const handlers = createModelGatewayHttpHandlers({
    authenticate: async () => auth === "valid" ? { ok: true, userId: USER } : { ok: false, reason: auth },
    service,
    appUrl: "https://popcorn.example/app/path",
    requestId: () => "request-safe",
  });
  return { handlers, calls };
}

async function body(response: Response) { return await response.json() as Record<string, unknown>; }
function request(method: string, value?: unknown, headers: HeadersInit = {}) {
  return new Request("https://popcorn.example/api/v1/settings/model-gateway", {
    method,
    headers: { ...(value === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
}

describe("model gateway settings HTTP handlers", () => {
  it.each(["missing", "expired"] as const)("maps %s session and always disables storage", async (auth) => {
    const { handlers, calls } = harness(auth);
    const response = await handlers.get(request("GET", undefined, { Authorization: "Bearer ignored" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await body(response)).toMatchObject({ ok: false, error: { code: auth === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED" }, requestId: "request-safe" });
    expect(calls).toEqual([]);
  });

  it.each([undefined, "not a url", "https://evil.example", "https://popcorn.example:444", "https://popcorn.example.evil.test", "https://popcorn.example/path"])("rejects inexact mutation origin %s before parsing or service", async (origin) => {
    const { handlers, calls } = harness();
    const headers: HeadersInit = origin === undefined ? {} : { Origin: origin };
    const response = await handlers.put(request("PUT", { apiKey: "sensitive" }, headers));
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(calls).toEqual([]);
    expect(JSON.stringify(await body(response))).not.toContain("sensitive");
  });

  it("returns the bounded public settings view with no-store", async () => {
    const { handlers } = harness();
    const response = await handlers.get(request("GET"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await body(response)).toMatchObject({ ok: true, data: { configs: [{ hasApiKey: true }] }, requestId: "request-safe" });
  });

  it.each([
    { baseUrl: "https://gateway.example.com/v1", displayName: "Gateway", model: "m", apiKey: "k", userId: USER },
    { baseUrl: "https://gateway.example.com/v1", displayName: "Gateway", model: "m", apiKey: "k", canonicalOrigin: "https://evil.example" },
    { configId: CONFIG_ID, apiKey: "k", displayName: "ambiguous" },
    { configId: CONFIG_ID, displayName: "Renamed", nested: {} },
  ])("rejects unknown, extra, or ambiguous PUT bodies", async (input) => {
    const { handlers, calls } = harness();
    const response = await handlers.put(request("PUT", input, { Origin: "https://popcorn.example" }));
    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("rejects an oversized body without passing it to the service", async () => {
    const { handlers, calls } = harness();
    const response = await handlers.put(new Request("https://popcorn.example/api/v1/settings/model-gateway", {
      method: "PUT",
      headers: { Origin: "https://popcorn.example", "Content-Type": "application/json", "Content-Length": "9000" },
      body: JSON.stringify({ apiKey: "x".repeat(9000) }),
    }));
    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("creates, renames, and rotates through unambiguous frozen DTOs without echoing keys", async () => {
    const { handlers, calls } = harness();
    const createResponse = await handlers.put(request("PUT", { baseUrl: "https://gateway.example.com/v1", displayName: "Gateway", model: "model-a", apiKey: "create-secret" }, { Origin: "https://popcorn.example" }));
    const renameResponse = await handlers.put(request("PUT", { configId: CONFIG_ID, displayName: "Renamed" }, { Origin: "https://popcorn.example" }));
    const rotateResponse = await handlers.put(request("PUT", { configId: CONFIG_ID, apiKey: "rotate-secret" }, { Origin: "https://popcorn.example" }));
    expect(createResponse.status).toBe(201);
    expect(renameResponse.status).toBe(200);
    expect(rotateResponse.status).toBe(200);
    expect(calls).toEqual([`create:${USER}:13`, `rename:${USER}`, `rotate:${USER}:13`]);
    expect(JSON.stringify([await body(createResponse), await body(rotateResponse)])).not.toMatch(/create-secret|rotate-secret/);
  });

  it("activates exact consent and revokes using strict frozen DTOs", async () => {
    const { handlers, calls } = harness();
    const consent = await handlers.consent(request("POST", { configId: CONFIG_ID, exactBaseUrl: "https://gateway.example.com/v1", policyVersion: "model-egress-v1", confirmed: true }, { Origin: "https://popcorn.example" }));
    const revoke = await handlers.delete(request("DELETE", { configId: CONFIG_ID }, { Origin: "https://popcorn.example" }));
    expect(consent.status).toBe(200);
    expect(revoke.status).toBe(200);
    expect(calls).toEqual([`activate:${USER}`, `revoke:${USER}`]);
  });

  it("sanitizes persistence failures and never leaks key, Vault ID, service key, or raw error", async () => {
    const { handlers } = harness("valid", true);
    const response = await handlers.put(request("PUT", { baseUrl: "https://gateway.example.com/v1", displayName: "Gateway", model: "m", apiKey: "supplied-key" }, { Origin: "https://popcorn.example" }));
    const serialized = JSON.stringify(await body(response)) + JSON.stringify([...response.headers]);
    expect(response.status).toBe(500);
    expect(serialized).not.toMatch(/supplied-key|service-role-secret|eeeeeeee|db raw|vault/i);
  });
});

describe("production model gateway settings routes", () => {
  const settingsEnvironment = {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    APP_URL: "https://popcorn.example",
  };
  const legacyKeys = [
    "SUPADATA_API_KEY",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "EXTENSION_REDIRECT_ORIGIN",
    "INTERNAL_JOB_SECRET",
  ] as const;
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    for (const key of legacyKeys) delete process.env[key];
    Object.assign(process.env, settingsEnvironment);
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnvironment);
    vi.resetModules();
  });

  it("initializes both production routes with only the four scoped settings variables", async () => {
    const settingsRoute = await import("@/app/api/v1/settings/model-gateway/route");
    const consentRoute = await import("@/app/api/v1/settings/model-gateway/consent/route");

    const settingsResponse = await settingsRoute.GET(
      request("GET", undefined, { Authorization: "Bearer ignored" }),
    );
    const consentResponse = await consentRoute.POST(
      request("POST", undefined, { Authorization: "Bearer ignored" }),
    );

    expect(settingsResponse.status).toBe(401);
    expect(consentResponse.status).toBe(401);
    expect(settingsResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(consentResponse.headers.get("Cache-Control")).toBe("no-store");
  });

  it("fails closed when a required scoped settings dependency is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const settingsRoute = await import("@/app/api/v1/settings/model-gateway/route");

    await expect(
      settingsRoute.GET(request("GET")),
    ).rejects.toThrow();
  });
});
