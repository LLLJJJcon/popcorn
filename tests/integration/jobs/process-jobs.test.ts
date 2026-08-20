import { describe, expect, test, vi } from "vitest";

import { KnowledgeJobSchema, type KnowledgeJob } from "@/contracts/knowledge";
import { ModelGatewayError } from "@/server/ai/provider";
import { createAnalyzeSavedItemFixtureGateway } from "@/server/ai/prompts/analyze-saved-item.v1";
import { createStructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import * as processRouteModule from "@/app/api/internal/jobs/process/route";
import { nextJobFailure } from "@/server/domain/lease-job";
import { createAnalyzeSavedItemHandler } from "@/server/jobs/handlers/analyze-saved-item";
import {
  createInternalProcessRoute,
  createProcessorHandlers,
  createSupabaseSavedItemAnalysisRegistrar,
  createSupabaseDurableJobStore,
  type DurableJobStore,
} from "@/server/jobs/process-jobs";
import {
  createSavedItemAnalysisJobKey,
  type SavedItemAnalysisEvidence,
  validateSavedItemAnalysisContent,
} from "@/server/jobs/job-types";

describe("bounded internal knowledge-job endpoint", () => {
  test("exports only App Router HTTP entrypoints", () => {
    expect(Object.keys(processRouteModule).sort()).toEqual(["POST"]);
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
  promptVersion: "analyze-saved-item-v1",
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
      promptVersion: "analyze-saved-item-v1",
      gatewayFingerprint: GATEWAY_FINGERPRINT,
    };
    const baseline = createSavedItemAnalysisJobKey(fields);

    expect(createSavedItemAnalysisJobKey({ ...fields })).toBe(baseline);
    for (const changed of [
      { sourceHash: "1".repeat(64) },
      { savedItemId: "23000000-0000-4000-8000-000000000001" },
      { snapshotId: "24000000-0000-4000-8000-000000000001" },
      { promptVersion: "analyze-saved-item-v2" },
      { gatewayFingerprint: "2".repeat(64) },
    ]) {
      expect(createSavedItemAnalysisJobKey({ ...fields, ...changed })).not.toBe(baseline);
    }
  });

  test("CI fixture validates evidence and publishes only through the gateway completion RPC", async () => {
    const fixtureComplete = vi.fn(async () => ({ candidates: [candidate] }));
    const runtimeFactory = vi.fn(() => {
      throw new Error("CI must not construct the Vault-backed runtime resolver");
    });
    const gatewayResolver = createStructuredJsonGatewayResolver({
      ci: true,
      fixture: { model: "fixture/saved-analysis-v1", complete: fixtureComplete },
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
      "analyze-saved-item-v1",
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
    const prompt = ["bounded instructions", JSON.stringify({ segments: evidence.segments })].join("\n");

    const first = await fixture.complete("analyze-saved-item-v1", prompt);
    const second = await fixture.complete("analyze-saved-item-v1", prompt);

    expect(first).toEqual(second);
    expect(() => validateSavedItemAnalysisContent(first, evidence)).not.toThrow();
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
    const resolve = vi.fn(async () => ({ model: "provider/model-v1", complete }));
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
        resolve: vi.fn(async () => ({
          model: "fixture/saved-analysis-v1",
          complete: vi.fn(async () => ({ candidates: [candidate] })),
        })),
      },
    });

    await expect(handlers.analyze_saved_item(analysisJob(), USER_A, NOW))
      .resolves.toBe("completed");
  });

  test.each([
    ["invented evidence", { ...candidate, evidenceText: "完全无关的中文。" }],
    ["unknown segment", { ...candidate, segmentIds: ["e".repeat(64)] }],
    ["reversed timestamp", { ...candidate, startSeconds: 12, endSeconds: 10 }],
  ])("rejects %s and preserves the raw save", async (_label, invalidCandidate) => {
    const job = analysisJob();
    const originalSave = structuredClone(analysisStore().rawSave);
    const store = analysisStore();
    const gatewayResolver = {
      resolve: vi.fn(async () => ({
        model: "fixture/saved-analysis-v1",
        complete: vi.fn(async () => ({ candidates: [invalidCandidate] })),
      })),
    };

    await expect(createAnalyzeSavedItemHandler({ store, gatewayResolver })(job, USER_A, NOW))
      .resolves.toBe("deferred");

    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
    expect(store.transitionLearningArtifactFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      job,
      nextJobFailure(job, "PROVIDER_OUTPUT_INVALID", NOW),
      false,
    );
    expect(store.rawSave).toEqual(originalSave);
  });

  test("terminal Provider failure clears only private job input and leaves raw save unchanged", async () => {
    const job = analysisJob({ attemptCount: 5 });
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
      nextJobFailure(job, "PROVIDER_UNAVAILABLE", NOW),
      true,
    );
    expect(store.rawSave).toEqual(originalSave);
  });

  test("rejects more than three candidates", async () => {
    const store = analysisStore();
    const gatewayResolver = {
      resolve: vi.fn(async () => ({
        model: "fixture/saved-analysis-v1",
        complete: vi.fn(async () => ({ candidates: Array.from({ length: 4 }, () => candidate) })),
      })),
    };

    await expect(createAnalyzeSavedItemHandler({ store, gatewayResolver })(
      analysisJob(), USER_A, NOW,
    )).resolves.toBe("deferred");
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
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
    })(analysisJob(), USER_A, NOW)).resolves.toBe("deferred");

    expect(resolve).not.toHaveBeenCalled();
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
        resolve: vi.fn(async () => ({
          model: "fixture/saved-analysis-v1",
          complete: vi.fn(async () => ({ candidates: [candidate] })),
        })),
      },
    });

    await expect(handler(analysisJob(), USER_A, NOW)).resolves.toBe("completed");
    await expect(handler(analysisJob(), USER_A, NOW)).resolves.toBe("deferred");
    expect(published).toEqual(new Set([analysisJob().dedupeKey]));
  });

  test("maps analysis retry and completion to only the frozen atomic RPCs", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: ARTIFACT_ID, error: null });
    const store = createSupabaseDurableJobStore({ rpc } as never);
    const job = analysisJob();
    const retry = nextJobFailure(job, "PROVIDER_UNAVAILABLE", NOW);

    await expect(store.transitionLearningArtifactFailure(USER_A, job, retry, false))
      .resolves.toBe(true);
    await expect(store.completeGatewayLearningArtifact(
      USER_A,
      job,
      "saved_item_analysis",
      { candidates: [candidate] },
      "analyze-saved-item-v1",
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
      p_target_status: retry.status,
      p_next_attempt_at: retry.nextAttemptAt,
      p_error_code: "PROVIDER_UNAVAILABLE",
      p_clear_input: false,
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
      p_prompt_version: "analyze-saved-item-v1",
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
      promptVersion: "analyze-saved-item-v1",
      now: NOW,
    })).resolves.toEqual({ jobId: JOB_ID, status: "pending", created: true });

    const expectedKey = createSavedItemAnalysisJobKey({
      sourceHash: TRANSCRIPT_HASH,
      savedItemId: SAVE_ID,
      snapshotId: SNAPSHOT_ID,
      promptVersion: "analyze-saved-item-v1",
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
        promptVersion: "analyze-saved-item-v1",
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
      promptVersion: "analyze-saved-item-v1",
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
      promptVersion: "analyze-saved-item-v1",
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
    })(analysisJob(), USER_A, NOW)).resolves.toBe("deferred");

    expect(resolve).not.toHaveBeenCalled();
    expect(store.completeGatewayLearningArtifact).not.toHaveBeenCalled();
  });
});
