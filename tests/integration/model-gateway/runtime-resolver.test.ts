import { describe, expect, test, vi } from "vitest";

import {
  ModelGatewayError,
  createLearningArtifactProviderResolver,
} from "@/server/ai/model-gateway";
import {
  createSupabaseModelGatewayRuntimeResolver,
  type ModelGatewayRuntimeConfig,
} from "@/server/model-gateway/runtime-resolver";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const CONFIG_ID = "60000000-0000-4000-8000-000000000001";
const FINGERPRINT = "a".repeat(64);
const SEGMENT_ID = "b".repeat(64);
const BULK_SEGMENT_IDS = ["a", "b", "c", "d", "e"].map((value) => value.repeat(64));

const pin = {
  configId: CONFIG_ID,
  revision: 3,
  fingerprint: FINGERPRINT,
};

const runtime: ModelGatewayRuntimeConfig = {
  adapterKind: "openai-compatible",
  canonicalOrigin: "https://models.example",
  basePath: "/v1",
  model: "mandarin-model",
  revision: 3,
  configFingerprint: FINGERPRINT,
  apiKey: "runtime-secret",
};

const evidence = {
  userId: USER_A,
  sourceId: "20000000-0000-4000-8000-000000000001",
  videoId: "abc123XYZ00",
  snapshotId: "40000000-0000-4000-8000-000000000001",
  transcriptHash: "c".repeat(64),
  title: "中文视频",
  segments: [{
    stableId: SEGMENT_ID,
    originalChinese: "这个表达很自然。",
    startSeconds: 0,
    endSeconds: 2,
  }],
};

const bulkEvidence = {
  ...evidence,
  segments: BULK_SEGMENT_IDS.map((stableId, index) => ({
    stableId,
    originalChinese: `第${index + 1}个句子。`,
    startSeconds: index,
    endSeconds: index + 1,
  })),
};

function completion(value: unknown): Response {
  return Response.json({
    choices: [{ message: { role: "assistant", content: JSON.stringify(value) } }],
  });
}

describe("owner-scoped model gateway runtime resolver", () => {
  test("resolves only the exact owner/config/revision and accepts the expected fingerprint", async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        adapter_kind: "openai-compatible",
        canonical_origin: "https://models.example",
        base_path: "/v1",
        model: "mandarin-model",
        revision: 3,
        config_fingerprint: FINGERPRINT,
        api_key: "runtime-secret",
        credential_revision: 9,
        display_name: "My gateway",
      }],
      error: null,
    }));
    const resolver = createSupabaseModelGatewayRuntimeResolver({ rpc } as never);

    await expect(resolver.resolve(USER_A, pin)).resolves.toEqual(runtime);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("resolve_user_model_gateway_config", {
      p_user_id: USER_A,
      p_config_id: CONFIG_ID,
      p_expected_revision: 3,
    });
  });

  test.each([
    ["wrong owner", USER_B, FINGERPRINT, []],
    ["wrong fingerprint", USER_A, "d".repeat(64), [{
      adapter_kind: "openai-compatible",
      canonical_origin: "https://models.example",
      base_path: "/v1",
      model: "mandarin-model",
      revision: 3,
      config_fingerprint: FINGERPRINT,
      api_key: "runtime-secret",
      credential_revision: 9,
      display_name: "My gateway",
    }]],
    ["unknown adapter", USER_A, FINGERPRINT, [{
      adapter_kind: "custom-proxy",
      canonical_origin: "https://models.example",
      base_path: "/v1",
      model: "mandarin-model",
      revision: 3,
      config_fingerprint: FINGERPRINT,
      api_key: "runtime-secret",
      credential_revision: 9,
      display_name: "My gateway",
    }]],
  ] as const)("fails closed for %s without exposing runtime material", async (_label, userId, fingerprint, rows) => {
    const rpc = vi.fn(async () => ({ data: rows, error: null }));
    const resolver = createSupabaseModelGatewayRuntimeResolver({ rpc } as never);
    const operation = resolver.resolve(userId, { ...pin, fingerprint });

    await expect(operation).rejects.toMatchObject({
      name: "ModelGatewayError",
      code: "PROVIDER_UNAVAILABLE",
      message: "PROVIDER_UNAVAILABLE",
    });
    await operation.catch((error: unknown) => {
      const message = String(error);
      expect(message).not.toContain("runtime-secret");
      expect(message).not.toContain("models.example");
    });
  });
});

describe("closed runtime provider registry", () => {
  test("CI fixture short-circuits before resolver construction, Vault/config RPC, and fetch", async () => {
    const createRuntimeResolver = vi.fn(() => {
      throw new Error("CI must not construct the runtime resolver");
    });
    const fetchImpl = vi.fn(async () => {
      throw new Error("CI must not fetch");
    });
    const resolver = createLearningArtifactProviderResolver({
      ci: true,
      createRuntimeResolver,
      fetchImpl,
    });

    const resolved = await resolver.resolve(USER_A, pin);
    await expect(resolved.provider.translateSegments(evidence, [SEGMENT_ID])).resolves.toEqual({
      segments: [{ id: SEGMENT_ID, english: "Fixture English translation 1." }],
    });
    expect(resolved.model).toBe("popcorn-ci-fixture-v1");
    expect(createRuntimeResolver).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("production resolves the exact pin immediately before a bounded adapter fetch", async () => {
    const resolve = vi.fn(async () => runtime);
    const createRuntimeResolver = vi.fn(() => ({ resolve }));
    const fetchImpl = vi.fn<typeof fetch>(async () => completion({
      translations: [{ segmentIndex: 0, english: "This expression sounds natural." }],
    }));
    const resolver = createLearningArtifactProviderResolver({
      ci: false,
      createRuntimeResolver,
      fetchImpl,
    });

    const resolved = await resolver.resolve(USER_A, pin);
    await expect(resolved.provider.translateSegments(evidence, [SEGMENT_ID])).resolves.toEqual({
      segments: [{ id: SEGMENT_ID, english: "This expression sounds natural." }],
    });
    expect(createRuntimeResolver).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledExactlyOnceWith(USER_A, pin);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://models.example/v1/chat/completions");
    expect(options).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: "Bearer runtime-secret",
        "Content-Type": "application/json",
      },
    });
  });

  test("production sends one Provider request for a translation group larger than four", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion({
      translations: BULK_SEGMENT_IDS.map((_id, segmentIndex) => ({
        segmentIndex,
        english: `English sentence ${segmentIndex + 1}.`,
      })),
    }));
    const resolver = createLearningArtifactProviderResolver({
      ci: false,
      createRuntimeResolver: () => ({ resolve: vi.fn(async () => runtime) }),
      fetchImpl,
    });

    const resolved = await resolver.resolve(USER_A, pin);
    await expect(resolved.provider.translateSegments(bulkEvidence, BULK_SEGMENT_IDS)).resolves.toEqual({
      segments: BULK_SEGMENT_IDS.map((id, index) => ({
        id,
        english: `English sentence ${index + 1}.`,
      })),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("unknown runtime adapter fails closed before fetch", async () => {
    const fetchImpl = vi.fn();
    const resolver = createLearningArtifactProviderResolver({
      ci: false,
      createRuntimeResolver: () => ({
        resolve: vi.fn(async () => ({ ...runtime, adapterKind: "custom-proxy" }) as never),
      }),
      fetchImpl,
    });

    await expect(resolver.resolve(USER_A, pin)).rejects.toEqual(
      new ModelGatewayError("PROVIDER_UNAVAILABLE"),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
