import { describe, expect, test, vi } from "vitest";

import type { WireNormalizer } from "@/server/ai/model-output";
import { ModelGatewayError } from "@/server/ai/provider";
import {
  createStructuredJsonGatewayResolver,
  type StructuredJsonCompletionOptions,
  type StructuredJsonGateway,
} from "@/server/ai/structured-json-gateway";
import type { ModelGatewayRuntimeConfig } from "@/server/model-gateway/runtime-resolver";

const USER_ID = "0a000000-0000-4000-8000-00000000a001";
const PIN = {
  configId: "0a400000-0000-4000-8000-000000000001",
  revision: 3,
  fingerprint: "a".repeat(64),
} as const;
const API_KEY = "fixture-user-secret-that-must-not-leak";

const runtimeConfig: ModelGatewayRuntimeConfig = {
  adapterKind: "openai-compatible",
  canonicalOrigin: "https://gateway.example.com",
  basePath: "/v1",
  model: "provider/model-v3",
  revision: PIN.revision,
  configFingerprint: PIN.fingerprint,
  apiKey: API_KEY,
};

function jsonResponse(content: unknown): Response {
  return assistantResponse(JSON.stringify(content));
}

function assistantResponse(
  content: string,
  status = 200,
  headers: HeadersInit = { "Content-Type": "application/json" },
): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { role: "assistant", content } }],
  }), {
    status,
    headers,
  });
}

const recordNormalizer: WireNormalizer<Record<string, unknown>> = (value) => ({
  success: true,
  data: value,
});

function completionOptions<T>(
  normalize: WireNormalizer<T>,
  overrides: Partial<StructuredJsonCompletionOptions<T>> = {},
): StructuredJsonCompletionOptions<T> {
  return {
    systemPrompt: "TASK SYSTEM",
    timeoutMs: 30_000,
    maxTokens: 700,
    normalize,
    ...overrides,
  };
}

function mockGateway(model: string, complete: ReturnType<typeof vi.fn>): StructuredJsonGateway {
  return {
    model,
    complete: complete as unknown as StructuredJsonGateway["complete"],
  };
}

describe("structured JSON model gateway", () => {
  test("CI fixture completes before runtime resolver construction, Vault access, or fetch", async () => {
    const fixtureComplete = vi.fn(async () => ({ candidates: [{ expression: "太离谱了" }] }));
    const createRuntimeResolver = vi.fn(() => {
      throw new Error("CI must not construct the runtime resolver");
    });
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("CI must not fetch");
    });
    const resolver = createStructuredJsonGatewayResolver({
      ci: true,
      fixture: mockGateway("popcorn-ci-fixture-v1", fixtureComplete),
      createRuntimeResolver,
      fetchImpl,
    });

    const resolved = await resolver.resolve(USER_ID, PIN);
    const options = completionOptions(recordNormalizer);
    await expect(resolved.complete("analyze-saved-item-v1", "Analyze exact evidence.", options))
      .resolves.toEqual({ candidates: [{ expression: "太离谱了" }] });
    expect(resolved.model).toBe("popcorn-ci-fixture-v1");
    expect(fixtureComplete).toHaveBeenCalledExactlyOnceWith(
      "analyze-saved-item-v1",
      "Analyze exact evidence.",
      options,
    );
    expect(createRuntimeResolver).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("runtime resolves the exact owner/pin and reuses the fixed bounded JSON transport", async () => {
    const runtimeResolve = vi.fn(async () => runtimeConfig);
    const createRuntimeResolver = vi.fn(() => ({ resolve: runtimeResolve }));
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ passed: true }));
    const resolver = createStructuredJsonGatewayResolver({
      ci: false,
      fixture: mockGateway("unused", vi.fn()),
      createRuntimeResolver,
      fetchImpl,
    });

    const resolved = await resolver.resolve(USER_ID, PIN);
    await expect(resolved.complete(
      "evaluate-v1",
      "Evaluate the learner response.",
      completionOptions(recordNormalizer),
    ))
      .resolves.toEqual({ passed: true });

    expect(runtimeResolve).toHaveBeenCalledExactlyOnceWith(USER_ID, PIN);
    expect(resolved.model).toBe(runtimeConfig.model);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://gateway.example.com/v1/chat/completions");
    expect(init?.method).toBe("POST");
    expect(init?.redirect).toBe("error");
    expect(init?.headers).toEqual({
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: runtimeConfig.model,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: "TASK SYSTEM",
        },
        { role: "user", content: "Evaluate the learner response." },
      ],
    });
    expect(String(init?.body)).not.toContain(API_KEY);
    expect(Object.keys(resolved)).toEqual(["model", "complete"]);
  });

  test("unsupported adapters and transport failures fail closed without exposing the key", async () => {
    const unsupported = createStructuredJsonGatewayResolver({
      ci: false,
      fixture: mockGateway("unused", vi.fn()),
      createRuntimeResolver: () => ({
        resolve: vi.fn(async () => ({
          ...runtimeConfig,
          adapterKind: "unexpected-adapter",
        } as unknown as ModelGatewayRuntimeConfig)),
      }),
    });
    await expect(unsupported.resolve(USER_ID, PIN)).rejects.toMatchObject({
      name: "ModelGatewayError",
      code: "PROVIDER_UNAVAILABLE",
    });

    const failedFetch = createStructuredJsonGatewayResolver({
      ci: false,
      fixture: mockGateway("unused", vi.fn()),
      createRuntimeResolver: () => ({ resolve: vi.fn(async () => runtimeConfig) }),
      fetchImpl: vi.fn<typeof fetch>(async () => {
        throw new Error(`network failed for ${API_KEY}`);
      }),
    });
    const gateway = await failedFetch.resolve(USER_ID, PIN);
    let thrown: unknown;
    try {
      await gateway.complete(
        "activate-v1",
        "Create a situation.",
        completionOptions(recordNormalizer, { maxTransportRetries: 0 }),
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ModelGatewayError);
    expect(thrown).toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(String(thrown)).not.toContain(API_KEY);
  });

  test("invalid structured assistant output uses the existing nonleaking public error", async () => {
    const resolver = createStructuredJsonGatewayResolver({
      ci: false,
      fixture: mockGateway("unused", vi.fn()),
      createRuntimeResolver: () => ({ resolve: vi.fn(async () => runtimeConfig) }),
      fetchImpl: vi.fn<typeof fetch>(async () => new Response("not-json", { status: 200 })),
    });
    const gateway = await resolver.resolve(USER_ID, PIN);

    await expect(gateway.complete(
      "evaluate-v1",
      "Evaluate.",
      completionOptions(recordNormalizer, { maxTransportRetries: 0 }),
    ))
      .rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID" });
    await expect(gateway.complete(
      "evaluate-v1",
      "Evaluate.",
      completionOptions(recordNormalizer, { maxTransportRetries: 0 }),
    ))
      .rejects.not.toThrow(API_KEY);
  });

  test("retries one eligible 503 by default but honors a zero-retry task", async () => {
    const defaultFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(assistantResponse("temporarily unavailable", 503, { "Retry-After": "0" }))
      .mockResolvedValueOnce(jsonResponse({ score: 4 }));
    const noRetryFetch = vi.fn<typeof fetch>(async () =>
      assistantResponse("temporarily unavailable", 503, { "Retry-After": "0" }));
    const create = (fetchImpl: typeof fetch) => createStructuredJsonGatewayResolver({
      ci: false,
      fixture: mockGateway("unused", vi.fn()),
      createRuntimeResolver: () => ({ resolve: vi.fn(async () => runtimeConfig) }),
      fetchImpl,
    });

    const defaultGateway = await create(defaultFetch).resolve(USER_ID, PIN);
    await expect(defaultGateway.complete(
      "ordinary-task",
      "TASK DATA",
      completionOptions(recordNormalizer),
    )).resolves.toEqual({ score: 4 });
    expect(defaultFetch).toHaveBeenCalledTimes(2);

    const noRetryGateway = await create(noRetryFetch).resolve(USER_ID, PIN);
    await expect(noRetryGateway.complete(
      "overview-task",
      "TASK DATA",
      completionOptions(recordNormalizer, { maxTransportRetries: 0 }),
    )).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      stage: "provider_http",
    });
    expect(noRetryFetch).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      "malformed envelope",
      () => new Response("not-json", { status: 200 }),
      "response_envelope",
    ],
    [
      "malformed model output",
      () => assistantResponse("not json"),
      "json_extract",
    ],
  ])("does not retry %s", async (_label, response, stage) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response());
    const resolver = createStructuredJsonGatewayResolver({
      ci: false,
      fixture: mockGateway("unused", vi.fn()),
      createRuntimeResolver: () => ({ resolve: vi.fn(async () => runtimeConfig) }),
      fetchImpl,
    });
    const gateway = await resolver.resolve(USER_ID, PIN);

    await expect(gateway.complete(
      "evaluate-v1",
      "TASK DATA",
      completionOptions(recordNormalizer),
    )).rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID", stage });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("does not retry a timed-out request", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      }));
    const resolver = createStructuredJsonGatewayResolver({
      ci: false,
      fixture: mockGateway("unused", vi.fn()),
      createRuntimeResolver: () => ({ resolve: vi.fn(async () => runtimeConfig) }),
      fetchImpl,
    });
    const gateway = await resolver.resolve(USER_ID, PIN);

    await expect(gateway.complete(
      "evaluate-v1",
      "TASK DATA",
      completionOptions(recordNormalizer, { timeoutMs: 1 }),
    )).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", stage: "timeout" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("uses task normalization after extraction and reports only safe output stages", async () => {
    const responses = [
      assistantResponse('{"score":4}\n{"score":"bad"}'),
      assistantResponse('{"score":4}\n{"score":5}'),
      assistantResponse('{"wrong":4}'),
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () => responses.shift()!);
    const scoreNormalizer: WireNormalizer<{ score: number }> = (value) =>
      typeof value.score === "number"
        ? { success: true, data: { score: value.score } }
        : { success: false, fieldPath: "score" };
    const resolver = createStructuredJsonGatewayResolver({
      ci: false,
      fixture: mockGateway("unused", vi.fn()),
      createRuntimeResolver: () => ({ resolve: vi.fn(async () => runtimeConfig) }),
      fetchImpl,
    });
    const gateway = await resolver.resolve(USER_ID, PIN);
    const options = completionOptions(scoreNormalizer);

    await expect(gateway.complete("score-v1", "TASK DATA", options))
      .resolves.toEqual({ score: 4 });
    await expect(gateway.complete("score-v1", "TASK DATA", options))
      .rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID", stage: "json_extract" });
    await expect(gateway.complete("score-v1", "TASK DATA", options))
      .rejects.toMatchObject({
        code: "PROVIDER_OUTPUT_INVALID",
        stage: "wire_schema",
        fieldPath: "score",
      });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
