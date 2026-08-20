import { describe, expect, test, vi } from "vitest";

import { ModelGatewayError } from "@/server/ai/provider";
import { createStructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
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
  return new Response(JSON.stringify({
    choices: [{ message: { role: "assistant", content: JSON.stringify(content) } }],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
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
      fixture: { model: "popcorn-ci-fixture-v1", complete: fixtureComplete },
      createRuntimeResolver,
      fetchImpl,
    });

    const resolved = await resolver.resolve(USER_ID, PIN);
    await expect(resolved.complete("analyze-saved-item-v1", "Analyze exact evidence."))
      .resolves.toEqual({ candidates: [{ expression: "太离谱了" }] });
    expect(resolved.model).toBe("popcorn-ci-fixture-v1");
    expect(fixtureComplete).toHaveBeenCalledExactlyOnceWith(
      "analyze-saved-item-v1",
      "Analyze exact evidence.",
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
      fixture: { model: "unused", complete: vi.fn() },
      createRuntimeResolver,
      fetchImpl,
    });

    const resolved = await resolver.resolve(USER_ID, PIN);
    await expect(resolved.complete("evaluate-v1", "Evaluate the learner response."))
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
      messages: [
        {
          role: "system",
          content: "Popcorn learning artifact task evaluate-v1. Return only the requested JSON object.",
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
      fixture: { model: "unused", complete: vi.fn() },
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
      fixture: { model: "unused", complete: vi.fn() },
      createRuntimeResolver: () => ({ resolve: vi.fn(async () => runtimeConfig) }),
      fetchImpl: vi.fn<typeof fetch>(async () => {
        throw new Error(`network failed for ${API_KEY}`);
      }),
    });
    const gateway = await failedFetch.resolve(USER_ID, PIN);
    let thrown: unknown;
    try {
      await gateway.complete("activate-v1", "Create a situation.");
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
      fixture: { model: "unused", complete: vi.fn() },
      createRuntimeResolver: () => ({ resolve: vi.fn(async () => runtimeConfig) }),
      fetchImpl: vi.fn<typeof fetch>(async () => new Response("not-json", { status: 200 })),
    });
    const gateway = await resolver.resolve(USER_ID, PIN);

    await expect(gateway.complete("evaluate-v1", "Evaluate."))
      .rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID" });
    await expect(gateway.complete("evaluate-v1", "Evaluate."))
      .rejects.not.toThrow(API_KEY);
  });
});
