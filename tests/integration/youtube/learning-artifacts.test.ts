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
import { YOUTUBE_OVERVIEW_PROMPT_VERSION } from "@/server/ai/prompts/youtube-overview.v1";
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
    { quote: "很自然", englishMeaning: "Very natural.", timestampSeconds: 0, sourceSegmentIds: [SEGMENT_A] },
    { quote: "你可以直接这样说", englishMeaning: "You can say it this way.", timestampSeconds: 2, sourceSegmentIds: [SEGMENT_B] },
  ],
};

const gatewayOverview = {
  overview: validOverview.overview,
  chapters: validOverview.chapters.map((chapter) => ({
    title: chapter.title,
    summary: chapter.summary,
    sourceLineIndex: 0,
  })),
  keyQuotes: validOverview.keyQuotes.map((quote, index) => ({
    quote: quote.quote,
    englishMeaning: quote.englishMeaning,
    sourceLineIndex: index < 2 ? 0 : 1,
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

function textCompletionResponse(content: string): Response {
  return jsonResponse({ choices: [{ message: { role: "assistant", content } }] });
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
  test("sends all 815 complete captions once in global order through one bounded Overview request", async () => {
    const representativeEvidence: LearningArtifactEvidence = {
      ...evidence,
      segments: Array.from({ length: 815 }, (_, index) => ({
        stableId: index.toString(16).padStart(64, "0"),
        originalChinese: `第${index + 1}条中文内容。`,
        startSeconds: 10_000.125 + index * 2,
        endSeconds: 10_000.875 + index * 2,
      })),
    };
    const fetchImpl = vi.fn<typeof fetch>(async () => completionResponse({
      overview: "A complete overview of the native Chinese transcript.",
      chapters: [{
        title: "Opening",
        summary: "The video begins with the first caption.",
        sourceLineIndex: 0,
      }],
      keyQuotes: [
        { quote: "第1条中文内容。", englishMeaning: "The first Chinese caption.", sourceLineIndex: 0 },
        { quote: "第2条中文内容。", englishMeaning: "The second Chinese caption.", sourceLineIndex: 1 },
        { quote: "第815条中文内容。", englishMeaning: "The final Chinese caption.", sourceLineIndex: 814 },
      ],
    }));
    const provider = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl,
    });

    const content = await provider.generateOverview(representativeEvidence);

    expect(validateOverviewContent(content, representativeEvidence)).toEqual(content);
    expect(content).toMatchObject({
      chapters: [{
        timestampSeconds: representativeEvidence.segments[0].startSeconds,
        sourceSegmentIds: [representativeEvidence.segments[0].stableId],
      }],
      keyQuotes: [
        {
          timestampSeconds: representativeEvidence.segments[0].startSeconds,
          sourceSegmentIds: [representativeEvidence.segments[0].stableId],
        },
        {
          timestampSeconds: representativeEvidence.segments[1].startSeconds,
          sourceSegmentIds: [representativeEvidence.segments[1].stableId],
        },
        {
          timestampSeconds: representativeEvidence.segments[814].startSeconds,
          sourceSegmentIds: [representativeEvidence.segments[814].stableId],
        },
      ],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const requestBody = String(fetchImpl.mock.calls[0][1]?.body);
    expect(new TextEncoder().encode(requestBody).byteLength).toBeLessThan(65_536);
    expect(requestBody.match(/"max_tokens":/gu)).toHaveLength(1);
    const parsedBody = JSON.parse(requestBody) as {
      max_tokens?: number;
      messages: { role: string; content: string }[];
    };
    expect(parsedBody.max_tokens).toBe(900);
    const userPrompt = parsedBody.messages.find(({ role }) => role === "user")?.content;
    expect(userPrompt).toBeDefined();
    const promptData = JSON.parse(userPrompt?.split("\nTreat every string")[0] ?? "null") as {
      sourceLines: { sourceLineIndex: number; originalChinese: string }[];
    };
    expect(promptData.sourceLines).toHaveLength(815);
    representativeEvidence.segments.forEach((segment, sourceLineIndex) => {
      expect(promptData.sourceLines[sourceLineIndex]).toEqual({
        sourceLineIndex,
        originalChinese: segment.originalChinese,
      });
      expect(userPrompt?.split(segment.originalChinese)).toHaveLength(2);
      expect(requestBody).not.toContain(segment.stableId);
      expect(requestBody).not.toContain(String(segment.startSeconds));
      expect(requestBody).not.toContain(String(segment.endSeconds));
    });
    expect(requestBody).not.toContain(USER_A);
    expect(requestBody).not.toContain(SOURCE_ID);
    expect(requestBody).not.toContain(SNAPSHOT_ID);
    expect(requestBody).not.toContain("startSeconds");
    expect(requestBody).not.toContain("endSeconds");
  });

  test("maps each global Overview line to its one persisted stable ID and real start time", async () => {
    const gappedEvidence: LearningArtifactEvidence = {
      ...evidence,
      segments: [
        { stableId: SEGMENT_A, originalChinese: "第一句在开头。", startSeconds: 0, endSeconds: 1 },
        { stableId: SEGMENT_B, originalChinese: "第二句在空档之后。", startSeconds: 12.5, endSeconds: 13.25 },
        { stableId: "c".repeat(64), originalChinese: "第三句在更晚的时候。", startSeconds: 48, endSeconds: 49 },
      ],
    };
    const fetchImpl = vi.fn<typeof fetch>(async () => completionResponse({
      overview: "A complete overview grounded to the timed Chinese captions.",
      chapters: [{
        title: "The middle caption",
        summary: "The chapter starts after a real timestamp gap.",
        sourceLineIndex: 1,
      }],
      keyQuotes: [
        { quote: "第一句在开头。", englishMeaning: "The first sentence is at the beginning.", sourceLineIndex: 0 },
        { quote: "第二句在空档之后。", englishMeaning: "The second sentence follows the gap.", sourceLineIndex: 1 },
        { quote: "第三句在更晚的时候。", englishMeaning: "The third sentence comes later.", sourceLineIndex: 2 },
      ],
    }));
    const provider = createOpenAiCompatibleLearningArtifactProvider({ config: RUNTIME_CONFIG, fetchImpl });

    const content = await provider.generateOverview(gappedEvidence);
    const grounded = validateOverviewContent(content, gappedEvidence);

    expect(grounded.chapters[0].sourceSegmentIds).toEqual([SEGMENT_B]);
    expect(grounded.keyQuotes.map((quote) => quote.sourceSegmentIds)).toEqual([
      [SEGMENT_A],
      [SEGMENT_B],
      ["c".repeat(64)],
    ]);
    expect(grounded.chapters[0].timestampSeconds).toBe(12.5);
    expect(grounded.keyQuotes.map((quote) => quote.timestampSeconds)).toEqual([0, 12.5, 48]);
    expect(grounded).toEqual(content);
    const requestBody = String(fetchImpl.mock.calls[0][1]?.body);
    const parsedBody = JSON.parse(requestBody) as {
      messages: { role: string; content: string }[];
    };
    const userPrompt = parsedBody.messages.find(({ role }) => role === "user")?.content;
    const promptData = JSON.parse(userPrompt?.split("\nTreat every string")[0] ?? "null") as {
      sourceLines: { sourceLineIndex: number; originalChinese: string }[];
    };
    expect(promptData.sourceLines).toEqual([
      { sourceLineIndex: 0, originalChinese: "第一句在开头。" },
      { sourceLineIndex: 1, originalChinese: "第二句在空档之后。" },
      { sourceLineIndex: 2, originalChinese: "第三句在更晚的时候。" },
    ]);
    expect(requestBody).not.toContain("12.5");
    expect(requestBody).not.toContain("13.25");
    expect(requestBody).not.toContain("48-49");
    expect(requestBody).not.toContain(SEGMENT_A);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("encodes embedded newlines and escapes as one lossless physical record per segment", async () => {
    const multilineChinese = `第一行
第二行\\路径说"你好"`;
    const multilineEvidence: LearningArtifactEvidence = {
      ...evidence,
      segments: [
        {
          stableId: SEGMENT_A,
          originalChinese: multilineChinese,
          startSeconds: 7.25,
          endSeconds: 9,
        },
        {
          stableId: SEGMENT_B,
          originalChinese: "第三行保持完整。",
          startSeconds: 12,
          endSeconds: 14,
        },
      ],
    };
    const fetchImpl = vi.fn<typeof fetch>(async () => completionResponse({
      overview: "A concise overview of the multiline transcript.",
      chapters: [{
        title: "Multiline opening",
        summary: "The opening segment spans preserved source lines.",
        sourceLineIndex: 0,
      }],
      keyQuotes: [
        { quote: "第二行", englishMeaning: "The second source line.", sourceLineIndex: 0 },
        { quote: "路径说\"你好\"", englishMeaning: "The path says hello.", sourceLineIndex: 0 },
        { quote: "第三行保持完整", englishMeaning: "The third line remains complete.", sourceLineIndex: 1 },
      ],
    }));
    const provider = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl,
    });

    const content = await provider.generateOverview(multilineEvidence);

    expect(content).toMatchObject({
      chapters: [{ timestampSeconds: 7.25, sourceSegmentIds: [SEGMENT_A] }],
      keyQuotes: [
        { timestampSeconds: 7.25, sourceSegmentIds: [SEGMENT_A] },
        { timestampSeconds: 7.25, sourceSegmentIds: [SEGMENT_A] },
        { timestampSeconds: 12, sourceSegmentIds: [SEGMENT_B] },
      ],
    });
    expect(validateOverviewContent(content, multilineEvidence)).toEqual(content);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const requestBody = String(fetchImpl.mock.calls[0][1]?.body);
    expect(new TextEncoder().encode(requestBody).byteLength).toBeLessThan(65_536);
    const parsedBody = JSON.parse(requestBody) as {
      max_tokens?: number;
      messages: { role: string; content: string }[];
    };
    expect(parsedBody.max_tokens).toBe(900);
    const userPrompt = parsedBody.messages.find(({ role }) => role === "user")?.content;
    const promptData = JSON.parse(userPrompt?.split("\nTreat every string")[0] ?? "null") as {
      sourceLines: { sourceLineIndex: number; originalChinese: string }[];
    };
    expect(promptData.sourceLines).toEqual(multilineEvidence.segments.map((segment, sourceLineIndex) => ({
      sourceLineIndex,
      originalChinese: segment.originalChinese,
    })));
    expect(requestBody).not.toContain(SEGMENT_A);
    expect(requestBody).not.toContain(SEGMENT_B);
    expect(requestBody).not.toContain("7.25");
  });

  test("accepts only unfenced JSON-free plain prose as summary-only Overview content", async () => {
    const prose = "The speaker explains how to use a natural Mandarin expression in conversation.";
    const plainFetch = vi.fn<typeof fetch>(async () => textCompletionResponse(prose));
    const plainProvider = createOpenAiCompatibleLearningArtifactProvider({ config: RUNTIME_CONFIG, fetchImpl: plainFetch });

    await expect(plainProvider.generateOverview(evidence)).resolves.toEqual({
      overview: prose,
      chapters: [],
      keyQuotes: [],
    });
    expect(plainFetch).toHaveBeenCalledTimes(1);

    const fencedFetch = vi.fn<typeof fetch>(async () => textCompletionResponse(`\`\`\`markdown\n${prose}\n\`\`\``));
    const fencedProvider = createOpenAiCompatibleLearningArtifactProvider({ config: RUNTIME_CONFIG, fetchImpl: fencedFetch });
    await expectGatewayCode(fencedProvider.generateOverview(evidence), "PROVIDER_OUTPUT_INVALID");
    expect(fencedFetch).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["tilde-fenced prose", "~~~markdown\nA summary.\n~~~"],
    ["a broken JSON fragment", `"overview":"A summary."}`],
  ])("rejects %s at Overview output parsing", async (_label, malformed) => {
    const malformedFetch = vi.fn<typeof fetch>(async () => textCompletionResponse(malformed));
    const malformedProvider = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl: malformedFetch,
    });

    await expect(malformedProvider.generateOverview(evidence)).rejects.toMatchObject({
      code: "PROVIDER_OUTPUT_INVALID",
      stage: "json_extract",
    });
    expect(malformedFetch).toHaveBeenCalledTimes(1);
  });

  test("retains a JSON summary and only independently valid grounded optional items", async () => {
    const provider = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl: vi.fn(async () => completionResponse({
        overview: "The speaker demonstrates a natural phrase and a direct way to say it.",
        ignored: "unknown fields do not invalidate the summary",
        chapters: [
          {
            title: "Natural phrasing",
            summary: "The first line evaluates an expression.",
            sourceLineIndex: 0,
            confidence: 0.91,
          },
          { title: "Missing summary", sourceLineIndex: 1 },
          { title: "Out of range", summary: "This anchor does not exist.", sourceLineIndex: 20 },
          "not an object",
        ],
        keyQuotes: [
          { quote: "这个表达", englishMeaning: "This expression.", sourceLineIndex: 0, confidence: 0.94 },
          { quote: "完全无关", englishMeaning: "Ungrounded text.", sourceLineIndex: 0 },
          { quote: "很自然", sourceLineIndex: 0 },
        ],
      })),
    });

    await expect(provider.generateOverview(evidence)).resolves.toEqual({
      overview: "The speaker demonstrates a natural phrase and a direct way to say it.",
      chapters: [{
        title: "Natural phrasing",
        summary: "The first line evaluates an expression.",
        timestampSeconds: 0,
        sourceSegmentIds: [SEGMENT_A],
      }],
      keyQuotes: [{
        quote: "这个表达",
        englishMeaning: "This expression.",
        timestampSeconds: 0,
        sourceSegmentIds: [SEGMENT_A],
      }],
    });
  });

  test.each([
    ["wrong", 1],
    ["missing", undefined],
    ["null", null],
    ["string", "0"],
    ["negative", -1],
  ])("drops a quote with a %s line index instead of recovering it by text", async (_label, sourceLineIndex) => {
    const provider = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl: vi.fn(async () => completionResponse({
        overview: "The speaker describes a natural expression.",
        chapters: [],
        keyQuotes: [{ quote: "这个表达", englishMeaning: "This expression.", sourceLineIndex }],
      })),
    });

    await expect(provider.generateOverview(evidence)).resolves.toMatchObject({ keyQuotes: [] });
  });

  test("fails when parseable JSON has no usable overview without exposing Provider text", async () => {
    const secretText = "private provider response";
    const provider = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl: vi.fn(async () => completionResponse({ overview: "  ", detail: secretText })),
    });

    await provider.generateOverview(evidence).catch((error: unknown) => {
      expect(error).toMatchObject({ code: "PROVIDER_OUTPUT_INVALID" });
      expect(String(error)).not.toContain(secretText);
    });
  });

  test("accepts one structured translation group larger than four through Provider and artifact schemas", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completionResponse({
      translations: BULK_SEGMENT_IDS.map((_id, sourceLineIndex) => ({
        sourceLineIndex,
        english: `Complete English sentence ${sourceLineIndex + 1}.`,
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
      translations: [{ sourceLineIndex: 0, english: "You can say it exactly this way." }],
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
    expect(requestBody.max_tokens).toBe(800);
    expect(requestBody.model).toBe("mandarin-model");
    expect(requestBody.messages).toHaveLength(2);
    expect(requestBody.messages.map((message: { role: string }) => message.role)).toEqual([
      "system",
      "user",
    ]);
    const outbound = JSON.stringify(requestBody);
    const userPrompt = requestBody.messages[1].content as string;
    expect(outbound).toContain("你可以直接这样说。");
    expect(userPrompt).not.toContain("startSeconds");
    expect(userPrompt).not.toContain("endSeconds");
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
    expect(bodies[0]).toContain("这个表达很自然。");
    expect(bodies[0]).toContain("你可以直接这样说。");
    expect(bodies[1]).toContain("这个表达");
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
    await expectGatewayCode(
      adapter.translateSegments(evidence, [SEGMENT_B]),
      "PROVIDER_UNAVAILABLE",
    );
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
    await expectGatewayCode(
      adapter.translateSegments(evidence, [SEGMENT_B]),
      "PROVIDER_UNAVAILABLE",
    );
  });

  test("gives an Overview its separate timeout budget while translations keep the generic timeout", async () => {
    const delayedOverviewResponse = vi.fn((_url: URL | RequestInfo, options?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("private timeout detail")));
        setTimeout(() => resolve(completionResponse(gatewayOverview)), 10);
      }));
    const overviewOptions = {
      config: RUNTIME_CONFIG,
      fetchImpl: delayedOverviewResponse,
      timeoutMs: 5,
      overviewTimeoutMs: 25,
    } as Parameters<typeof createOpenAiCompatibleLearningArtifactProvider>[0];
    const provider = createOpenAiCompatibleLearningArtifactProvider(overviewOptions);

    await expect(provider.generateOverview(evidence)).resolves.toEqual(validOverview);

    const delayedTranslationResponse = vi.fn((_url: URL | RequestInfo, options?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("private timeout detail")));
        setTimeout(() => resolve(completionResponse({
          translations: [{ sourceLineIndex: 0, english: "You can say it exactly this way." }],
        })), 10);
      }));
    const translationProvider = createOpenAiCompatibleLearningArtifactProvider({
      config: RUNTIME_CONFIG,
      fetchImpl: delayedTranslationResponse,
      timeoutMs: 5,
      overviewTimeoutMs: 25,
    } as Parameters<typeof createOpenAiCompatibleLearningArtifactProvider>[0]);

    await expectGatewayCode(
      translationProvider.translateSegments(evidence, [SEGMENT_B]),
      "PROVIDER_UNAVAILABLE",
    );
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
      adapter.translateSegments(evidence, [SEGMENT_B]).catch((error: unknown) => error),
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
        translations: [{ sourceLineIndex: 1, english: "Wrong evidence." }],
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
    resolveActiveGatewayPin: vi.fn(async (userId) => userId === USER_A ? {
      ...GATEWAY_PIN,
      model: "mandarin-model",
    } : null),
    resolveEvidence: vi.fn(async (userId, videoId) =>
      userId === USER_A && videoId === evidence.videoId ? evidence : null),
    register: vi.fn(async () => ({ jobId: JOB_ID, status: "pending", created: true })),
    readFailureCategory: vi.fn(async () => null),
    readArtifactByResultKey: vi.fn(async () => null),
    readArtifact: vi.fn(async () => null),
    ...overrides,
  };
}

describe("fast durable learning-artifact request routes", () => {
  test.each([
    ["generate_overview", "youtube-overview-v4-simple", validOverview],
    ["generate_overview", "youtube-overview-v5-structured", validOverview],
    ["translate_segments", "translate-segments-v1", { segments: [
      { id: SEGMENT_A, english: "This expression sounds natural." },
      { id: SEGMENT_B, english: "You can say it exactly this way." },
    ] }],
    ["translate_segments", "translate-segments-v2", { segments: [
      { id: SEGMENT_A, english: "This expression sounds natural." },
      { id: SEGMENT_B, english: "You can say it exactly this way." },
    ] }],
    ["explain_selection", "explain-selection-v1", {
      selectedChinese: "这个表达", meaning: "this expression", tone: "neutral and conversational",
      communicativeFunction: "refers back to a phrase under discussion",
      contextualFit: "It fits because the speaker is evaluating how the phrase sounds.",
    }],
    ["explain_selection", "explain-selection-v2", {
      selectedChinese: "这个表达", meaning: "this expression", tone: "neutral and conversational",
      communicativeFunction: "refers back to a phrase under discussion",
      contextualFit: "It fits because the speaker is evaluating how the phrase sounds.",
    }],
  ] as const)("%s reuses compatible %s strict artifacts before registration", async (jobType, historicalVersion, content) => {
    const dedupePayload = jobType === "generate_overview"
      ? { snapshotId: SNAPSHOT_ID }
      : jobType === "translate_segments"
        ? { snapshotId: SNAPSHOT_ID, segmentIds: [SEGMENT_A, SEGMENT_B] }
        : bodyFor("explain_selection");
    const resultKey = createLearningArtifactJobKey(
      jobType,
      evidence.transcriptHash,
      dedupePayload,
      historicalVersion,
      GATEWAY_FINGERPRINT,
    );
    const store = routeStore({
      readArtifactByResultKey: vi.fn(async (_userId, _sourceId, _jobType, key) => key === resultKey ? {
        artifactId: ARTIFACT_ID,
        userId: USER_A,
        sourceId: SOURCE_ID,
        savedItemId: null,
        artifactType: jobType === "generate_overview" ? "overview" : jobType === "translate_segments" ? "segment_translation" : "selection_explanation",
        promptVersion: historicalVersion,
        model: "mandarin-model",
        resultKey,
        content,
      } : null),
    });
    const route = createLearningArtifactRoute({
      jobType,
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: jobType === "generate_overview"
        ? "youtube-overview-v5-structured"
        : jobType === "translate_segments"
          ? "translate-segments-v2"
          : "explain-selection-v2",
      requestId: () => "compatible-history",
    });
    const response = await route(new Request(
      jobType === "explain_selection"
        ? "https://app.popcorn.local/api/v1/explanations"
        : `https://app.popcorn.local/api/v1/youtube/abc123XYZ00/${jobType}`,
      { method: "POST", body: JSON.stringify(bodyFor(jobType)) },
    ), { params: Promise.resolve(jobType === "explain_selection" ? {} : { videoId: "abc123XYZ00" }) });

    expect(response.status).toBe(200);
    expect(store.register).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ ok: true, data: { artifactId: ARTIFACT_ID, content } });
  });

  test("checks compatible Overview result keys newest first and stops after the current hit", async () => {
    const currentKey = createLearningArtifactJobKey(
      "generate_overview", evidence.transcriptHash, { snapshotId: SNAPSHOT_ID },
      "youtube-overview-v5-structured", GATEWAY_FINGERPRINT,
    );
    const readArtifactByResultKey = vi.fn(async (_userId, _sourceId, _jobType, resultKey) => ({
      artifactId: ARTIFACT_ID, userId: USER_A, sourceId: SOURCE_ID, savedItemId: null,
      artifactType: "overview", promptVersion: "youtube-overview-v5-structured",
      model: "mandarin-model", resultKey, content: validOverview,
    }));
    const store = routeStore({ readArtifactByResultKey });
    const route = createLearningArtifactRoute({
      jobType: "generate_overview", authenticate: async () => ({ userId: USER_A }), store,
      promptVersion: "youtube-overview-v5-structured", requestId: () => "newest-first",
    });

    const response = await route(new Request(
      "https://app.popcorn.local/api/v1/youtube/abc123XYZ00/overview",
      { method: "POST", body: JSON.stringify(bodyFor("generate_overview")) },
    ), { params: Promise.resolve({ videoId: "abc123XYZ00" }) });

    expect(response.status).toBe(200);
    expect(readArtifactByResultKey).toHaveBeenCalledExactlyOnceWith(
      USER_A, SOURCE_ID, "generate_overview", currentKey,
    );
    expect(store.register).not.toHaveBeenCalled();
  });

  test.each([
    ["unknown prompt", { promptVersion: "youtube-overview-v999" }],
    ["wrong owner", { userId: USER_B }],
    ["wrong source", { sourceId: "20000000-0000-4000-8000-000000000099" }],
    ["wrong model", { model: "different-model" }],
    ["wrong result key", { resultKey: "9".repeat(64) }],
    ["invalid current domain content", { content: { overview: "Not a complete domain artifact." } }],
  ] as const)("does not reuse a historical Overview with %s", async (_label, override) => {
    const historicalVersion = "youtube-overview-v4-simple";
    const resultKey = createLearningArtifactJobKey(
      "generate_overview", evidence.transcriptHash, { snapshotId: SNAPSHOT_ID },
      historicalVersion, GATEWAY_FINGERPRINT,
    );
    const store = routeStore({
      readArtifactByResultKey: vi.fn(async () => ({
        artifactId: ARTIFACT_ID, userId: USER_A, sourceId: SOURCE_ID, savedItemId: null,
        artifactType: "overview", promptVersion: historicalVersion, model: "mandarin-model",
        resultKey, content: validOverview, ...override,
      })),
    });
    const route = createLearningArtifactRoute({
      jobType: "generate_overview", authenticate: async () => ({ userId: USER_A }), store,
      promptVersion: "youtube-overview-v5-structured", requestId: () => "closed-history",
    });

    const response = await route(new Request(
      "https://app.popcorn.local/api/v1/youtube/abc123XYZ00/overview",
      { method: "POST", body: JSON.stringify(bodyFor("generate_overview")) },
    ), { params: Promise.resolve({ videoId: "abc123XYZ00" }) });

    expect(response.status).toBe(202);
    expect(store.register).toHaveBeenCalledTimes(1);
  });

  test("translation completion recovery rejects an artifact whose stored prompt_version is unknown", async () => {
    const currentResultKey = createLearningArtifactJobKey(
      "translate_segments",
      evidence.transcriptHash,
      { snapshotId: SNAPSHOT_ID, segmentIds: [SEGMENT_A] },
      "translate-segments-v2",
      GATEWAY_FINGERPRINT,
    );
    const store = routeStore({
      register: vi.fn(async () => ({ jobId: JOB_ID, status: "succeeded", created: false })),
      readArtifact: vi.fn(async () => ({
        artifactId: ARTIFACT_ID, userId: USER_A, sourceId: SOURCE_ID, savedItemId: null,
        artifactType: "segment_translation", promptVersion: "translate-segments-v999",
        model: "mandarin-model", resultKey: currentResultKey,
        content: { segments: [{ id: SEGMENT_A, english: "This expression sounds natural." }] },
      })),
    });
    const route = createLearningArtifactRoute({
      jobType: "translate_segments", authenticate: async () => ({ userId: USER_A }), store,
      promptVersion: "translate-segments-v2", requestId: () => "translation-recovery-version",
    });

    await expect(route(new Request(
      "https://app.popcorn.local/api/v1/youtube/abc123XYZ00/translations",
      { method: "POST", body: JSON.stringify({ snapshotId: SNAPSHOT_ID, segmentIds: [SEGMENT_A] }) },
    ), { params: Promise.resolve({ videoId: "abc123XYZ00" }) })).rejects.toMatchObject({
      name: "ModelGatewayError",
      message: "PROVIDER_OUTPUT_INVALID",
      code: "PROVIDER_OUTPUT_INVALID",
      stage: "grounding",
    });
    expect(store.register).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      dedupeKey: currentResultKey,
    }));
    expect(store.readArtifact).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      JOB_ID,
      SOURCE_ID,
      "translate_segments",
    );
  });

  test("an Overview retry UUID changes only its semantic dedupe identity", async () => {
    const store = routeStore();
    const route = createLearningArtifactRoute({
      jobType: "generate_overview",
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: YOUTUBE_OVERVIEW_PROMPT_VERSION,
      requestId: () => "request-overview-retry",
    });
    const submit = (retryId?: string) => route(new Request(
      "https://app.popcorn.local/api/v1/youtube/abc123XYZ00/overview",
      {
        method: "POST",
        body: JSON.stringify({ snapshotId: SNAPSHOT_ID, ...(retryId ? { retryId } : {}) }),
      },
    ), { params: Promise.resolve({ videoId: "abc123XYZ00" }) });

    const original = await submit();
    const firstRetry = await submit("70000000-0000-4000-8000-000000000001");
    const secondRetry = await submit("70000000-0000-4000-8000-000000000002");

    expect([original.status, firstRetry.status, secondRetry.status]).toEqual([202, 202, 202]);
    const registrations = vi.mocked(store.register).mock.calls.map(([registration]) => registration);
    expect(new Set(registrations.map(({ dedupeKey }) => dedupeKey)).size).toBe(3);
    expect(registrations.map(({ input }) => input)).toEqual([
      registrations[0].input,
      registrations[0].input,
      registrations[0].input,
    ]);
    expect(JSON.stringify(registrations[0].input)).not.toContain("retryId");
    expect(registrations[0].input.promptVersion).toBe("youtube-overview-v5-structured");
  });

  test("a retry UUID changes only translation dedupe identity and is absent from private Provider input", async () => {
    const store = routeStore({
      resolveEvidence: vi.fn(async () => bulkEvidence),
    });
    const route = createLearningArtifactRoute({
      jobType: "translate_segments",
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: "translate-segments-v2",
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

  test("an Explanation retry UUID changes only dedupe identity and never enters private Provider input", async () => {
    const store = routeStore();
    const route = createLearningArtifactRoute({
      jobType: "explain_selection",
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: "explain-selection-v2",
      requestId: () => "explanation-retry",
    });
    const submit = (retryId?: string) => route(new Request(
      "https://app.popcorn.local/api/v1/explanations",
      {
        method: "POST",
        body: JSON.stringify({
          ...(bodyFor("explain_selection") as object),
          ...(retryId ? { retryId } : {}),
        }),
      },
    ), { params: Promise.resolve({}) });

    const original = await submit();
    const replay = await submit("70000000-0000-4000-8000-000000000001");
    const fresh = await submit("70000000-0000-4000-8000-000000000002");

    expect([original.status, replay.status, fresh.status]).toEqual([202, 202, 202]);
    const registrations = vi.mocked(store.register).mock.calls.map(([registration]) => registration);
    expect(new Set(registrations.map(({ dedupeKey }) => dedupeKey)).size).toBe(3);
    expect(registrations.map(({ input }) => input)).toEqual([
      registrations[0].input,
      registrations[0].input,
      registrations[0].input,
    ]);
    expect(registrations[0].input).not.toHaveProperty("retryId");
    expect(JSON.stringify(registrations[0].input)).not.toContain("70000000-0000-4000-8000");
  });

  test("an already-terminal Explanation registration returns its bounded public failure instead of processing", async () => {
    const readFailureCategory = vi.fn(async () => "model_output" as const);
    const store = routeStore({
      register: vi.fn(async () => ({ jobId: JOB_ID, status: "terminal_failed", created: false })),
      readFailureCategory,
    });
    const route = createLearningArtifactRoute({
      jobType: "explain_selection",
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: "explain-selection-v2",
      requestId: () => "terminal-explanation",
    });

    const response = await route(new Request(
      "https://app.popcorn.local/api/v1/explanations",
      { method: "POST", body: JSON.stringify(bodyFor("explain_selection")) },
    ), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(readFailureCategory).toHaveBeenCalledExactlyOnceWith(USER_A, JOB_ID);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      data: {
        jobId: JOB_ID,
        status: "terminal_failed",
        failureCategory: "model_output",
      },
      requestId: "terminal-explanation",
    });
    expect(JSON.stringify(payload)).not.toContain("lastError");
  });

  test.each([
    ["generate_overview", "overview", "youtube-overview-v5-structured"],
    ["translate_segments", "translation", "translate-segments-v2"],
    ["explain_selection", "explanation", "explain-selection-v2"],
  ] as const)("%s pins the authenticated owner's gateway and returns 202 before runtime resolution", async (jobType, path, latestVersion) => {
    const store = routeStore();
    const route = createLearningArtifactRoute({
      jobType,
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: latestVersion,
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
      promptVersion: latestVersion,
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
      promptVersion: Array.isArray((body as { segmentIds?: unknown }).segmentIds)
        ? "translate-segments-v2"
        : "youtube-overview-v5-structured",
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
      promptVersion: "explain-selection-v2",
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
      promptVersion: "explain-selection-v2",
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

  test("successful same-video same-snapshot replay reuses the deduplicated artifact without a new Provider job", async () => {
    const content = validOverview;
    const resultKey = createLearningArtifactJobKey(
      "generate_overview", evidence.transcriptHash, { snapshotId: SNAPSHOT_ID },
      "youtube-overview-v5-structured", GATEWAY_FINGERPRINT,
    );
    const store = routeStore({
      register: vi.fn(async () => ({ jobId: JOB_ID, status: "succeeded", created: false })),
      readArtifact: vi.fn(async (userId) => userId === USER_A ? {
        artifactId: ARTIFACT_ID, userId: USER_A, sourceId: SOURCE_ID, savedItemId: null,
        artifactType: "overview", promptVersion: "youtube-overview-v5-structured", model: "mandarin-model",
        resultKey, content,
      } : null),
    });
    const route = createLearningArtifactRoute({
      jobType: "generate_overview",
      authenticate: async () => ({ userId: USER_A }),
      store,
      promptVersion: "youtube-overview-v5-structured",
      requestId: () => "request-4",
    });
    const request = () => route(new Request("https://app.popcorn.local/api/v1/youtube/abc123XYZ00/overview", {
      method: "POST", body: JSON.stringify(bodyFor("generate_overview")),
    }), { params: Promise.resolve({ videoId: "abc123XYZ00" }) });
    const first = await request();
    const second = await request();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(store.register).toHaveBeenCalledTimes(2);
    expect(store.readArtifact).toHaveBeenCalledTimes(2);
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
        promptVersion: "youtube-overview-v5-structured",
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

  test("invalid Provider output terminalizes with a safe stage and never completes", async () => {
    const job = leasedJob("translate_segments");
    const store = handlerStore(privateInput("translate_segments", "translation-v1"));
    const badProvider = { ...provider, translateSegments: vi.fn(async () => ({ segments: [{ id: "unknown", english: "Wrong." }] })) };
    const handler = createTranslateSegmentsHandler({ store, providerResolver: {
      resolve: vi.fn(async () => ({ provider: badProvider, model: "mandarin-model" })),
    } });
    await expect(handler(job, USER_A, NOW)).resolves.toBe("failed");
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A,
      job,
      expect.objectContaining({
        status: "terminal_failed",
        lastErrorCode: "PROVIDER_OUTPUT_INVALID:grounding",
      }),
      true,
    );
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
  });

  test.each([
    ["PROVIDER_OUTPUT_INVALID", new ModelGatewayError("PROVIDER_OUTPUT_INVALID")],
    ["PROVIDER_UNAVAILABLE", new ModelGatewayError("PROVIDER_UNAVAILABLE")],
  ] as const)("the first Overview %s failure is terminal with a safe stage and atomically clears input", async (_code, failure) => {
    const job = leasedJob("generate_overview");
    const store = handlerStore(privateInput("generate_overview", "overview-v1"));
    const badProvider = { ...provider, generateOverview: vi.fn(async () => { throw failure; }) };
    const handler = createGenerateOverviewHandler({ store, providerResolver: {
      resolve: vi.fn(async () => ({ provider: badProvider, model: "mandarin-model" })),
    } });
    await expect(handler(job, USER_A, NOW)).resolves.toBe("failed");
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A,
      job,
      expect.objectContaining({
        status: "terminal_failed",
        lastErrorCode: `${failure.code}:${failure.stage}`,
      }),
      true,
    );
    expect(badProvider.generateOverview).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["translation", "translate_segments", createTranslateSegmentsHandler, "translateSegments"],
    ["explanation", "explain_selection", createExplainSelectionHandler, "explainSelection"],
  ] as const)("%s terminalizes after the Provider exhausts its short transport retry", async (_label, type, factory, method) => {
    const job = leasedJob(type);
    const store = handlerStore(privateInput(type, `${type}-v1`));
    const badProvider = {
      ...provider,
      [method]: vi.fn(async () => { throw new ModelGatewayError("PROVIDER_UNAVAILABLE"); }),
    } as LearningArtifactProvider;
    const handler = factory({ store, providerResolver: {
      resolve: vi.fn(async () => ({ provider: badProvider, model: "mandarin-model" })),
    } });

    await expect(handler(job, USER_A, NOW)).resolves.toBe("failed");
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A,
      job,
      expect.objectContaining({
        status: "terminal_failed",
        lastErrorCode: "PROVIDER_UNAVAILABLE:transport",
      }),
      true,
    );
  });

  test.each([
    ["overview private-input", "generate_overview", createGenerateOverviewHandler, "private_input"],
    ["overview evidence", "generate_overview", createGenerateOverviewHandler, "evidence"],
    ["translation private-input", "translate_segments", createTranslateSegmentsHandler, "private_input"],
    ["translation evidence", "translate_segments", createTranslateSegmentsHandler, "evidence"],
    ["explanation private-input", "explain_selection", createExplainSelectionHandler, "private_input"],
    ["explanation evidence", "explain_selection", createExplainSelectionHandler, "evidence"],
  ] as const)("%s read failure terminalizes as internal without invoking the model", async (_label, type, factory, failingRead) => {
    const job = leasedJob(type);
    const input = privateInput(type, `${type}-v1`);
    const store = handlerStore(input, failingRead === "private_input"
      ? { readPrivateInput: vi.fn(async () => { throw new Error("private database detail"); }) }
      : { readLearningArtifactEvidence: vi.fn(async () => { throw new Error("private database detail"); }) });
    const resolver = {
      resolve: vi.fn(async () => ({ provider, model: "mandarin-model" })),
    };
    const handler = factory({ store, providerResolver: resolver });

    await expect(handler(job, USER_A, NOW)).resolves.toBe("failed");
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A,
      job,
      expect.objectContaining({
        status: "terminal_failed",
        lastErrorCode: "INTERNAL:persistence",
        nextAttemptAt: null,
      }),
      true,
    );
    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
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

  test("Overview revocation before fetch performs zero network and terminalizes through the frozen transition", async () => {
    const job = leasedJob("generate_overview");
    const store = handlerStore(privateInput("generate_overview", "overview-v1"));
    const fetchProbe = vi.fn();
    const revokedResolver = {
      resolve: vi.fn(async () => {
        throw new ModelGatewayError("PROVIDER_UNAVAILABLE");
      }),
    };

    await expect(createGenerateOverviewHandler({ store, providerResolver: revokedResolver })(job, USER_A, NOW)).resolves.toBe("failed");
    expect(fetchProbe).not.toHaveBeenCalled();
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A,
      job,
      expect.objectContaining({ status: "terminal_failed", lastErrorCode: "PROVIDER_UNAVAILABLE:transport" }),
      true,
    );
  });

  test("tampered explanation context fails before runtime provider resolution", async () => {
    const job = leasedJob("explain_selection");
    const store = handlerStore({
      ...privateInput("explain_selection", "explain-v1"),
      context: "这个表达不自然。",
    });
    const resolver = { resolve: vi.fn() };

    await expect(createExplainSelectionHandler({ store, providerResolver: resolver })(job, USER_A, NOW)).resolves.toBe("failed");

    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A,
      job,
      expect.objectContaining({
        status: "terminal_failed",
        lastErrorCode: "PROVIDER_OUTPUT_INVALID:grounding",
      }),
      true,
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

  test("accepts empty optional arrays while malformed present items still fail", () => {
    const summaryOnly = { overview: validOverview.overview, chapters: [], keyQuotes: [] };
    expect(validateOverviewContent(summaryOnly, evidence)).toEqual(summaryOnly);
    expect(() => validateOverviewContent({
      ...summaryOnly,
      chapters: [{ title: "Broken", summary: "Missing evidence anchor." }],
    }, evidence)).toThrow();
    expect(() => validateOverviewContent({
      ...summaryOnly,
      keyQuotes: [{
        quote: "这个表达",
        englishMeaning: "This expression.",
        timestampSeconds: 0,
        sourceSegmentIds: ["d".repeat(64)],
      }],
    }, evidence)).toThrow();
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

  test("terminal registration category is derived from the owner-scoped public job seam", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: JOB_ID,
        user_id: USER_A,
        status: "terminal_failed",
        last_error_code: "PROVIDER_OUTPUT_INVALID:wire_schema:meaning",
      },
      error: null,
    }));
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle,
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const from = vi.fn(() => query);
    const store = createSupabaseLearningArtifactRouteStore({ from } as never);

    await expect(store.readFailureCategory(USER_A, JOB_ID)).resolves.toBe("model_output");
    expect(from).toHaveBeenCalledExactlyOnceWith("knowledge_jobs");
    expect(query.select).toHaveBeenCalledExactlyOnceWith("id,user_id,status,last_error_code");
    expect(query.eq).toHaveBeenNthCalledWith(1, "user_id", USER_A);
    expect(query.eq).toHaveBeenNthCalledWith(2, "id", JOB_ID);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
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
