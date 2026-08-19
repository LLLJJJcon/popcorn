import {
  createModelGatewaySettingsService,
  ModelGatewayAccessError,
  type ModelGatewayConfigRecord,
  type ModelGatewayOriginRecord,
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

const origin: ModelGatewayOriginRecord = {
  id: ORIGIN_ID,
  slug: "approved-gateway",
  displayName: "Approved Gateway",
  canonicalOrigin: "https://gateway.example.com",
  adapterKind: "openai-compatible",
  state: "active",
};

function config(overrides: Partial<ModelGatewayConfigRecord> = {}): ModelGatewayConfigRecord {
  return {
    id: CONFIG_ID,
    userId: USER_A,
    displayName: "My Gateway",
    originId: ORIGIN_ID,
    origin,
    adapterKind: "openai-compatible",
    model: "model-a",
    revision: 1,
    configFingerprint: "a".repeat(64),
    state: "pending_consent",
    consentPolicyVersion: null,
    consentedOrigin: null,
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
    listOrigins: async () => [origin],
    findOrigin: async (id) => id === ORIGIN_ID ? origin : null,
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
      calls.push(`create:${userId}:${input.originId}:${input.apiKey.length}`);
      records.set(id, config({ id, userId, displayName: input.displayName, model: input.model, createdAt: now, updatedAt: now }));
    },
    activate: async (userId, input, now) => {
      calls.push(`activate:${userId}:${input.exactOrigin}:${input.policyVersion}`);
      const item = records.get(input.configId);
      if (!item || item.userId !== userId || item.state !== "pending_consent") return false;
      records.set(input.configId, config({ ...item, state: "active", consentPolicyVersion: input.policyVersion, consentedOrigin: input.exactOrigin, consentedAt: now, updatedAt: now }));
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
      records.set(id, config({ ...item, state: "revoked", consentPolicyVersion: null, consentedOrigin: null, consentedAt: null, updatedAt: now }));
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

    await repository.listOrigins();
    await repository.listConfigs(USER_A);
    await repository.findConfig(USER_A, CONFIG_ID);

    expect(operations).toContain("eq:state:active");
    expect(operations).toContain(`eq:user_id:${USER_A}`);
    expect(operations).toContain(`eq:id:${CONFIG_ID}`);
    expect(operations).toContain("order:display_name:true");
    expect(operations).toContain("order:created_at:false");
    expect(operations).toContain("limit:50");
    expect(operations).toContain("limit:20");
  });

  it("fails closed when a service-role config list contains a different owner", async () => {
    const wrongOwnerRow = {
      id: CONFIG_ID,
      user_id: USER_B,
      display_name: "Cross-owner Gateway",
      origin_id: ORIGIN_ID,
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
        slug: origin.slug,
        display_name: origin.displayName,
        canonical_origin: origin.canonicalOrigin,
        adapter_kind: origin.adapterKind,
        state: origin.state,
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
      originId: ORIGIN_ID,
      displayName: "Second Gateway",
      model: "model-b",
      apiKey: "write-only-value",
    });

    expect(result).toMatchObject({ state: "pending_consent", hasApiKey: true, displayName: "Second Gateway" });
    expect(JSON.stringify(result)).not.toContain("write-only-value");
    expect(calls).toContain(`create:${USER_A}:${ORIGIN_ID}:16`);
  });

  it("activates only exact owner, exact origin, and frozen policy consent", async () => {
    const { service } = harness();
    const active = await service.activate(USER_A, {
      configId: CONFIG_ID,
      exactOrigin: origin.canonicalOrigin,
      policyVersion: "model-egress-v1",
      confirmed: true,
    });
    expect(active).toMatchObject({ state: "active", consent: { exactOrigin: origin.canonicalOrigin, policyVersion: "model-egress-v1" } });

    await expect(service.activate(USER_B, {
      configId: CONFIG_ID,
      exactOrigin: origin.canonicalOrigin,
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
    records.set(CONFIG_ID, config({ state: "active", consentPolicyVersion: "model-egress-v1", consentedOrigin: origin.canonicalOrigin, consentedAt: "2026-08-20T00:30:00.000Z" }));
    expect((await service.revoke(USER_A, { configId: CONFIG_ID })).state).toBe("revoked");
  });
});
