import { describe, expect, test, vi } from "vitest";

import { KnowledgeJobSchema, type KnowledgeJob } from "@/contracts/knowledge";
import { ModelGatewayError } from "@/server/ai/provider";
import {
  buildAnalyzeSavedItemPrompt,
  createAnalyzeSavedItemFixtureGateway,
  normalizeSavedItemAnalysisWire,
} from "@/server/ai/prompts/analyze-saved-item.v1";
import {
  createStructuredJsonGatewayResolver,
  type StructuredJsonGateway,
} from "@/server/ai/structured-json-gateway";
import * as processRouteModule from "@/app/api/internal/jobs/process/route";
import { createAnalyzeSavedItemHandler } from "@/server/jobs/handlers/analyze-saved-item";
import {
  createInternalProcessRoute,
  createProcessorHandlers,
  createSupabaseSavedItemAnalysisRegistrar,
  createSupabaseDurableJobStore,
  publicFailureCategory,
  type DurableJobStore,
} from "@/server/jobs/process-jobs";
import {
  createSavedItemAnalysisJobKey,
  SavedItemAnalysisContentSchema,
  type SavedItemAnalysisEvidence,
  groundSavedItemAnalysisContent,
  validateSavedItemAnalysisContent,
} from "@/server/jobs/job-types";

describe("bounded internal knowledge-job endpoint", () => {
  test.each([
    ["terminal_failed", "PROVIDER_OUTPUT_INVALID:wire_schema:candidates.0.expression", "model_output"],
    ["terminal_failed", "PROVIDER_UNAVAILABLE:timeout", "model_unavailable"],
    ["terminal_failed", "INTERNAL:persistence", "internal"],
    ["retryable_failed", "PROVIDER_UNAVAILABLE:transport", "model_unavailable"],
    ["terminal_failed", "PROVIDER_OUTPUT_INVALID", "model_output"],
    ["retryable_failed", "PROVIDER_UNAVAILABLE", "model_unavailable"],
    ["pending", null, null],
  ] as const)(
    "maps %s/%s to the safe public category %s",
    (status, code, expected) => {
      expect(publicFailureCategory(status, code)).toBe(expected);
    },
  );

  test("exports only App Router HTTP entrypoints", () => {
    expect(Object.keys(processRouteModule).sort()).toEqual(["POST"]);
  });

  test("returns 401 instead of rejecting ordinary process environment variables", async () => {
    const originalEnvironment = { ...process.env };
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "inert-service-role";
      process.env.SUPADATA_API_KEY = "inert-supadata-key";
      process.env.INTERNAL_JOB_SECRET = "inert-job-secret";
      process.env.POPCORN_ORDINARY_RUNTIME_VARIABLE = "allowed";

      const response = await processRouteModule.POST(new Request("https://popcorn.test", {
        method: "POST",
      }));

      expect(response.status).toBe(401);
    } finally {
      for (const name of Object.keys(process.env)) {
        if (!(name in originalEnvironment)) delete process.env[name];
      }
      Object.assign(process.env, originalEnvironment);
    }
  });

  test("requires the exact bearer, processes five, and returns counts only", async () => {
    const processBounded = vi.fn(async () => ({
      claimed: 5,
      completed: 2,
      deferred: 2,
      failed: 1,
      providerBody: "must-not-leak",
      apiKey: "must-not-leak",
    }));
    const route = createInternalProcessRoute({
      secret: "internal-secret",
      maxBatchSize: 5,
      processBounded,
    });

    const malformed = await route(new Request("https://popcorn.test", {
      method: "POST",
      headers: { authorization: "Bearer internal-secret extra" },
    }));
    const accepted = await route(new Request("https://popcorn.test", {
      method: "POST",
      headers: { authorization: "Bearer internal-secret" },
      body: JSON.stringify({ limit: 999, providerBody: "client-controlled" }),
    }));

    expect(malformed.status).toBe(401);
    expect(processBounded).toHaveBeenCalledExactlyOnceWith(5);
    expect(await accepted.json()).toEqual({
      ok: true,
      claimed: 5,
      completed: 2,
      deferred: 2,
      failed: 1,
    });
  });
});

const NOW = "2026-08-21T00:00:00.000Z";
const USER_A = "11000000-0000-4000-8000-000000000001";
const USER_B = "11000000-0000-4000-8000-000000000002";
const SOURCE_ID = "12000000-0000-4000-8000-000000000001";
const SAVE_ID = "13000000-0000-4000-8000-000000000001";
const SNAPSHOT_ID = "14000000-0000-4000-8000-000000000001";
const JOB_ID = "15000000-0000-4000-8000-000000000001";
const ARTIFACT_ID = "16000000-0000-4000-8000-000000000001";
const CONFIG_ID = "17000000-0000-4000-8000-000000000001";
const SEGMENT_ID = "a".repeat(64);
const TRANSCRIPT_HASH = "b".repeat(64);
const GATEWAY_FINGERPRINT = "c".repeat(64);
const PIN = { configId: CONFIG_ID, revision: 3, fingerprint: GATEWAY_FINGERPRINT };

function mockGateway(
  model: string,
  complete: ReturnType<typeof vi.fn>,
): StructuredJsonGateway {
  return {
    model,
    complete: complete as unknown as StructuredJsonGateway["complete"],
  };
}

function analysisJob(
  overrides: Partial<KnowledgeJob> = {},
): Extract<KnowledgeJob, { status: "leased" }> {
  const parsed = KnowledgeJobSchema.parse({
    id: JOB_ID,
    userId: USER_A,
    sourceId: SOURCE_ID,
    savedItemId: SAVE_ID,
    type: "analyze_saved_item",
    status: "leased",
    dedupeKey: "d".repeat(64),
    attemptCount: 1,
    nextAttemptAt: null,
    leaseExpiresAt: "2026-08-21T00:05:00.000Z",
    lastErrorCode: null,
    createdAt: "2026-08-20T23:59:00.000Z",
    updatedAt: NOW,
    ...overrides,
  });
  if (parsed.status !== "leased") throw new Error("analysis fixture must stay leased");
  return parsed;
}

const input = {
  kind: "analyze_saved_item" as const,
  savedItemId: SAVE_ID,
  snapshotId: SNAPSHOT_ID,
  transcriptHash: TRANSCRIPT_HASH,
  promptVersion: "analyze-saved-item-v2",
  gatewayConfigId: CONFIG_ID,
  gatewayRevision: 3,
  gatewayFingerprint: GATEWAY_FINGERPRINT,
};

const evidence: SavedItemAnalysisEvidence = {
  userId: USER_A,
  sourceId: SOURCE_ID,
  savedItemId: SAVE_ID,
  snapshotId: SNAPSHOT_ID,
  transcriptHash: TRANSCRIPT_HASH,
  kind: "subtitle_row",
  rawText: "这也太离谱了吧。",
  startSeconds: 10,
  segments: [{
    stableId: SEGMENT_ID,
    originalChinese: "这也太离谱了吧。",
    startSeconds: 10,
    endSeconds: 12,
  }],
};

const candidate = {
  expression: "太离谱了",
  englishMeaning: "That is outrageous.",
  englishExplanation: "A strong informal reaction to something unreasonable.",
  tone: "Strong and informal.",
  communicativeFunction: "Reacting to an unreasonable situation.",
  register: "Informal spoken Mandarin.",
  evidenceText: "这也太离谱了吧。",
  segmentIds: [SEGMENT_ID],
  startSeconds: 10,
  endSeconds: 12,
  confidence: 0.9,
};

const semanticCandidate = {
  expression: candidate.expression,
  englishMeaning: candidate.englishMeaning,
  englishExplanation: candidate.englishExplanation,
  tone: candidate.tone,
  communicativeFunction: candidate.communicativeFunction,
  register: candidate.register,
  sourceLineIndices: [0],
  confidence: candidate.confidence,
};

function terminalFailure(
  job: ReturnType<typeof analysisJob>,
  lastErrorCode: string,
) {
  return {
    ...job,
    status: "terminal_failed" as const,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    lastErrorCode,
    updatedAt: NOW,
  };
}

const fullWidthEvidence: SavedItemAnalysisEvidence = {
  ...evidence,
  rawText: "咖啡Ａ很好！",
  segments: [{
    ...evidence.segments[0],
    originalChinese: "咖啡Ａ很好！",
  }],
};

const orderedEvidence: SavedItemAnalysisEvidence = {
  ...evidence,
  rawText: "你说\n什么呢？",
  segments: [
    {
      stableId: "1".repeat(64),
      originalChinese: "你说",
      startSeconds: 10,
      endSeconds: 11,
    },
    {
      stableId: "2".repeat(64),
      originalChinese: "什么呢？",
      startSeconds: 11,
      endSeconds: 12,
    },
  ],
};

function analysisStore(overrides: Partial<DurableJobStore> = {}) {
  const rawSave = structuredClone({ id: SAVE_ID, payload: { originalChinese: evidence.rawText } });
  return {
    rawSave,
    readPrivateInput: vi.fn(async () => input),
    readSavedItemAnalysisEvidence: vi.fn(async () => evidence),
    transitionLearningArtifactFailure: vi.fn(async () => true),
    completeGatewayLearningArtifact: vi.fn(async () => ARTIFACT_ID),
    ...overrides,
  } as unknown as DurableJobStore & {
    rawSave: { id: string; payload: { originalChinese: string } };
    readPrivateInput: ReturnType<typeof vi.fn>;
    readSavedItemAnalysisEvidence: ReturnType<typeof vi.fn>;
    transitionLearningArtifactFailure: ReturnType<typeof vi.fn>;
    completeGatewayLearningArtifact: ReturnType<typeof vi.fn>;
  };
}

describe("source-grounded saved-item analysis", () => {
  test("derives a stable result key from every immutable analysis input", () => {
    const fields = {
      sourceHash: TRANSCRIPT_HASH,
      savedItemId: SAVE_ID,
      snapshotId: SNAPSHOT_ID,
      promptVersion: "analyze-saved-item-v2",
      gatewayFingerprint: GATEWAY_FINGERPRINT,
    };
    const baseline = createSavedItemAnalysisJobKey(fields);

    expect(createSavedItemAnalysisJobKey({ ...fields })).toBe(baseline);
    for (const changed of [
      { sourceHash: "1".repeat(64) },
      { savedItemId: "23000000-0000-4000-8000-000000000001" },
      { snapshotId: "24000000-0000-4000-8000-000000000001" },
      { promptVersion: "analyze-saved-item-v1" },
      { gatewayFingerprint: "2".repeat(64) },
    ]) {
      expect(createSavedItemAnalysisJobKey({ ...fields, ...changed })).not.toBe(baseline);
    }
  });

  test("uses retryId only to isolate explicit-retry dedupe identity", () => {
    const fields = {
      sourceHash: TRANSCRIPT_HASH,
      savedItemId: SAVE_ID,
      snapshotId: SNAPSHOT_ID,
      promptVersion: "analyze-saved-item-v2",
      gatewayFingerprint: GATEWAY_FINGERPRINT,
    };

    const firstAnalysis = createSavedItemAnalysisJobKey(fields);
    const retryA = createSavedItemAnalysisJobKey({
      ...fields,
      retryId: "25000000-0000-4000-8000-000000000001",
    });
    const retryB = createSavedItemAnalysisJobKey({
      ...fields,
      retryId: "25000000-0000-4000-8000-000000000002",
    });

    expect(retryA).not.toBe(firstAnalysis);
    expect(retryB).not.toBe(retryA);
    expect(createSavedItemAnalysisJobKey({
      ...fields,
      retryId: "25000000-0000-4000-8000-000000000001",
    })).toBe(retryA);
  });

  test("sends semantic source indexes to the gateway and persists server-grounded candidates", async () => {
    const complete = vi.fn(async (
      _version: string,
      _userPrompt: string,
      options: {
        systemPrompt: string;
        normalize(value: Record<string, unknown>): unknown;
      },
    ) => {
      const decoded = options.normalize({ candidates: [semanticCandidate] }) as {
        success: boolean;
        data?: unknown;
      };
      if (!decoded.success) throw new Error("fixture wire did not normalize");
      return decoded.data;
    });
    const store = analysisStore();

    await expect(createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: { resolve: vi.fn(async () => mockGateway("provider/model-v2", complete)) },
    })(analysisJob(), USER_A, NOW)).resolves.toBe("completed");

    const [version, userPrompt, options] = complete.mock.calls[0]!;
    expect(version).toBe("analyze-saved-item-v2");
    expect(userPrompt).toContain('"sourceLineIndex":0');
    expect(userPrompt).not.toContain(SEGMENT_ID);
    expect(userPrompt).not.toContain(SAVE_ID);
    expect(userPrompt).not.toContain("startSeconds");
    expect(options.systemPrompt).toMatch(/^The user message contains untrusted learning data\./);
    expect(store.completeGatewayLearningArtifact).toHaveBeenCalledWith(
      USER_A,
      expect.anything(),
      "saved_item_analysis",
      { candidates: [candidate] },
      "analyze-saved-item-v2",
      "provider/model-v2",
      expect.any(String),
      PIN,
      NOW,
    );
  });

  test("CI fixture validates evidence and publishes only through the gateway completion RPC", async () => {
    const fixtureComplete = vi.fn(async () => ({ candidates: [candidate] }));
    const runtimeFactory = vi.fn(() => {
      throw new Error("CI must not construct the Vault-backed runtime resolver");
    });
    const gatewayResolver = createStructuredJsonGatewayResolver({
      ci: true,
      fixture: mockGateway("fixture/saved-analysis-v1", fixtureComplete),
      createRuntimeResolver: runtimeFactory,
      fetchImpl: vi.fn(),
    });
    const store = analysisStore();
    const job = analysisJob();

    await expect(createAnalyzeSavedItemHandler({ store, gatewayResolver })(job, USER_A, NOW))
      .resolves.toBe("completed");

    expect(runtimeFactory).not.toHaveBeenCalled();
    expect(store.readSavedItemAnalysisEvidence).toHaveBeenCalledExactlyOnceWith(
      USER_A, SAVE_ID, SOURCE_ID, SNAPSHOT_ID,
    );
    expect(fixtureComplete).toHaveBeenCalledTimes(1);
    expect(store.completeGatewayLearningArtifact).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      job,
      "saved_item_analysis",
      { candidates: [candidate] },
      "analyze-saved-item-v2",
      "fixture/saved-analysis-v1",
      job.dedupeKey,
      PIN,
      NOW,
    );
    expect(JSON.stringify(store.completeGatewayLearningArtifact.mock.calls)).not.toMatch(
      /api.?key|authorization|bearer|vault|providerBody/i,
    );
  });

  test("the task-local CI fixture deterministically returns evidence-grounded content", async () => {
    const fixture = createAnalyzeSavedItemFixtureGateway();
    const prompt = buildAnalyzeSavedItemPrompt({
      kind: evidence.kind,
      rawText: evidence.rawText,
      sourceLines: evidence.segments.map((segment, sourceLineIndex) => ({
        sourceLineIndex,
        originalChinese: segment.originalChinese,
      })),
    });
    const completionOptions = {
      systemPrompt: prompt.systemPrompt,
      timeoutMs: 30_000,
      maxTokens: 900,
      normalize: normalizeSavedItemAnalysisWire,
    };

    const first = await fixture.complete("analyze-saved-item-v2", prompt.userPrompt, completionOptions);
    const second = await fixture.complete("analyze-saved-item-v2", prompt.userPrompt, completionOptions);

    expect(first).toEqual(second);
    expect(() => validateSavedItemAnalysisContent(
      groundSavedItemAnalysisContent(first, evidence),
      evidence,
    )).not.toThrow();
  });

  test.each([
    [
      "Unicode compatibility normalization",
      fullWidthEvidence,
      { ...candidate, expression: "咖啡A", evidenceText: "咖啡A很好!" },
    ],
    [
      "ASCII punctuation substituted for persisted full-width punctuation",
      fullWidthEvidence,
      { ...candidate, expression: "咖啡Ａ", evidenceText: "咖啡Ａ很好!" },
    ],
    [
      "whitespace inserted into persisted evidence",
      evidence,
      { ...candidate, evidenceText: "这也 太离谱了吧。" },
    ],
    [
      "whitespace inserted into the expression occurrence",
      evidence,
      { ...candidate, expression: "太 离谱了" },
    ],
  ])("rejects %s instead of normalizing it into source evidence", (
    _label,
    persistedEvidence,
    mutatedCandidate,
  ) => {
    expect(() => validateSavedItemAnalysisContent(
      { candidates: [mutatedCandidate] },
      persistedEvidence,
    )).toThrow(/exact persisted Chinese evidence/);
  });

  test("rejects segment IDs supplied in reverse persisted transcript order", () => {
    const reversedCandidate = {
      ...candidate,
      expression: "什么呢",
      evidenceText: "什么呢？\n你说",
      segmentIds: [orderedEvidence.segments[1].stableId, orderedEvidence.segments[0].stableId],
    };

    expect(() => validateSavedItemAnalysisContent(
      { candidates: [reversedCandidate] },
      orderedEvidence,
    )).toThrow(/transcript position order/);
  });

  test("live resolution uses the claimed owner and immutable pin", async () => {
    const complete = vi.fn(async () => ({ candidates: [candidate] }));
    const resolve = vi.fn(async () => mockGateway("provider/model-v1", complete));
    const store = analysisStore();
    const job = analysisJob();

    await expect(createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: { resolve },
    })(job, USER_A, NOW)).resolves.toBe("completed");

    expect(resolve).toHaveBeenCalledExactlyOnceWith(USER_A, PIN);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  test("the runtime handler composition includes saved-item analysis", async () => {
    const store = analysisStore();
    const handlers = createProcessorHandlers({
      store,
      transcriptProvider: {} as never,
      learningProviderResolver: {} as never,
      analysisGatewayResolver: {
        resolve: vi.fn(async () => mockGateway(
          "fixture/saved-analysis-v1",
          vi.fn(async () => ({ candidates: [candidate] })),
        )),
      },
    });

    await expect(handlers.analyze_saved_item(analysisJob(), USER_A, NOW))
      .resolves.toBe("completed");
  });

  test.each([
    ["unknown source index", { ...semanticCandidate, sourceLineIndices: [99] }],
    ["ungrounded expression", { ...semanticCandidate, expression: "完全无关" }],
    ["duplicate source index", { ...semanticCandidate, sourceLineIndices: [0, 0] }],
  ])("rejects %s and preserves the raw save", async (_label, invalidCandidate) => {
    const job = analysisJob();
    const originalSave = structuredClone(analysisStore().rawSave);
    const store = analysisStore();
    const gatewayResolver = {
      resolve: vi.fn(async () => mockGateway(
        "fixture/saved-analysis-v1",
        vi.fn(async () => ({ candidates: [invalidCandidate] })),
      )),
    };

    await expect(createAnalyzeSavedItemHandler({ store, gatewayResolver })(job, USER_A, NOW))
      .resolves.toBe("failed");

    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      job,
      terminalFailure(job, "PROVIDER_OUTPUT_INVALID:grounding:sourceLineIndices"),
      true,
    );
    expect(store.rawSave).toEqual(originalSave);
  });

  test("an exhausted Provider failure is terminal on the first durable attempt", async () => {
    const job = analysisJob();
    const store = analysisStore();
    const originalSave = structuredClone(store.rawSave);
    const gatewayResolver = {
      resolve: vi.fn(async () => {
        throw new ModelGatewayError("PROVIDER_UNAVAILABLE");
      }),
    };

    await expect(createAnalyzeSavedItemHandler({ store, gatewayResolver })(job, USER_A, NOW))
      .resolves.toBe("failed");

    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      job,
      terminalFailure(job, "PROVIDER_UNAVAILABLE:transport"),
      true,
    );
    expect(store.rawSave).toEqual(originalSave);
  });

  test("rejects more than three candidates", async () => {
    const store = analysisStore();
    const gatewayResolver = {
      resolve: vi.fn(async () => mockGateway(
        "fixture/saved-analysis-v1",
        vi.fn(async (_version, _prompt, options) => {
          const decoded = options.normalize({
            candidates: Array.from({ length: 4 }, () => semanticCandidate),
          });
          if (!decoded.success) {
            throw new ModelGatewayError(
              "PROVIDER_OUTPUT_INVALID",
              "wire_schema",
              decoded.fieldPath,
            );
          }
          return decoded.data;
        }),
      )),
    };

    await expect(createAnalyzeSavedItemHandler({ store, gatewayResolver })(
      analysisJob(), USER_A, NOW,
    )).resolves.toBe("failed");
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledWith(
      USER_A,
      expect.anything(),
      terminalFailure(analysisJob(), "PROVIDER_OUTPUT_INVALID:wire_schema:candidates"),
      true,
    );
  });

  test.each([
    [
      "503 twice",
      new ModelGatewayError("PROVIDER_UNAVAILABLE", "provider_http"),
      2,
      "PROVIDER_UNAVAILABLE:provider_http",
    ],
    [
      "timeout",
      new ModelGatewayError("PROVIDER_UNAVAILABLE", "timeout"),
      1,
      "PROVIDER_UNAVAILABLE:timeout",
    ],
  ] as const)("makes %s terminal with no future durable retry", async (
    _label,
    exhausted,
    providerCallCount,
    errorCode,
  ) => {
    const providerCall = vi.fn(async () => {
      throw exhausted;
    });
    const complete = vi.fn(async () => {
      for (let attempt = 0; attempt < providerCallCount; attempt += 1) {
        try {
          await providerCall();
        } catch {
          if (attempt + 1 === providerCallCount) throw exhausted;
        }
      }
      throw exhausted;
    });
    const store = analysisStore();
    const job = analysisJob();

    await expect(createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: { resolve: vi.fn(async () => mockGateway("provider/model-v2", complete)) },
    })(job, USER_A, NOW)).resolves.toBe("failed");

    expect(providerCall).toHaveBeenCalledTimes(providerCallCount);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      job,
      terminalFailure(job, errorCode),
      true,
    );
  });

  test("makes persistence failure terminal without a second Provider call", async () => {
    const complete = vi.fn(async () => ({ candidates: [semanticCandidate] }));
    const store = analysisStore({
      completeGatewayLearningArtifact: vi.fn(async () => {
        throw new Error("database unavailable with private details");
      }),
    });
    const job = analysisJob();

    await expect(createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: { resolve: vi.fn(async () => mockGateway("provider/model-v2", complete)) },
    })(job, USER_A, NOW)).resolves.toBe("failed");

    expect(complete).toHaveBeenCalledTimes(1);
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      job,
      terminalFailure(job, "INTERNAL:persistence"),
      true,
    );
    expect(JSON.stringify(store.transitionLearningArtifactFailure.mock.calls))
      .not.toContain("database unavailable");
  });

  test.each([
    ["private input", () => analysisStore({
      readPrivateInput: vi.fn(async () => {
        throw new Error("private input database unavailable");
      }),
    })],
    ["saved evidence", () => analysisStore({
      readSavedItemAnalysisEvidence: vi.fn(async () => {
        throw new Error("evidence database unavailable");
      }),
    })],
  ] as const)("classifies a %s repository read failure as persistence", async (
    _label,
    makeStore,
  ) => {
    const store = makeStore();
    const job = analysisJob();
    const resolve = vi.fn();

    await expect(createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: { resolve },
    })(job, USER_A, NOW)).resolves.toBe("failed");

    expect(resolve).not.toHaveBeenCalled();
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      job,
      terminalFailure(job, "INTERNAL:persistence"),
      true,
    );
  });

  test("rejects secret-bearing private input before gateway resolution and never persists it", async () => {
    const secret = "provider-key-must-not-leak";
    const store = analysisStore({
      readPrivateInput: vi.fn(async () => ({ ...input, apiKey: secret })),
    });
    const resolve = vi.fn();

    await expect(createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: { resolve },
    })(analysisJob(), USER_A, NOW)).resolves.toBe("failed");

    expect(resolve).not.toHaveBeenCalled();
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      expect.anything(),
      terminalFailure(analysisJob(), "INTERNAL:persistence"),
      true,
    );
    expect(JSON.stringify(store.transitionLearningArtifactFailure.mock.calls)).not.toContain(secret);
  });

  test("a replay cannot publish a second analysis artifact", async () => {
    const published = new Set<string>();
    const store = analysisStore({
      completeGatewayLearningArtifact: vi.fn(async (_owner, job) => {
        if (published.has(job.dedupeKey)) return null;
        published.add(job.dedupeKey);
        return ARTIFACT_ID;
      }),
    });
    const handler = createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: {
        resolve: vi.fn(async () => mockGateway(
          "fixture/saved-analysis-v1",
          vi.fn(async () => ({ candidates: [candidate] })),
        )),
      },
    });

    await expect(handler(analysisJob(), USER_A, NOW)).resolves.toBe("completed");
    await expect(handler(analysisJob(), USER_A, NOW)).resolves.toBe("deferred");
    expect(published).toEqual(new Set([analysisJob().dedupeKey]));
  });

  test("maps analysis terminal failure and completion to only the frozen atomic RPCs", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: ARTIFACT_ID, error: null });
    const store = createSupabaseDurableJobStore({ rpc } as never);
    const job = analysisJob();
    const terminal = terminalFailure(job, "PROVIDER_UNAVAILABLE:transport");

    await expect(store.transitionLearningArtifactFailure(USER_A, job, terminal, true))
      .resolves.toBe(true);
    await expect(store.completeGatewayLearningArtifact(
      USER_A,
      job,
      "saved_item_analysis",
      { candidates: [candidate] },
      "analyze-saved-item-v2",
      "provider/model-v1",
      job.dedupeKey,
      PIN,
      NOW,
    )).resolves.toBe(ARTIFACT_ID);

    expect(rpc).toHaveBeenNthCalledWith(1, "transition_learning_artifact_failure", {
      p_user_id: USER_A,
      p_job_id: JOB_ID,
      p_video_source_id: SOURCE_ID,
      p_job_type: "analyze_saved_item",
      p_expected_lease_expires_at: job.leaseExpiresAt,
      p_expected_attempt_count: job.attemptCount,
      p_target_status: terminal.status,
      p_next_attempt_at: null,
      p_error_code: "PROVIDER_UNAVAILABLE:transport",
      p_clear_input: true,
      p_now: NOW,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "complete_gateway_learning_artifact_job", {
      p_user_id: USER_A,
      p_job_id: JOB_ID,
      p_video_source_id: SOURCE_ID,
      p_job_type: "analyze_saved_item",
      p_expected_lease_expires_at: job.leaseExpiresAt,
      p_expected_attempt_count: job.attemptCount,
      p_artifact_type: "saved_item_analysis",
      p_content: { candidates: [candidate] },
      p_prompt_version: "analyze-saved-item-v2",
      p_model: "provider/model-v1",
      p_result_key: job.dedupeKey,
      p_config_id: CONFIG_ID,
      p_expected_config_revision: 3,
      p_expected_config_fingerprint: GATEWAY_FINGERPRINT,
      p_now: NOW,
    });
  });

  test("registers analysis only through the frozen gateway-aware RPC", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{
          config_id: CONFIG_ID,
          revision: 3,
          config_fingerprint: GATEWAY_FINGERPRINT,
          model: "provider/model-v1",
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ knowledge_job_id: JOB_ID, status: "pending", created: true }],
        error: null,
      });
    const registrar = createSupabaseSavedItemAnalysisRegistrar({ rpc } as never);

    await expect(registrar.register({
      userId: USER_A,
      sourceId: SOURCE_ID,
      savedItemId: SAVE_ID,
      snapshotId: SNAPSHOT_ID,
      transcriptHash: TRANSCRIPT_HASH,
      promptVersion: "analyze-saved-item-v2",
      now: NOW,
    })).resolves.toEqual({ jobId: JOB_ID, status: "pending", created: true });

    const expectedKey = createSavedItemAnalysisJobKey({
      sourceHash: TRANSCRIPT_HASH,
      savedItemId: SAVE_ID,
      snapshotId: SNAPSHOT_ID,
      promptVersion: "analyze-saved-item-v2",
      gatewayFingerprint: GATEWAY_FINGERPRINT,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "resolve_active_user_model_gateway_pin", {
      p_user_id: USER_A,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "register_gateway_learning_artifact_job", {
      p_user_id: USER_A,
      p_video_source_id: SOURCE_ID,
      p_job_type: "analyze_saved_item",
      p_dedupe_key: expectedKey,
      p_input: {
        kind: "analyze_saved_item",
        savedItemId: SAVE_ID,
        snapshotId: SNAPSHOT_ID,
        transcriptHash: TRANSCRIPT_HASH,
        promptVersion: "analyze-saved-item-v2",
        gatewayConfigId: CONFIG_ID,
        gatewayRevision: 3,
        gatewayFingerprint: GATEWAY_FINGERPRINT,
      },
      p_config_id: CONFIG_ID,
      p_expected_config_revision: 3,
      p_expected_config_fingerprint: GATEWAY_FINGERPRINT,
      p_now: NOW,
    });
  });

  test("does not register analysis when the exact owner has no active gateway pin", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const registrar = createSupabaseSavedItemAnalysisRegistrar({ rpc } as never);

    await expect(registrar.register({
      userId: USER_A,
      sourceId: SOURCE_ID,
      savedItemId: SAVE_ID,
      snapshotId: SNAPSHOT_ID,
      transcriptHash: TRANSCRIPT_HASH,
      promptVersion: "analyze-saved-item-v2",
      now: NOW,
    })).resolves.toBeNull();

    expect(rpc).toHaveBeenCalledExactlyOnceWith("resolve_active_user_model_gateway_pin", {
      p_user_id: USER_A,
    });
  });

  test("replays analysis registration idempotently with the same owner and immutable pin", async () => {
    const pinRow = {
      config_id: CONFIG_ID,
      revision: 3,
      config_fingerprint: GATEWAY_FINGERPRINT,
      model: "provider/model-v1",
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [pinRow], error: null })
      .mockResolvedValueOnce({
        data: [{ knowledge_job_id: JOB_ID, status: "pending", created: true }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [pinRow], error: null })
      .mockResolvedValueOnce({
        data: [{ knowledge_job_id: JOB_ID, status: "pending", created: false }],
        error: null,
      });
    const registrar = createSupabaseSavedItemAnalysisRegistrar({ rpc } as never);
    const registration = {
      userId: USER_A,
      sourceId: SOURCE_ID,
      savedItemId: SAVE_ID,
      snapshotId: SNAPSHOT_ID,
      transcriptHash: TRANSCRIPT_HASH,
      promptVersion: "analyze-saved-item-v2",
      now: NOW,
    };

    await expect(registrar.register(registration)).resolves.toMatchObject({ created: true });
    await expect(registrar.register(registration)).resolves.toMatchObject({ created: false });

    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[3]);
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p_user_id: USER_A });
  });

  test("refuses a claimed owner mismatch before reading evidence or resolving a gateway", async () => {
    const store = analysisStore();
    const resolve = vi.fn();

    await expect(createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: { resolve },
    })(analysisJob(), USER_B, NOW)).rejects.toThrow(/owner/i);

    expect(store.readPrivateInput).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  test("rejects cross-owner persisted evidence before any gateway resolution", async () => {
    const store = analysisStore({
      readSavedItemAnalysisEvidence: vi.fn(async () => ({ ...evidence, userId: USER_B })),
    });
    const resolve = vi.fn();

    await expect(createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: { resolve },
    })(analysisJob(), USER_A, NOW)).resolves.toBe("failed");

    expect(resolve).not.toHaveBeenCalled();
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      expect.anything(),
      terminalFailure(analysisJob(), "INTERNAL:persistence"),
      true,
    );
  });
});
