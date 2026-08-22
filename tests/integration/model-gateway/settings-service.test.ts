import {
  createModelGatewaySettingsService,
  ModelGatewayAccessError,
  type ModelGatewayConfigRecord,
  type ModelGatewaySettingsRepository,
  type ModelGatewayVaultStore,
} from "@/server/model-gateway/settings-service";
import { createVaultSecretStore } from "@/server/model-gateway/vault-secret-store";
import { createModelGatewaySettingsRepository } from "@/server/repositories/model-gateway-settings-repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const ORIGIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONFIG_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function config(overrides: Partial<ModelGatewayConfigRecord> = {}): ModelGatewayConfigRecord {
  return {
    id: CONFIG_ID,
    userId: USER_A,
    displayName: "My Gateway",
    originId: null,
    canonicalOrigin: "https://gateway.example.com",
    basePath: "/v1",
    adapterKind: "openai-compatible",
    model: "model-a",
    revision: 1,
    configFingerprint: "a".repeat(64),
    state: "pending_consent",
    consentPolicyVersion: null,
    consentedBaseUrl: null,
    consentedAt: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

function harness() {
  const records = new Map([[CONFIG_ID, config()]]);
  const calls: string[] = [];
  const repository: ModelGatewaySettingsRepository = {
    listConfigs: async (userId) => [...records.values()].filter((item) => item.userId === userId),
    findConfig: async (userId, configId) => {
      const item = records.get(configId);
      return item?.userId === userId ? item : null;
    },
  };
  const vault: ModelGatewayVaultStore = {
    hasApiKey: async (userId, id) => {
      calls.push(`has:${userId}:${id}`);
      return records.get(id)?.state !== "revoked";
    },
    create: async (userId, input, id, now) => {
      calls.push(`create:${userId}:${input.baseUrl}:${input.apiKey.length}`);
      records.set(id, config({ id, userId, displayName: input.displayName, model: input.model, createdAt: now, updatedAt: now }));
    },
    activate: async (userId, input, now) => {
      calls.push(`activate:${userId}:${input.exactBaseUrl}:${input.policyVersion}`);
      const item = records.get(input.configId);
      if (!item || item.userId !== userId || item.state !== "pending_consent") return false;
      records.set(input.configId, config({ ...item, state: "active", consentPolicyVersion: input.policyVersion, consentedBaseUrl: input.exactBaseUrl, consentedAt: now, updatedAt: now }));
      return true;
    },
    rename: async (userId, input, now) => {
      calls.push(`rename:${userId}`);
      const item = records.get(input.configId);
      if (!item || item.userId !== userId || item.state === "revoked") return false;
      records.set(input.configId, config({ ...item, displayName: input.displayName, updatedAt: now }));
      return true;
    },
    rotate: async (userId, input) => {
      calls.push(`rotate:${userId}:${input.apiKey.length}`);
      const item = records.get(input.configId);
      return Boolean(item && item.userId === userId && item.state !== "revoked");
    },
    revoke: async (userId, id, now) => {
      calls.push(`revoke:${userId}:${id}`);
      const item = records.get(id);
      if (!item || item.userId !== userId) return false;
      records.set(id, config({ ...item, state: "revoked", consentPolicyVersion: null, consentedBaseUrl: null, consentedAt: null, updatedAt: now }));
      return true;
    },
  };
  const service = createModelGatewaySettingsService({
    repository,
    vault,
    now: () => "2026-08-20T01:00:00.000Z",
    configId: () => "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  });
  return { service, records, calls };
}

describe("model gateway settings service", () => {
  it("uses explicit owner filters and bounded deterministic settings queries under service role", async () => {
    const operations: string[] = [];
    const builder = {
      select(columns: string) { operations.push(`select:${columns.includes("user_id")}`); return this; },
      eq(column: string, value: string) { operations.push(`eq:${column}:${value}`); return this; },
      order(column: string, options: { ascending: boolean }) { operations.push(`order:${column}:${options.ascending}`); return this; },
      limit(value: number) { operations.push(`limit:${value}`); return this; },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) { return Promise.resolve(resolve({ data: [], error: null })); },
    };
    const client = { from: (table: string) => { operations.push(`from:${table}`); return builder; } } as unknown as SupabaseClient<Database>;
    const repository = createModelGatewaySettingsRepository(client);

    await repository.listConfigs(USER_A);
    await repository.findConfig(USER_A, CONFIG_ID);

    expect(operations).toContain(`eq:user_id:${USER_A}`);
    expect(operations).toContain(`eq:id:${CONFIG_ID}`);
    expect(operations).toContain("order:created_at:false");
    expect(operations).toContain("limit:20");
  });

  it("fails closed when a service-role config list contains a different owner", async () => {
    const wrongOwnerRow = {
      id: CONFIG_ID,
      user_id: USER_B,
      display_name: "Cross-owner Gateway",
      origin_id: ORIGIN_ID,
      canonical_origin: null,
      base_path: null,
      adapter_kind: "openai-compatible",
      model: "model-a",
      revision: 1,
      config_fingerprint: "a".repeat(64),
      state: "pending_consent",
      consent_policy_version: null,
      consented_origin: null,
      consented_at: null,
      revoked_at: null,
      created_at: "2026-08-20T00:00:00.000Z",
      updated_at: "2026-08-20T00:00:00.000Z",
      model_gateway_origins: {
        id: ORIGIN_ID,
        slug: "approved-gateway",
        display_name: "Approved Gateway",
        canonical_origin: "https://gateway.example.com",
        adapter_kind: "openai-compatible",
        state: "active",
        base_path: "/v1",
        created_at: "2026-08-20T00:00:00.000Z",
        updated_at: "2026-08-20T00:00:00.000Z",
      },
    };
    const operations: string[] = [];
    const builder = {
      select() { return this; },
      eq(column: string, value: string) { operations.push(`eq:${column}:${value}`); return this; },
      order() { return this; },
      limit(value: number) { operations.push(`limit:${value}`); return this; },
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        return Promise.resolve(resolve({ data: [wrongOwnerRow], error: null }));
      },
    };
    const client = {
      from: (table: string) => {
        operations.push(`from:${table}`);
        return builder;
      },
    } as unknown as SupabaseClient<Database>;

    const repository = createModelGatewaySettingsRepository(client);

    await expect(repository.listConfigs(USER_A)).rejects.toThrow(
      "model gateway settings unavailable",
    );
    expect(operations).toContain(`eq:user_id:${USER_A}`);
    expect(operations).toContain("limit:20");
  });

  it("left-normalizes legacy catalog and direct URL rows without dropping either representation", async () => {
    const common = {
      user_id: USER_A,
      display_name: "Gateway",
      adapter_kind: "openai-compatible",
      model: "model-a",
      revision: 1,
      config_fingerprint: "a".repeat(64),
      state: "pending_consent",
      consent_policy_version: null,
      consented_origin: null,
      consented_at: null,
      revoked_at: null,
      created_at: "2026-08-20T00:00:00.000Z",
      updated_at: "2026-08-20T00:00:00.000Z",
    };
    const rows = [{
      ...common,
      id: CONFIG_ID,
      origin_id: ORIGIN_ID,
      canonical_origin: null,
      base_path: null,
      model_gateway_origins: {
        id: ORIGIN_ID,
        slug: "legacy",
        display_name: "Legacy",
        canonical_origin: "https://legacy.example.com",
        base_path: "/v1",
        adapter_kind: "openai-compatible",
        state: "active",
        created_at: common.created_at,
        updated_at: common.updated_at,
      },
    }, {
      ...common,
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      revision: 2,
      origin_id: null,
      canonical_origin: "https://direct.example.com",
      base_path: "/compatible/v1",
      model_gateway_origins: null,
    }];
    let selected = "";
    const builder = {
      select(columns: string) { selected = columns; return this; },
      eq() { return this; },
      order() { return this; },
      limit() { return this; },
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
    const repository = createModelGatewaySettingsRepository({
      from: () => builder,
    } as unknown as SupabaseClient<Database>);

    await expect(repository.listConfigs(USER_A)).resolves.toMatchObject([
      { canonicalOrigin: "https://legacy.example.com", basePath: "/v1" },
      { canonicalOrigin: "https://direct.example.com", basePath: "/compatible/v1" },
    ]);
    expect(selected).not.toContain("!inner");
  });

  it("checks credential presence with the boolean RPC and never invokes the secret resolver", async () => {
    const calls: string[] = [];
    const client = {
      rpc: async (name: string) => {
        calls.push(name);
        return { data: true, error: null };
      },
    } as unknown as SupabaseClient<Database>;

    await expect(createVaultSecretStore(client).hasApiKey(USER_A, CONFIG_ID)).resolves.toBe(true);
    expect(calls).toEqual(["has_user_model_gateway_secret"]);
    expect(calls).not.toContain("resolve_user_model_gateway_config");
  });

  it("splits the validated base URL into the direct create RPC without sending a catalog id", async () => {
    const calls: Array<[string, unknown]> = [];
    const client = {
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args]);
        return { data: [{ config_id: CONFIG_ID, revision: 1, state: "pending_consent" }], error: null };
      },
    } as unknown as SupabaseClient<Database>;

    await createVaultSecretStore(client).create(USER_A, {
      displayName: "Direct",
      baseUrl: "https://gateway.example.com/compatible/v1",
      model: "model-a",
      apiKey: "write-only-value",
    }, CONFIG_ID, "2026-08-20T00:00:00.000Z");

    expect(calls).toEqual([["create_user_model_gateway_config", {
      p_user_id: USER_A,
      p_config_id: CONFIG_ID,
      p_canonical_origin: "https://gateway.example.com",
      p_base_path: "/compatible/v1",
      p_display_name: "Direct",
      p_model: "model-a",
      p_api_key: "write-only-value",
      p_now: "2026-08-20T00:00:00.000Z",
    }]]);
  });

  it("lists only owner records and derives credential presence through the boolean port", async () => {
    const { service, records, calls } = harness();
    records.set("dddddddd-dddd-4ddd-8ddd-dddddddddddd", config({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", userId: USER_B }));

    const result = await service.read(USER_A);

    expect(result.configs).toHaveLength(1);
    expect(result.configs[0]).toMatchObject({ id: CONFIG_ID, hasApiKey: true });
    expect(JSON.stringify(result)).not.toContain(USER_A);
    expect(calls).toEqual([`has:${USER_A}:${CONFIG_ID}`]);
  });

  it("creates a pending config without a Provider dependency or secret echo", async () => {
    const { service, calls } = harness();
    const result = await service.create(USER_A, {
      displayName: "Second Gateway",
      baseUrl: "https://gateway.example.com/v1",
      model: "model-b",
      apiKey: "write-only-value",
    });

    expect(result).toMatchObject({ state: "pending_consent", hasApiKey: true, displayName: "Second Gateway" });
    expect(JSON.stringify(result)).not.toContain("write-only-value");
    expect(calls).toContain(`create:${USER_A}:https://gateway.example.com/v1:16`);
  });

  it("activates only exact owner, exact base URL, and frozen policy consent", async () => {
    const { service } = harness();
    const active = await service.activate(USER_A, {
      configId: CONFIG_ID,
      exactBaseUrl: "https://gateway.example.com/v1",
      policyVersion: "model-egress-v1",
      confirmed: true,
    });
    expect(active).toMatchObject({ state: "active", consent: { exactBaseUrl: "https://gateway.example.com/v1", policyVersion: "model-egress-v1" } });

    await expect(service.activate(USER_B, {
      configId: CONFIG_ID,
      exactBaseUrl: "https://gateway.example.com/v1",
      policyVersion: "model-egress-v1",
      confirmed: true,
    })).rejects.toBeInstanceOf(ModelGatewayAccessError);
  });

  it("renames without changing semantic revision and rotates write-only credentials", async () => {
    const { service, calls } = harness();
    const renamed = await service.rename(USER_A, { configId: CONFIG_ID, displayName: "Renamed" });
    expect(renamed).toMatchObject({ displayName: "Renamed", revision: 1, configFingerprint: "a".repeat(64) });

    const rotated = await service.rotate(USER_A, { configId: CONFIG_ID, apiKey: "replacement-value" });
    expect(rotated.hasApiKey).toBe(true);
    expect(JSON.stringify(rotated)).not.toContain("replacement-value");
    expect(calls).toContain(`rotate:${USER_A}:17`);
  });

  it("rejects wrong-owner and revoked rename/rotation", async () => {
    const { service, records } = harness();
    await expect(service.rename(USER_B, { configId: CONFIG_ID, displayName: "Stolen" })).rejects.toBeInstanceOf(ModelGatewayAccessError);
    records.set(CONFIG_ID, config({ state: "revoked" }));
    await expect(service.rotate(USER_A, { configId: CONFIG_ID, apiKey: "replacement" })).rejects.toBeInstanceOf(ModelGatewayAccessError);
  });

  it("revokes pending/active/missing-secret configs and permits idempotent replay", async () => {
    const { service, records } = harness();
    expect((await service.revoke(USER_A, { configId: CONFIG_ID })).state).toBe("revoked");
    expect((await service.revoke(USER_A, { configId: CONFIG_ID })).state).toBe("revoked");
    records.set(CONFIG_ID, config({ state: "active", consentPolicyVersion: "model-egress-v1", consentedBaseUrl: "https://gateway.example.com/v1", consentedAt: "2026-08-20T00:30:00.000Z" }));
    expect((await service.revoke(USER_A, { configId: CONFIG_ID })).state).toBe("revoked");
  });
});
