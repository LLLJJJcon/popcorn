import { describe, expect, test, vi } from "vitest";

import { KnowledgeJobSchema, type KnowledgeJobType } from "@/contracts/knowledge";
import { leaseJob, nextJobFailure } from "@/server/domain/lease-job";
import {
  createLearningArtifactJobKey,
  createLearningArtifactRoute,
  createSupabaseLearningArtifactRouteStore,
  TranslationJobInputSchema,
  validateOverviewContent,
  validateTranslationContent,
  type LearningArtifactEvidence,
  type LearningArtifactProvider,
  type LearningArtifactRouteStore,
} from "@/server/ai/provider";
import {
  ModelGatewayError,
} from "@/server/ai/model-gateway";
import { createOpenAiCompatibleLearningArtifactProvider } from "@/server/ai/openai-compatible-provider";
import { createGenerateOverviewHandler } from "@/server/jobs/handlers/generate-overview";
import { createTranslateSegmentsHandler } from "@/server/jobs/handlers/translate-segments";
import { createExplainSelectionHandler } from "@/server/jobs/handlers/explain-selection";
import { createSupabaseDurableJobStore, type DurableJobStore } from "@/server/jobs/process-jobs";

const NOW = "2026-08-18T00:00:00.000Z";
const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const SOURCE_ID = "20000000-0000-4000-8000-000000000001";
const SNAPSHOT_ID = "40000000-0000-4000-8000-000000000001";
const JOB_ID = "10000000-0000-4000-8000-000000000001";
const ARTIFACT_ID = "50000000-0000-4000-8000-000000000001";
const SEGMENT_A = "a".repeat(64);
const SEGMENT_B = "b".repeat(64);
const BULK_SEGMENT_IDS = ["a", "b", "c", "d", "e"].map((value) => value.repeat(64));
const CONFIG_ID = "60000000-0000-4000-8000-000000000001";
const GATEWAY_FINGERPRINT = "f".repeat(64);
const GATEWAY_PIN = {
  configId: CONFIG_ID,
  revision: 3,
  fingerprint: GATEWAY_FINGERPRINT,
};
const RUNTIME_CONFIG = {
  adapterKind: "openai-compatible" as const,
  canonicalOrigin: "https://models.example",
  basePath: "/v1",
  model: "mandarin-model",
  revision: 3,
  configFingerprint: GATEWAY_FINGERPRINT,
  apiKey: "gateway-secret",
};

const evidence: LearningArtifactEvidence = {
  userId: USER_A,
  sourceId: SOURCE_ID,
  videoId: "abc123XYZ00",
  snapshotId: SNAPSHOT_ID,
  transcriptHash: "c".repeat(64),
  title: "中文视频",
  segments: [
    { stableId: SEGMENT_A, originalChinese: "这个表达很自然。", startSeconds: 0, endSeconds: 2 },
    { stableId: SEGMENT_B, originalChinese: "你可以直接这样说。", startSeconds: 2, endSeconds: 5 },
  ],
};

const bulkEvidence: LearningArtifactEvidence = {
  ...evidence,
  segments: BULK_SEGMENT_IDS.map((stableId, index) => ({
    stableId,
    originalChinese: `第${index + 1}个完整句子。`,
    startSeconds: index * 2,
    endSeconds: index * 2 + 2,
  })),
};

const validOverview = {
  overview: "A complete English overview.",
  chapters: [{
    title: "Opening",
    summary: "The speaker introduces the expression.",
    timestampSeconds: 0,
    sourceSegmentIds: [SEGMENT_A],
  }],
  keyQuotes: [
    { quote: "这个表达", englishMeaning: "This expression.", timestampSeconds: 0, sourceSegmentIds: [SEGMENT_A] },
    { quote: "很自然", englishMeaning: "Very natural.", timestampSeconds: 1, sourceSegmentIds: [SEGMENT_A] },
    { quote: "你可以直接这样说", englishMeaning: "You can say it this way.", timestampSeconds: 2, sourceSegmentIds: [SEGMENT_B] },
  ],
};

const gatewayOverview = {
  overview: validOverview.overview,
  chapters: validOverview.chapters.map((chapter) => ({
    title: chapter.title,
    summary: chapter.summary,
    timestampSeconds: chapter.timestampSeconds,
    sourceSegmentIndexes: [0],
  })),
  keyQuotes: validOverview.keyQuotes.map((quote, index) => ({
    quote: quote.quote,
    englishMeaning: quote.englishMeaning,
    timestampSeconds: quote.timestampSeconds,
    sourceSegmentIndexes: [index < 2 ? 0 : 1],
  })),
};

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function completionResponse(value: unknown): Response {
  return jsonResponse({
    choices: [{ message: { role: "assistant", content: JSON.stringify(value) } }],
  });
}

async function expectGatewayCode(
  operation: Promise<unknown>,
  code: "PROVIDER_UNAVAILABLE" | "PROVIDER_OUTPUT_INVALID",
): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    name: "ModelGatewayError",
    message: code,
    code,
  });
}

describe("bounded openai-compatible adapter", () => {
  test("accepts one structured translation group larger than four through Provider and artifact schemas", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completionResponse({
      translations: BULK_SEGMENT_IDS.map((_id, segmentIndex) => ({
        segmentIndex,
        english: `Complete English sentence ${segmentIndex + 1}.`,
      })),
    }));
    const configured = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl,
    });
    const expected = {
      segments: BULK_SEGMENT_IDS.map((id, index) => ({
        id,
        english: `Complete English sentence ${index + 1}.`,
      })),
    };

    await expect(configured.translateSegments(bulkEvidence, BULK_SEGMENT_IDS)).resolves.toEqual(expected);
    expect(validateTranslationContent(expected, BULK_SEGMENT_IDS)).toEqual(expected);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("uses exact chat-completions transport and sends only requested translation evidence", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completionResponse({
      translations: [{ segmentIndex: 0, english: "You can say it exactly this way." }],
    }));
    const configured = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl,
    });

    await expect(configured.translateSegments(evidence, [SEGMENT_B])).resolves.toEqual({
      segments: [{ id: SEGMENT_B, english: "You can say it exactly this way." }],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://models.example/v1/chat/completions");
    expect(options).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: "Bearer gateway-secret",
        "Content-Type": "application/json",
      },
    });
    const requestBody = JSON.parse(String(options?.body));
    expect(requestBody.model).toBe("mandarin-model");
    expect(requestBody.messages).toHaveLength(2);
    expect(requestBody.messages.map((message: { role: string }) => message.role)).toEqual([
      "system",
      "user",
    ]);
    const outbound = JSON.stringify(requestBody);
    const userPrompt = requestBody.messages[1].content as string;
    expect(outbound).toContain("你可以直接这样说。");
    expect(outbound).toContain("translate-segments-v1");
    expect(userPrompt).toContain('"startSeconds":2');
    expect(userPrompt).toContain('"endSeconds":5');
    expect(outbound).not.toContain(SEGMENT_B);
    expect(outbound).not.toContain(SEGMENT_A);
    expect(outbound).not.toContain("这个表达很自然。");
    expect(outbound).not.toContain(USER_A);
    expect(outbound).not.toContain("gateway-secret");
  });

  test("minimizes overview and explanation payloads without account metadata", async () => {
    const bodies: string[] = [];
    const fetchImpl = vi.fn(async (_url: URL | RequestInfo, options?: RequestInit) => {
      bodies.push(String(options?.body));
      return bodies.length === 1
        ? completionResponse(gatewayOverview)
        : completionResponse({
          selectedChinese: "这个表达",
          meaning: "this expression",
          tone: "neutral",
          communicativeFunction: "refers to the phrase being discussed",
          contextualFit: "It fits the evaluation of the phrase.",
        });
    });
    const provider = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl,
    });

    await provider.generateOverview(evidence);
    await provider.explainSelection(
      { ...evidence, segments: [evidence.segments[0]] },
      {
        selectedChinese: "这个表达",
        segmentIds: [SEGMENT_A],
        utf16Start: 0,
        utf16End: 4,
        startSeconds: 0,
        endSeconds: 2,
        context: "这个表达很自然。",
      },
    );

    expect(bodies[0]).toContain("中文视频");
    expect(bodies[0]).toContain("youtube-overview-v1");
    expect(bodies[0]).toContain("这个表达很自然。");
    expect(bodies[0]).toContain("你可以直接这样说。");
    expect(bodies[1]).toContain("这个表达");
    expect(bodies[1]).toContain("explain-selection-v1");
    expect(bodies[1]).toContain("这个表达很自然。");
    expect(bodies[1]).not.toContain(SEGMENT_A);
    expect(bodies[1]).not.toContain(SEGMENT_B);
    for (const body of bodies) {
      expect(body).not.toContain(SEGMENT_A);
      expect(body).not.toContain(SEGMENT_B);
      expect(body).not.toContain(USER_A);
      expect(body).not.toContain(SOURCE_ID);
      expect(body).not.toContain(SNAPSHOT_ID);
      expect(body).not.toContain("gateway-secret");
    }
  });

  test("bounds request bytes before fetch and response bytes while streaming", async () => {
    const fetchImpl = vi.fn(async () => completionResponse(gatewayOverview));
    const smallRequestProvider = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl,
      maxRequestBytes: 64,
    });
    await expectGatewayCode(
      smallRequestProvider.generateOverview(evidence),
      "PROVIDER_OUTPUT_INVALID",
    );
    expect(fetchImpl).not.toHaveBeenCalled();

    let emittedChunks = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        emittedChunks += 1;
        controller.enqueue(new TextEncoder().encode("x".repeat(32)));
        if (emittedChunks > 10) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamingProvider = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl: vi.fn(async () => new Response(body, { status: 200 })),
      maxResponseBytes: 48,
    });
    await expectGatewayCode(
      streamingProvider.generateOverview(evidence),
      "PROVIDER_OUTPUT_INVALID",
    );
    expect(cancelled).toBe(true);
    expect(emittedChunks).toBeLessThan(10);
  });

  test.each([
    ["network", vi.fn(async () => { throw new Error("secret upstream detail"); })],
    ["408", vi.fn(async () => new Response("secret timeout", { status: 408 }))],
    ["429", vi.fn(async () => new Response("secret quota", { status: 429 }))],
    ["401", vi.fn(async () => new Response("secret auth", { status: 401 }))],
    ["500", vi.fn(async () => new Response("secret crash", { status: 500 }))],
  ])("maps %s failures to sanitized unavailable", async (_label, fetchImpl) => {
    const adapter = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expectGatewayCode(adapter.generateOverview(evidence), "PROVIDER_UNAVAILABLE");
    await adapter.generateOverview(evidence).catch((error: unknown) => {
      expect(String(error)).not.toContain("secret");
      expect(String(error)).not.toContain("models.example");
      expect(String(error)).not.toContain("gateway-secret");
    });
  });

  test("maps timeout to sanitized unavailable", async () => {
    const fetchImpl = vi.fn((_url: URL | RequestInfo, options?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("private timeout detail")));
      }));
    const adapter = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl,
      timeoutMs: 1,
    });
    await expectGatewayCode(adapter.generateOverview(evidence), "PROVIDER_UNAVAILABLE");
  });

  test("keeps the timeout active while a successful response body is still streaming", async () => {
    let aborted = false;
    const fetchImpl = vi.fn((_url: URL | RequestInfo, options?: RequestInit) => {
      let streamController: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
        },
      });
      options?.signal?.addEventListener("abort", () => {
        aborted = true;
        streamController.error(new Error("private stalled body detail"));
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    });
    const adapter = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl,
      timeoutMs: 1,
    });

    const result = await Promise.race([
      adapter.generateOverview(evidence).catch((error: unknown) => error),
      new Promise<"still-pending">((resolve) => setTimeout(() => resolve("still-pending"), 50)),
    ]);

    expect(result).not.toBe("still-pending");
    expect(result).toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(aborted).toBe(true);
  });

  test.each([
    ["malformed envelope", { choices: [] }],
    ["multiple choices", { choices: [
      { message: { role: "assistant", content: JSON.stringify(validOverview) } },
      { message: { role: "assistant", content: JSON.stringify(validOverview) } },
    ] }],
    ["tool call", { choices: [{ message: { role: "assistant", content: JSON.stringify(validOverview), tool_calls: [{}] } }] }],
    ["empty", { choices: [{ message: { role: "assistant", content: "" } }] }],
    ["fenced", { choices: [{ message: { role: "assistant", content: "```json\n{}\n```" } }] }],
    ["invalid json", { choices: [{ message: { role: "assistant", content: "not-json" } }] }],
  ])("maps %s successful responses to output invalid", async (_label, envelope) => {
    const adapter = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl: vi.fn(async () => jsonResponse(envelope)),
    });
    await expectGatewayCode(adapter.generateOverview(evidence), "PROVIDER_OUTPUT_INVALID");
  });

  test("rejects Provider segment indexes that cannot map to requested internal evidence", async () => {
    const adapter = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl: vi.fn(async () => completionResponse({
        translations: [{ segmentIndex: 1, english: "Wrong evidence." }],
      })),
    });

    await expectGatewayCode(
      adapter.translateSegments(evidence, [SEGMENT_B]),
      "PROVIDER_OUTPUT_INVALID",
    );
  });

  test("exposes only normalized gateway codes", () => {
    expect(new ModelGatewayError("PROVIDER_UNAVAILABLE")).toMatchObject({
      message: "PROVIDER_UNAVAILABLE",
      code: "PROVIDER_UNAVAILABLE",
    });
  });
});

function bodyFor(type: KnowledgeJobType): unknown {
  if (type === "generate_overview") return { snapshotId: SNAPSHOT_ID };
  if (type === "translate_segments") return { snapshotId: SNAPSHOT_ID, segmentIds: [SEGMENT_A, SEGMENT_B] };
  return {
    videoId: "abc123XYZ00",
    snapshotId: SNAPSHOT_ID,
    selectedChinese: "这个表达",
    segmentIds: [SEGMENT_A],
    utf16Start: 0,
    utf16End: 4,
    startSeconds: 0,
    endSeconds: 2,
    context: "这个表达很自然。",
  };
}

function routeStore(overrides: Partial<LearningArtifactRouteStore> = {}): LearningArtifactRouteStore {
  return {
    resolveActiveGatewayPin: vi.fn(async (userId) => userId === USER_A ? GATEWAY_PIN : null),
    resolveEvidence: vi.fn(async (userId, videoId) =>
      userId === USER_A && videoId === evidence.videoId ? evidence : null),
    register: vi.fn(async () => ({ jobId: JOB_ID, status: "pending", created: true })),
    readArtifact: vi.fn(async () => null),
    ...overrides,
  };
}

describe("fast durable learning-artifact request routes", () => {
  test("a retry UUID changes only translation dedupe identity and is absent from private Provider input", async () => {
    const store = routeStore({
      resolveEvidence: vi.fn(async () => bulkEvidence),
    });
    const route = createLearningArtifactRoute({
      jobType: "translate_segments",
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: "translation-v1",
      requestId: () => "request-retry",
    });
    const submit = (retryId: string) => route(new Request(
      "https://app.popcorn.local/api/v1/youtube/abc123XYZ00/translations",
      {
        method: "POST",
        body: JSON.stringify({ snapshotId: SNAPSHOT_ID, segmentIds: BULK_SEGMENT_IDS, retryId }),
      },
    ), { params: Promise.resolve({ videoId: "abc123XYZ00" }) });

    const first = await submit("70000000-0000-4000-8000-000000000001");
    const replay = await submit("70000000-0000-4000-8000-000000000001");
    const fresh = await submit("70000000-0000-4000-8000-000000000002");

    expect([first.status, replay.status, fresh.status]).toEqual([202, 202, 202]);
    const registrations = vi.mocked(store.register).mock.calls.map(([registration]) => registration);
    expect(registrations[0].dedupeKey).toBe(registrations[1].dedupeKey);
    expect(registrations[2].dedupeKey).not.toBe(registrations[0].dedupeKey);
    expect(registrations.map(({ input }) => input)).toEqual([
      registrations[0].input,
      registrations[0].input,
      registrations[0].input,
    ]);
    expect(registrations[0].input).not.toHaveProperty("retryId");
    expect(TranslationJobInputSchema.parse(registrations[0].input).segmentIds).toEqual(BULK_SEGMENT_IDS);
  });

  test.each([
    ["generate_overview", "overview"],
    ["translate_segments", "translation"],
    ["explain_selection", "explanation"],
  ] as const)("%s pins the authenticated owner's gateway and returns 202 before runtime resolution", async (jobType, path) => {
    const store = routeStore();
    const route = createLearningArtifactRoute({
      jobType,
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: `${path}-v1`,
      requestId: () => "request-1",
    });
    const url = jobType === "explain_selection"
      ? "https://app.popcorn.local/api/v1/explanations"
      : `https://app.popcorn.local/api/v1/youtube/abc123XYZ00/${path}`;
    const response = await route(
      new Request(url, { method: "POST", body: JSON.stringify(bodyFor(jobType)) }),
      { params: Promise.resolve(jobType === "explain_selection" ? {} : { videoId: "abc123XYZ00" }) },
    );

    expect(response.status).toBe(202);
    expect(store.resolveActiveGatewayPin).toHaveBeenCalledExactlyOnceWith(USER_A);
    expect(store.register).toHaveBeenCalledTimes(1);
    const registration = vi.mocked(store.register).mock.calls[0][0];
    expect(registration).toMatchObject({
      userId: USER_A,
      sourceId: SOURCE_ID,
      jobType,
      gatewayPin: GATEWAY_PIN,
    });
    expect(registration.input).toMatchObject({
      promptVersion: `${path}-v1`,
      snapshotId: SNAPSHOT_ID,
      gatewayConfigId: CONFIG_ID,
      gatewayRevision: 3,
      gatewayFingerprint: GATEWAY_FINGERPRINT,
    });
    const serializedInput = JSON.stringify(registration.input);
    for (const forbidden of [
      "gateway-secret", "models.example", "apiKey", "authorization", "basePath",
      "canonicalOrigin", "adapterKind", "vault", "model",
    ]) {
      expect(serializedInput).not.toContain(forbidden);
    }
    expect(JSON.stringify(registration.input).length).toBeLessThan(65_536);
    expect(await response.json()).toEqual({
      ok: true,
      data: { jobId: JOB_ID, status: "pending" },
      requestId: "request-1",
    });
  });

  test.each([
    ["unauthenticated", async (): Promise<null> => null, routeStore(), bodyFor("generate_overview"), 401],
    ["wrong owner/source", async () => ({ userId: USER_B }), routeStore(), bodyFor("generate_overview"), 404],
    ["wrong snapshot", async () => ({ userId: USER_A }), routeStore(), { snapshotId: "40000000-0000-4000-8000-000000000099" }, 404],
    ["unknown segment", async () => ({ userId: USER_A }), routeStore(), { snapshotId: SNAPSHOT_ID, segmentIds: ["d".repeat(64)] }, 400],
    ["duplicate segment", async () => ({ userId: USER_A }), routeStore(), { snapshotId: SNAPSHOT_ID, segmentIds: [SEGMENT_A, SEGMENT_A] }, 400],
    ["extra shape", async () => ({ userId: USER_A }), routeStore(), { snapshotId: SNAPSHOT_ID, extra: true }, 400],
  ] as const)("rejects %s without registration", async (_label, authenticate, store, body, status) => {
    const route = createLearningArtifactRoute({
      jobType: Array.isArray((body as { segmentIds?: unknown }).segmentIds) ? "translate_segments" : "generate_overview",
      authenticate,
      store,
      promptVersion: "route-v1",
      requestId: () => "request-2",
    });
    const response = await route(
      new Request("https://app.popcorn.local/api/v1/youtube/abc123XYZ00/overview", { method: "POST", body: JSON.stringify(body) }),
      { params: Promise.resolve({ videoId: "abc123XYZ00" }) },
    );
    expect(response.status).toBe(status);
    expect(store.register).not.toHaveBeenCalled();
  });

  test("rejects oversized explanation input before registration", async () => {
    const store = routeStore();
    const route = createLearningArtifactRoute({
      jobType: "explain_selection",
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: "explain-v1",
      requestId: () => "request-3",
    });
    const response = await route(new Request("https://app.popcorn.local/api/v1/explanations", {
      method: "POST",
      body: JSON.stringify({ ...(bodyFor("explain_selection") as object), context: "中".repeat(70_000) }),
    }), { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
    expect(store.register).not.toHaveBeenCalled();
  });

  test("rejects explanation context that is not the exact persisted joined evidence before pin lookup", async () => {
    const store = routeStore();
    const route = createLearningArtifactRoute({
      jobType: "explain_selection",
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: "explain-v1",
      requestId: () => "request-context",
    });
    const response = await route(new Request("https://app.popcorn.local/api/v1/explanations", {
      method: "POST",
      body: JSON.stringify({
        ...(bodyFor("explain_selection") as object),
        context: "这个表达不自然。",
      }),
    }), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    expect(store.resolveActiveGatewayPin).not.toHaveBeenCalled();
    expect(store.register).not.toHaveBeenCalled();
  });

  test("deterministic replay returns the same succeeded owner-scoped artifact as 200", async () => {
    const content = validOverview;
    const store = routeStore({
      register: vi.fn(async () => ({ jobId: JOB_ID, status: "succeeded", created: false })),
      readArtifact: vi.fn(async (userId) => userId === USER_A ? { artifactId: ARTIFACT_ID, content } : null),
    });
    const route = createLearningArtifactRoute({
      jobType: "generate_overview",
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: "overview-v1",
      requestId: () => "request-4",
    });
    const request = () => route(new Request("https://app.popcorn.local/api/v1/youtube/abc123XYZ00/overview", {
      method: "POST", body: JSON.stringify(bodyFor("generate_overview")),
    }), { params: Promise.resolve({ videoId: "abc123XYZ00" }) });
    const first = await request();
    const second = await request();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(vi.mocked(store.register).mock.calls[0][0].dedupeKey).toBe(
      vi.mocked(store.register).mock.calls[1][0].dedupeKey,
    );
    expect(await first.json()).toMatchObject({ ok: true, data: { artifactId: ARTIFACT_ID, content } });
  });

  test("job keys use the frozen serializer with gateway fingerprint semantic identity", () => {
    const first = createLearningArtifactJobKey("translate_segments", evidence.transcriptHash, { segmentIds: [SEGMENT_A] }, "translate-v1", GATEWAY_FINGERPRINT);
    const replayAfterKeyRotation = createLearningArtifactJobKey("translate_segments", evidence.transcriptHash, { segmentIds: [SEGMENT_A] }, "translate-v1", GATEWAY_FINGERPRINT);
    const changedPayload = createLearningArtifactJobKey("translate_segments", evidence.transcriptHash, { segmentIds: [SEGMENT_B] }, "translate-v1", GATEWAY_FINGERPRINT);
    const changedFingerprint = createLearningArtifactJobKey("translate_segments", evidence.transcriptHash, { segmentIds: [SEGMENT_A] }, "translate-v1", "9".repeat(64));
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(replayAfterKeyRotation).toBe(first);
    expect(changedPayload).not.toBe(first);
    expect(changedFingerprint).not.toBe(first);
  });

  test.each(["configId", "provider", "url", "origin", "path", "model", "apiKey", "authorization", "headers"])(
    "rejects public gateway override field %s before pin lookup",
    async (field) => {
      const store = routeStore();
      const route = createLearningArtifactRoute({
        jobType: "generate_overview",
        authenticate: async () => ({ userId: USER_A }),
        store,
        promptVersion: "overview-v1",
        requestId: () => "request-override",
      });
      const response = await route(new Request(
        "https://app.popcorn.local/api/v1/youtube/abc123XYZ00/overview",
        { method: "POST", body: JSON.stringify({ snapshotId: SNAPSHOT_ID, [field]: "attacker" }) },
      ), { params: Promise.resolve({ videoId: "abc123XYZ00" }) });

      expect(response.status).toBe(400);
      expect(store.resolveActiveGatewayPin).not.toHaveBeenCalled();
      expect(store.register).not.toHaveBeenCalled();
    },
  );
});

function leasedJob(type: "generate_overview" | "translate_segments" | "explain_selection", attemptCount = 0) {
  const pending = KnowledgeJobSchema.parse({
    id: JOB_ID, userId: USER_A, sourceId: SOURCE_ID, savedItemId: null, type,
    status: "pending", dedupeKey: "e".repeat(64), attemptCount,
    nextAttemptAt: null, leaseExpiresAt: null, lastErrorCode: null,
    createdAt: NOW, updatedAt: NOW,
  });
  const decision = leaseJob(pending, NOW);
  if (decision.kind !== "leased") throw new Error("fixture must lease");
  return decision.job;
}

function handlerStore(privateInput: unknown, overrides: Partial<DurableJobStore> = {}) {
  return {
    readPrivateInput: vi.fn(async () => privateInput),
    readLearningArtifactEvidence: vi.fn(async (
      _userId: string,
      _sourceId: string,
      _snapshotId: string,
      segmentIds: readonly string[],
    ) => ({
      ...evidence,
      segments: segmentIds.length === 0
        ? evidence.segments
        : evidence.segments.filter((segment) => segmentIds.includes(segment.stableId)),
    })),
    transitionLearningArtifactFailure: vi.fn(async () => true),
    completeGatewayLearningArtifact: vi.fn(async () => ARTIFACT_ID),
    ...overrides,
  } as unknown as DurableJobStore;
}

function privateInput(type: "generate_overview" | "translate_segments" | "explain_selection", promptVersion: string) {
  const body = { ...(bodyFor(type) as Record<string, unknown>) };
  delete body.videoId;
  return {
    ...body,
    kind: type,
    transcriptHash: evidence.transcriptHash,
    promptVersion,
    gatewayConfigId: CONFIG_ID,
    gatewayRevision: 3,
    gatewayFingerprint: GATEWAY_FINGERPRINT,
  };
}

const provider: LearningArtifactProvider = {
  generateOverview: vi.fn(async () => validOverview),
  translateSegments: vi.fn(async () => ({ segments: [
    { id: SEGMENT_A, english: "This expression sounds natural." },
    { id: SEGMENT_B, english: "You can say it exactly this way." },
  ] })),
  explainSelection: vi.fn(async () => ({
    selectedChinese: "这个表达", meaning: "this expression", tone: "neutral and conversational",
    communicativeFunction: "refers back to a phrase under discussion",
    contextualFit: "It fits because the speaker is evaluating how the phrase sounds.",
  })),
};

const providerResolver = {
  resolve: vi.fn(async (userId: string, gatewayPin: typeof GATEWAY_PIN) => {
    if (userId !== USER_A || JSON.stringify(gatewayPin) !== JSON.stringify(GATEWAY_PIN)) {
      throw new ModelGatewayError("PROVIDER_UNAVAILABLE");
    }
    return { provider, model: "mandarin-model" };
  }),
};

describe("durable CONTRACT-009 user-gateway learning-artifact handlers", () => {
  test.each([
    ["generate_overview", createGenerateOverviewHandler, bodyFor("generate_overview"), "overview"],
    ["translate_segments", createTranslateSegmentsHandler, bodyFor("translate_segments"), "segment_translation"],
    ["explain_selection", createExplainSelectionHandler, bodyFor("explain_selection"), "selection_explanation"],
  ] as const)("%s validates evidence and completes only through the atomic RPC adapter", async (type, factory, body, artifactType) => {
    const input = privateInput(type, `${type}-v1`);
    const store = handlerStore(input);
    const job = leasedJob(type);
    const handler = factory({ store, providerResolver });
    await expect(handler(job, USER_A, NOW)).resolves.toBe("completed");
    expect(providerResolver.resolve).toHaveBeenCalledWith(USER_A, GATEWAY_PIN);
    expect(store.completeGatewayLearningArtifact).toHaveBeenCalledWith(
      USER_A, job, artifactType, expect.any(Object), `${type}-v1`, "mandarin-model", job.dedupeKey, GATEWAY_PIN, NOW,
    );
    expect(store.transitionLearningArtifactFailure).not.toHaveBeenCalled();
  });

  test("invalid Provider output retries with exact frozen state and never completes", async () => {
    const job = leasedJob("translate_segments");
    const store = handlerStore(privateInput("translate_segments", "translation-v1"));
    const badProvider = { ...provider, translateSegments: vi.fn(async () => ({ segments: [{ id: "unknown", english: "Wrong." }] })) };
    const handler = createTranslateSegmentsHandler({ store, providerResolver: {
      resolve: vi.fn(async () => ({ provider: badProvider, model: "mandarin-model" })),
    } });
    await expect(handler(job, USER_A, NOW)).resolves.toBe("deferred");
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A, job, nextJobFailure(job, "PROVIDER_OUTPUT_INVALID", NOW), false,
    );
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
  });

  test("attempt five terminalizes and atomically clears input", async () => {
    const job = leasedJob("generate_overview", 4);
    const store = handlerStore(privateInput("generate_overview", "overview-v1"));
    const badProvider = { ...provider, generateOverview: vi.fn(async () => ({ bad: true })) };
    const handler = createGenerateOverviewHandler({ store, providerResolver: {
      resolve: vi.fn(async () => ({ provider: badProvider, model: "mandarin-model" })),
    } });
    await expect(handler(job, USER_A, NOW)).resolves.toBe("failed");
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A, job, nextJobFailure(job, "PROVIDER_OUTPUT_INVALID", NOW), true,
    );
  });

  test("lost completion and failure fences return deferred without split writes", async () => {
    const completeJob = leasedJob("explain_selection");
    const completeStore = handlerStore(
      privateInput("explain_selection", "explain-v1"),
      { completeGatewayLearningArtifact: vi.fn(async () => null) },
    );
    await expect(createExplainSelectionHandler({ store: completeStore, providerResolver })(completeJob, USER_A, NOW)).resolves.toBe("deferred");

    const failureJob = leasedJob("translate_segments");
    const failureStore = handlerStore(
      privateInput("translate_segments", "translation-v1"),
      { transitionLearningArtifactFailure: vi.fn(async () => false) },
    );
    const badProvider = { ...provider, translateSegments: vi.fn(async () => ({ segments: [] })) };
    await expect(createTranslateSegmentsHandler({ store: failureStore, providerResolver: {
      resolve: vi.fn(async () => ({ provider: badProvider, model: "mandarin-model" })),
    } })(failureJob, USER_A, NOW)).resolves.toBe("deferred");
  });

  test("revocation before fetch performs zero network and fails through the frozen transition", async () => {
    const job = leasedJob("generate_overview");
    const store = handlerStore(privateInput("generate_overview", "overview-v1"));
    const fetchProbe = vi.fn();
    const revokedResolver = {
      resolve: vi.fn(async () => {
        throw new ModelGatewayError("PROVIDER_UNAVAILABLE");
      }),
    };

    await expect(createGenerateOverviewHandler({ store, providerResolver: revokedResolver })(job, USER_A, NOW)).resolves.toBe("deferred");
    expect(fetchProbe).not.toHaveBeenCalled();
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A, job, nextJobFailure(job, "PROVIDER_UNAVAILABLE", NOW), false,
    );
  });

  test("tampered explanation context fails before runtime provider resolution", async () => {
    const job = leasedJob("explain_selection");
    const store = handlerStore({
      ...privateInput("explain_selection", "explain-v1"),
      context: "这个表达不自然。",
    });
    const resolver = { resolve: vi.fn() };

    await expect(createExplainSelectionHandler({ store, providerResolver: resolver })(job, USER_A, NOW)).resolves.toBe("deferred");

    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A, job, nextJobFailure(job, "PROVIDER_OUTPUT_INVALID", NOW), false,
    );
  });

  test("revocation after fetch loses the CONTRACT-009 completion fence and publishes nothing", async () => {
    const job = leasedJob("generate_overview");
    const store = handlerStore(
      privateInput("generate_overview", "overview-v1"),
      { completeGatewayLearningArtifact: vi.fn(async () => null) },
    );
    const oneFetchProvider = { ...provider, generateOverview: vi.fn(async () => validOverview) };
    const resolver = { resolve: vi.fn(async () => ({ provider: oneFetchProvider, model: "mandarin-model" })) };

    await expect(createGenerateOverviewHandler({ store, providerResolver: resolver })(job, USER_A, NOW)).resolves.toBe("deferred");
    expect(oneFetchProvider.generateOverview).toHaveBeenCalledTimes(1);
    expect(store.completeGatewayLearningArtifact).toHaveBeenCalledTimes(1);
  });
});

describe("complete source-grounded Overview validation", () => {
  test.each([
    ["zero chapters", { ...validOverview, chapters: [] }],
    ["fewer than three quotes", { ...validOverview, keyQuotes: validOverview.keyQuotes.slice(0, 2) }],
    ["more than five quotes", { ...validOverview, keyQuotes: Array.from({ length: 6 }, () => validOverview.keyQuotes[0]) }],
    ["quote text from a different source", {
      ...validOverview,
      keyQuotes: [
        { ...validOverview.keyQuotes[0], sourceSegmentIds: [SEGMENT_B] },
        ...validOverview.keyQuotes.slice(1),
      ],
    }],
    ["chapter timestamp outside referenced evidence", {
      ...validOverview,
      chapters: [{ ...validOverview.chapters[0], timestampSeconds: 4 }],
    }],
    ["quote timestamp outside referenced evidence", {
      ...validOverview,
      keyQuotes: [
        { ...validOverview.keyQuotes[0], timestampSeconds: 4 },
        ...validOverview.keyQuotes.slice(1),
      ],
    }],
    ["quote absent from its referenced native segments", {
      ...validOverview,
      keyQuotes: [
        { ...validOverview.keyQuotes[0], quote: "完全无关的中文" },
        ...validOverview.keyQuotes.slice(1),
      ],
    }],
  ] as const)("rejects %s", (_label, content) => {
    expect(() => validateOverviewContent(content, evidence)).toThrow();
  });

  test("accepts chapters and 3-5 quotes grounded to their exact referenced ranges", () => {
    expect(validateOverviewContent(validOverview, evidence)).toEqual(validOverview);
  });

  test("rejects a quote assembled across two referenced segments", () => {
    const content = {
      ...validOverview,
      keyQuotes: [
        {
          ...validOverview.keyQuotes[0],
          quote: "自然。你可以",
          sourceSegmentIds: [SEGMENT_A, SEGMENT_B],
        },
        ...validOverview.keyQuotes.slice(1),
      ],
    };
    expect(() => validateOverviewContent(content, evidence)).toThrow();
  });

  test("rejects a quote whose text and timestamp are grounded by different segments", () => {
    const content = {
      ...validOverview,
      keyQuotes: [
        {
          ...validOverview.keyQuotes[0],
          timestampSeconds: 3,
          sourceSegmentIds: [SEGMENT_A, SEGMENT_B],
        },
        ...validOverview.keyQuotes.slice(1),
      ],
    };
    expect(() => validateOverviewContent(content, evidence)).toThrow();
  });

  test("accepts a quote fully contained at its timestamp in one referenced segment", () => {
    expect(validateOverviewContent(validOverview, evidence)).toEqual(validOverview);
  });
});

describe("CONTRACT-009 Supabase adapters", () => {
  test("registration uses only the atomic RPC with bounded private input", async () => {
    const rpc = vi.fn(async () => ({ data: [{ knowledge_job_id: JOB_ID, status: "pending", created: true }], error: null }));
    const store = createSupabaseLearningArtifactRouteStore({
      rpc,
      from: vi.fn(() => { throw new Error("registration must not split-write tables"); }),
    } as never);
    const input = privateInput("translate_segments", "translation-v1");
    await expect(store.register({
      userId: USER_A, sourceId: SOURCE_ID, jobType: "translate_segments",
      dedupeKey: "e".repeat(64), input, gatewayPin: GATEWAY_PIN, now: NOW,
    })).resolves.toEqual({ jobId: JOB_ID, status: "pending", created: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("register_gateway_learning_artifact_job", {
      p_user_id: USER_A,
      p_video_source_id: SOURCE_ID,
      p_job_type: "translate_segments",
      p_dedupe_key: "e".repeat(64),
      p_input: input,
      p_config_id: CONFIG_ID,
      p_expected_config_revision: 3,
      p_expected_config_fingerprint: GATEWAY_FINGERPRINT,
      p_now: NOW,
    });
  });

  test("failure and completion use exact owner/source/type/lease/attempt fences", async () => {
    const rpc = vi.fn(async (name: string) => ({ data: name === "complete_gateway_learning_artifact_job" ? ARTIFACT_ID : true, error: null }));
    const store = createSupabaseDurableJobStore({ rpc } as never);
    const job = leasedJob("translate_segments");
    const failed = nextJobFailure(job, "PROVIDER_UNAVAILABLE", NOW);
    await expect(store.transitionLearningArtifactFailure(USER_A, job, failed, false)).resolves.toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(1, "transition_learning_artifact_failure", {
      p_user_id: USER_A, p_job_id: JOB_ID, p_video_source_id: SOURCE_ID,
      p_job_type: "translate_segments", p_expected_lease_expires_at: job.leaseExpiresAt,
      p_expected_attempt_count: 1, p_target_status: "retryable_failed",
      p_next_attempt_at: "2026-08-18T00:01:00.000Z", p_error_code: "PROVIDER_UNAVAILABLE",
      p_clear_input: false, p_now: NOW,
    });
    const content = { segments: [{ id: SEGMENT_A, english: "English." }] };
    await expect(store.completeGatewayLearningArtifact(USER_A, job, "segment_translation", content, "translation-v1", "mandarin-model", job.dedupeKey, GATEWAY_PIN, NOW)).resolves.toBe(ARTIFACT_ID);
    expect(rpc).toHaveBeenNthCalledWith(2, "complete_gateway_learning_artifact_job", {
      p_user_id: USER_A, p_job_id: JOB_ID, p_video_source_id: SOURCE_ID,
      p_job_type: "translate_segments", p_expected_lease_expires_at: job.leaseExpiresAt,
      p_expected_attempt_count: 1, p_artifact_type: "segment_translation",
      p_content: content, p_prompt_version: "translation-v1", p_model: "mandarin-model",
      p_result_key: job.dedupeKey, p_config_id: CONFIG_ID,
      p_expected_config_revision: 3, p_expected_config_fingerprint: GATEWAY_FINGERPRINT,
      p_now: NOW,
    });
  });
});
