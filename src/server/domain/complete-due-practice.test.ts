import { describe, expect, test, vi } from "vitest";

import {
  createDuePracticeCompletionService,
  createDuePracticeHttpHandler,
  type DuePracticeCompletionRepository,
  type DueTransferTask,
} from "@/server/domain/complete-due-practice";
import { createEvaluationFixtureGateway } from "@/server/ai/prompts/evaluate.v1";
import type { StructuredJsonGateway } from "@/server/ai/structured-json-gateway";
import { ModelGatewayError } from "@/server/ai/provider";
import type { ModelOutputStage } from "@/server/ai/model-output";

const USER = "11111111-1111-4111-8111-111111111111";
const REVIEW = "22222222-2222-4222-8222-222222222222";
const TASK = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-08-22T12:00:00.000Z";
const SAFE_REQUEST_ID = "safe-request";

const task: DueTransferTask = {
  id: TASK,
  userId: USER,
  reviewTaskId: REVIEW,
  userExpressionId: "44444444-4444-4444-8444-444444444444",
  targetExpression: "太离谱了",
  promptChinese: "朋友说一张普通演出门票要一万元。你会怎么回应？",
  instructionsEnglish: "Reply with one natural Simplified Chinese sentence.",
  goalEnglish: "React to an unreasonable ticket price using the target expression.",
  contextFingerprint: "a".repeat(64),
  dueAt: "2026-08-21T12:00:00.000Z",
  masteryState: "tried",
};

function pendingState(taskValue: DueTransferTask = task) {
  return { status: "pending" as const, task: taskValue, attempt: null };
}

const persistedAttempt = {
  responseChinese: "这也太离谱了吧。",
  assistanceLevel: "none" as const,
  passed: true,
  accuracyScore: 5,
  accuracyFeedbackEnglish: "The expression is used accurately.",
  naturalnessScore: 5,
  naturalnessFeedbackEnglish: "The response sounds natural.",
  contextualFitScore: 5,
  contextualFitFeedbackEnglish: "The response fits the transfer context.",
  submittedAt: "2026-08-22T12:00:00.000Z",
  evaluationPromptVersion: "evaluate-practice-v1",
  evaluationModel: "model-at-first-submit",
  evaluationGatewayConfigId: "55555555-5555-4555-8555-555555555555",
  evaluationGatewayRevision: 2,
  evaluationGatewayFingerprint: "a".repeat(64),
};

function repository(): DuePracticeCompletionRepository {
  return {
    findTransferTask: vi.fn(async () => task),
    findCompletionState: vi.fn(async () => pendingState()),
    resolveActiveGatewayPin: vi.fn(async () => ({
      configId: "55555555-5555-4555-8555-555555555555", revision: 2, fingerprint: "a".repeat(64),
    })),
    completeDuePractice: vi.fn(async () => ({
      reviewTaskId: REVIEW,
      practiceTaskId: TASK,
      attemptId: "66666666-6666-4666-8666-666666666666",
      masteryEventId: "77777777-7777-4777-8777-777777777777",
      nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
      priorState: "tried" as const,
      newState: "reused" as const,
      nextDueAt: "2026-08-29T12:00:00.000Z",
      intervalDays: 7,
      created: true,
    })),
  };
}

type GatewayDouble = {
  readonly model: string;
  readonly complete: ReturnType<typeof vi.fn>;
};

function service(store = repository(), options: {
  ci?: boolean;
  gateway?: StructuredJsonGateway | GatewayDouble;
  now?: () => string;
} = {}) {
  const selectedGateway = options.gateway ?? createEvaluationFixtureGateway();
  const gateway = selectedGateway as unknown as StructuredJsonGateway;
  return {
    store,
    service: createDuePracticeCompletionService({
      repository: store,
      ci: options.ci ?? true,
      fixtureGateway: gateway,
      gatewayResolver: { resolve: vi.fn(async () => gateway) },
      now: options.now ?? (() => NOW),
    }),
  };
}

type DueFailureExpectation = {
  readonly label: string;
  readonly makeError: () => unknown;
  readonly code: "PROVIDER_RATE_LIMITED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_OUTPUT_INVALID" | "INTERNAL_ERROR";
  readonly status: 429 | 503 | 422 | 500;
  readonly retryable: boolean;
};

function modelFailure(
  code: "PROVIDER_UNAVAILABLE" | "PROVIDER_OUTPUT_INVALID",
  stage: ModelOutputStage,
): () => ModelGatewayError {
  return () => new ModelGatewayError(code, stage, "sentinel-private-field");
}

const dueFailureExpectations: readonly DueFailureExpectation[] = [
  {
    label: "rate_limit",
    makeError: modelFailure("PROVIDER_UNAVAILABLE", "rate_limit"),
    code: "PROVIDER_RATE_LIMITED",
    status: 429,
    retryable: true,
  },
  ...(["transport", "timeout", "provider_http"] as const).map((stage) => ({
    label: stage,
    makeError: modelFailure("PROVIDER_UNAVAILABLE", stage),
    code: "PROVIDER_UNAVAILABLE" as const,
    status: 503 as const,
    retryable: true,
  })),
  {
    label: "response_envelope",
    makeError: modelFailure("PROVIDER_OUTPUT_INVALID", "response_envelope"),
    code: "PROVIDER_UNAVAILABLE",
    status: 503,
    retryable: true,
  },
  ...(["json_extract", "wire_schema", "grounding"] as const).map((stage) => ({
    label: stage,
    makeError: modelFailure("PROVIDER_OUTPUT_INVALID", stage),
    code: "PROVIDER_OUTPUT_INVALID" as const,
    status: 422 as const,
    retryable: false,
  })),
  {
    label: "persistence",
    makeError: modelFailure("PROVIDER_OUTPUT_INVALID", "persistence"),
    code: "INTERNAL_ERROR",
    status: 500,
    retryable: true,
  },
  {
    label: "unexpected",
    makeError: () => new Error("sentinel-private-provider-message"),
    code: "INTERNAL_ERROR",
    status: 500,
    retryable: true,
  },
];

async function expectDueFailureResponse(response: Response, expected: DueFailureExpectation) {
  const body = await response.json();
  expect(response.status).toBe(expected.status);
  expect(body).toEqual({
    ok: false,
    error: {
      code: expected.code,
      message: expect.any(String),
      retryable: expected.retryable,
    },
    requestId: SAFE_REQUEST_ID,
  });
  expect(JSON.stringify(body)).not.toMatch(/sentinel|private-provider-message|private-field/i);
}

describe("complete due Practice", () => {
  test("pins semantic wire evaluations to the immutable v3 prompt and fixture model", async () => {
    const store = repository();
    const fixture = createEvaluationFixtureGateway();
    const gateway = {
      model: fixture.model,
      complete: vi.fn(fixture.complete.bind(fixture)),
    };
    const { service: complete } = service(store, { ci: false, gateway });

    await complete.complete(USER, REVIEW, {
      responseChinese: "这也太离谱了吧。",
      assistanceLevel: "none",
    });

    expect(gateway.complete).toHaveBeenCalledWith(
      "evaluate-practice-v3",
      expect.stringContaining('"task":"evaluation"'),
      expect.objectContaining({
        systemPrompt: expect.stringContaining("naturalRevisionChinese"),
        timeoutMs: 30_000,
        maxTokens: 700,
      }),
    );
    expect(store.completeDuePractice).toHaveBeenCalledWith(expect.objectContaining({
      evaluationPromptVersion: "evaluate-practice-v3",
      evaluationModel: "fixture/evaluation-v3",
    }));
  });

  test("submits independent evidence before the sole completion RPC and returns its immutable transition", async () => {
    const { service: complete, store } = service();

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "这也太离谱了吧。",
      assistanceLevel: "none",
    })).resolves.toMatchObject({
      attemptId: "66666666-6666-4666-8666-666666666666",
      transition: { from: "tried", to: "reused" },
      created: true,
      coaching: { naturalRevisionChinese: "这个价格也太离谱了吧。" },
    });
    expect(store.completeDuePractice).toHaveBeenCalledOnce();
    expect(store.completeDuePractice).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER, reviewTaskId: REVIEW, practiceTaskId: TASK,
      assistanceLevel: "none", passed: true, completedAt: NOW,
    }));
    expect(store.completeDuePractice).toHaveBeenCalledWith(
      expect.not.objectContaining({ naturalRevisionChinese: expect.anything() }),
    );
    expect(store.resolveActiveGatewayPin).not.toHaveBeenCalled();
  });

  test("canonicalizes explicit +00:00 instants before the first completion RPC and in the response", async () => {
    const store = repository();
    store.findCompletionState = vi.fn(async () => pendingState({
      ...task,
      dueAt: "2026-08-21T12:00:00+00:00",
    }));
    store.completeDuePractice = vi.fn(async () => ({
      reviewTaskId: REVIEW, practiceTaskId: TASK,
      attemptId: "66666666-6666-4666-8666-666666666666",
      masteryEventId: "77777777-7777-4777-8777-777777777777",
      nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
      priorState: "tried" as const, newState: "reused" as const,
      nextDueAt: "2026-08-29T12:00:00+00:00", intervalDays: 7, created: true,
    }));
    const { service: complete } = service(store, { now: () => "2026-08-22T12:00:00+00:00" });

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "这也太离谱了吧。", assistanceLevel: "none",
    })).resolves.toMatchObject({
      nextDueAt: "2026-08-29T12:00:00.000Z",
    });
    expect(store.completeDuePractice).toHaveBeenCalledWith(expect.objectContaining({
      completedAt: "2026-08-22T12:00:00.000Z",
    }));
  });

  test.each([
    "2026-08-22T12:00:00",
    "not-an-instant",
  ])("fails closed on a non-explicit or invalid completion instant before Provider and RPC: %s", async (now) => {
    const store = repository();
    const gateway = { model: "must-not-run", complete: vi.fn(async () => ({})) };
    const { service: complete } = service(store, { gateway, now: () => now });

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "太离谱了。", assistanceLevel: "none",
    })).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(gateway.complete).not.toHaveBeenCalled();
    expect(store.completeDuePractice).not.toHaveBeenCalled();
  });

  test("accepts the RPC-owned transition to owned only with its thirty-day immutable schedule", async () => {
    const store = repository();
    store.findTransferTask = vi.fn(async () => ({ ...task, masteryState: "reused" as const }));
    store.findCompletionState = vi.fn(async () => pendingState({ ...task, masteryState: "reused" as const }));
    store.completeDuePractice = vi.fn(async () => ({
      reviewTaskId: REVIEW, practiceTaskId: TASK, attemptId: "66666666-6666-4666-8666-666666666666",
      masteryEventId: "77777777-7777-4777-8777-777777777777", nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
      priorState: "reused" as const, newState: "owned" as const,
      nextDueAt: "2026-09-21T12:00:00.000Z", intervalDays: 30, created: true,
    }));
    const { service: complete } = service(store);

    await expect(complete.complete(USER, REVIEW, { responseChinese: "这确实太离谱了。", assistanceLevel: "none" }))
      .resolves.toMatchObject({ transition: { from: "reused", to: "owned" }, intervalDays: 30 });
  });

  test("does not promote failed or assisted attempts and preserves the RPC-derived state", async () => {
    const store = repository();
    store.findTransferTask = vi.fn(async () => ({ ...task, masteryState: "reused" as const }));
    store.findCompletionState = vi.fn(async () => pendingState({ ...task, masteryState: "reused" as const }));
    store.completeDuePractice = vi.fn(async () => ({
      reviewTaskId: REVIEW, practiceTaskId: TASK, attemptId: "66666666-6666-4666-8666-666666666666",
      masteryEventId: "77777777-7777-4777-8777-777777777777", nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
      priorState: "reused" as const, newState: "reused" as const, nextDueAt: "2026-08-23T12:00:00.000Z", intervalDays: 1, created: true,
    }));
    const gateway = {
      model: "fixture/hinted-evaluation",
      complete: vi.fn(async () => ({
        passed: true,
        accuracy: { score: 4, englishFeedback: "Meaning is clear." },
        naturalness: { score: 4, englishFeedback: "Natural in conversation." },
        contextualFit: { score: 5, englishFeedback: "Fits the situation." },
        independentUse: false,
        assistanceLevel: "hint",
        naturalRevisionChinese: "这个价格也太离谱了吧。",
      })),
    };
    const { service: complete } = service(store, { gateway });

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "太离谱了。", assistanceLevel: "hint",
    })).resolves.toMatchObject({ transition: null, intervalDays: 1 });
    expect(store.completeDuePractice).toHaveBeenCalledWith(expect.objectContaining({
      passed: true, assistanceLevel: "hint",
    }));
    expect(gateway.complete).toHaveBeenCalledWith(
      "evaluate-practice-v3",
      expect.not.stringContaining("assistanceLevel"),
      expect.objectContaining({ timeoutMs: 30_000, maxTokens: 700 }),
    );
  });

  test("treats any score below three as a learning result and keeps the existing one-day Due schedule", async () => {
    const store = repository();
    store.completeDuePractice = vi.fn(async () => ({
      reviewTaskId: REVIEW,
      practiceTaskId: TASK,
      attemptId: "66666666-6666-4666-8666-666666666666",
      masteryEventId: "77777777-7777-4777-8777-777777777777",
      nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
      priorState: "tried" as const,
      newState: "tried" as const,
      nextDueAt: "2026-08-23T12:00:00.000Z",
      intervalDays: 1,
      created: true,
    }));
    const gateway = {
      model: "fixture/failed-evaluation",
      complete: vi.fn(async () => ({
        accuracy: { score: 5, englishFeedback: "The meaning is correct." },
        naturalness: { score: 2, englishFeedback: "The word order is substantially unnatural." },
        contextualFit: { score: 5, englishFeedback: "The response fits the situation." },
        passed: true,
        independentUse: true,
        assistanceLevel: "none",
        naturalRevisionChinese: "这个价格也太离谱了吧。",
      })),
    };
    const { service: complete } = service(store, { gateway });

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "太离谱了我。",
      assistanceLevel: "none",
    })).resolves.toMatchObject({
      transition: null,
      intervalDays: 1,
      evaluation: { passed: false, independentUse: false, assistanceLevel: "none" },
    });
    expect(store.completeDuePractice).toHaveBeenCalledWith(expect.objectContaining({
      passed: false,
      assistanceLevel: "none",
    }));
  });

  test("fails closed before evaluating or writing a cross-owner, stale, or mismatched task", async () => {
    const store = repository();
    store.findTransferTask = vi.fn(async () => ({ ...task, userId: "99999999-9999-4999-8999-999999999999" }));
    store.findCompletionState = vi.fn(async () => pendingState({
      ...task, userId: "99999999-9999-4999-8999-999999999999",
    }));
    const gateway = { model: "unsafe", complete: vi.fn(async () => ({})) };
    const { service: complete } = service(store, { gateway });

    await expect(complete.complete(USER, REVIEW, { responseChinese: "太离谱了。", assistanceLevel: "none" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(gateway.complete).not.toHaveBeenCalled();
    expect(store.completeDuePractice).not.toHaveBeenCalled();
  });

  test("stops before gateway resolution, Provider, and RPC when the repository rejects stale mastery evidence", async () => {
    const store = repository();
    store.findCompletionState = vi.fn(async () => null);
    const gateway = { model: "must-not-run", complete: vi.fn(async () => ({})) };
    const { service: complete } = service(store, { ci: false, gateway });

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "太离谱了。", assistanceLevel: "none",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.resolveActiveGatewayPin).not.toHaveBeenCalled();
    expect(gateway.complete).not.toHaveBeenCalled();
    expect(store.completeDuePractice).not.toHaveBeenCalled();
  });

  test.each(dueFailureExpectations)(
    "maps Due $label failures to the safe HTTP category without calling the completion RPC",
    async (expected) => {
      const store = repository();
      const gateway = {
        model: "fixture/failure",
        complete: vi.fn(async () => { throw expected.makeError(); }),
      };
      const { service: complete } = service(store, { gateway });
      const handler = createDuePracticeHttpHandler({
        authenticate: vi.fn(async () => ({ ok: true as const, userId: USER })),
        complete: complete.complete,
        appUrl: "https://popcorn.example",
        requestId: () => SAFE_REQUEST_ID,
      });

      const response = await handler(new Request(
        `https://popcorn.example/api/v1/practice/due/${REVIEW}`,
        {
          method: "POST",
          headers: { Origin: "https://popcorn.example", "Content-Type": "application/json" },
          body: JSON.stringify({ responseChinese: "太离谱了。", assistanceLevel: "none" }),
        },
      ), { params: Promise.resolve({ reviewTaskId: REVIEW }) });

      await expectDueFailureResponse(response, expected);
      expect(store.completeDuePractice).not.toHaveBeenCalled();
    },
  );

  test("returns identical immutable identifiers for an exact replay", async () => {
    const store = repository();
    let calls = 0;
    store.completeDuePractice = vi.fn(async () => ({
      reviewTaskId: REVIEW, practiceTaskId: TASK, attemptId: "66666666-6666-4666-8666-666666666666",
      masteryEventId: "77777777-7777-4777-8777-777777777777", nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
      priorState: "tried" as const, newState: "reused" as const,
      nextDueAt: "2026-08-29T12:00:00.000Z", intervalDays: 7, created: calls++ === 0,
    }));
    const { service: complete } = service(store);

    const input = { responseChinese: "这也太离谱了吧。", assistanceLevel: "none" as const };
    const first = await complete.complete(USER, REVIEW, input);
    const replay = await complete.complete(USER, REVIEW, input);
    expect(replay).toMatchObject({ attemptId: first.attemptId, masteryEventId: first.masteryEventId, created: false });
    const completionCalls = vi.mocked(store.completeDuePractice).mock.calls;
    expect(completionCalls[0]?.[0].requestKey).toBe(completionCalls[1]?.[0].requestKey);
  });

  test("replays a completed review from persisted public attempt evidence without resolving or calling a Provider", async () => {
    const store = repository();
    store.findCompletionState = vi.fn(async () => ({
      status: "completed" as const,
      task,
      attempt: persistedAttempt,
    }));
    store.completeDuePractice = vi.fn(async (input) => {
      expect(input).toEqual({
        userId: USER,
        reviewTaskId: REVIEW,
        practiceTaskId: TASK,
        requestKey: expect.stringMatching(/^[a-f0-9]{64}$/),
        responseChinese: persistedAttempt.responseChinese,
        assistanceLevel: persistedAttempt.assistanceLevel,
        passed: persistedAttempt.passed,
        accuracyScore: persistedAttempt.accuracyScore,
        accuracyFeedbackEnglish: persistedAttempt.accuracyFeedbackEnglish,
        naturalnessScore: persistedAttempt.naturalnessScore,
        naturalnessFeedbackEnglish: persistedAttempt.naturalnessFeedbackEnglish,
        contextualFitScore: persistedAttempt.contextualFitScore,
        contextualFitFeedbackEnglish: persistedAttempt.contextualFitFeedbackEnglish,
        completedAt: persistedAttempt.submittedAt,
        evaluationPromptVersion: persistedAttempt.evaluationPromptVersion,
        evaluationModel: persistedAttempt.evaluationModel,
        evaluationGatewayConfigId: persistedAttempt.evaluationGatewayConfigId,
        evaluationGatewayRevision: persistedAttempt.evaluationGatewayRevision,
        evaluationGatewayFingerprint: persistedAttempt.evaluationGatewayFingerprint,
      });
      return {
        reviewTaskId: REVIEW, practiceTaskId: TASK,
        attemptId: "66666666-6666-4666-8666-666666666666",
        masteryEventId: "77777777-7777-4777-8777-777777777777",
        nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
        priorState: "tried" as const, newState: "reused" as const,
        nextDueAt: "2026-08-29T12:00:00.000Z", intervalDays: 7, created: false,
      };
    });
    const gateway = {
      model: "model-that-must-not-run",
      complete: vi.fn(async () => { throw new Error("Provider must be skipped"); }),
    };
    const { service: complete } = service(store, {
      ci: false,
      gateway,
      now: () => "2026-09-01T18:30:00.000Z",
    });

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: persistedAttempt.responseChinese,
      assistanceLevel: persistedAttempt.assistanceLevel,
    })).resolves.toMatchObject({
      created: false,
      coaching: null,
      evaluation: {
        passed: true,
        assistanceLevel: "none",
        independentUse: true,
      },
    });
    expect(store.resolveActiveGatewayPin).not.toHaveBeenCalled();
    expect(gateway.complete).not.toHaveBeenCalled();
    expect(store.completeDuePractice).toHaveBeenCalledOnce();
  });

  test.each(["evaluate-practice-v2", "evaluate-practice-v3"])(
    "replays a completed %s Due evaluation without Provider use",
    async (evaluationPromptVersion) => {
      const store = repository();
      store.findCompletionState = vi.fn(async () => ({
        status: "completed" as const,
        task,
        attempt: { ...persistedAttempt, evaluationPromptVersion },
      }));
      const gateway = {
        model: "model-that-must-not-run",
        complete: vi.fn(async () => { throw new Error("Provider must be skipped"); }),
      };
      const { service: complete } = service(store, { ci: false, gateway });

      await expect(complete.complete(USER, REVIEW, {
        responseChinese: persistedAttempt.responseChinese,
        assistanceLevel: persistedAttempt.assistanceLevel,
      })).resolves.toMatchObject({ created: true, coaching: null });
      expect(store.resolveActiveGatewayPin).not.toHaveBeenCalled();
      expect(gateway.complete).not.toHaveBeenCalled();
      expect(store.completeDuePractice).toHaveBeenCalledWith(expect.objectContaining({ evaluationPromptVersion }));
    },
  );

  test("rejects an unknown completed Due evaluation version without Provider or completion RPC use", async () => {
    const store = repository();
    store.findCompletionState = vi.fn(async () => ({
      status: "completed" as const,
      task,
      attempt: { ...persistedAttempt, evaluationPromptVersion: "evaluate-practice-v999" },
    }));
    const gateway = {
      model: "model-that-must-not-run",
      complete: vi.fn(async () => { throw new Error("Provider must be skipped"); }),
    };
    const { service: complete } = service(store, { ci: false, gateway });

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: persistedAttempt.responseChinese,
      assistanceLevel: persistedAttempt.assistanceLevel,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.resolveActiveGatewayPin).not.toHaveBeenCalled();
    expect(gateway.complete).not.toHaveBeenCalled();
    expect(store.completeDuePractice).not.toHaveBeenCalled();
  });

  test("canonicalizes a persisted +00:00 replay instant before schedule validation and the RPC", async () => {
    const store = repository();
    store.findCompletionState = vi.fn(async () => ({
      status: "completed" as const,
      task: { ...task, dueAt: "2026-08-21T12:00:00+00:00" },
      attempt: { ...persistedAttempt, submittedAt: "2026-08-22T12:00:00+00:00" },
    }));
    store.completeDuePractice = vi.fn(async () => ({
      reviewTaskId: REVIEW, practiceTaskId: TASK,
      attemptId: "66666666-6666-4666-8666-666666666666",
      masteryEventId: "77777777-7777-4777-8777-777777777777",
      nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
      priorState: "tried" as const, newState: "reused" as const,
      nextDueAt: "2026-08-29T12:00:00+00:00", intervalDays: 7, created: false,
    }));
    const gateway = { model: "must-not-run", complete: vi.fn(async () => ({})) };
    const { service: complete } = service(store, {
      ci: false, gateway, now: () => "2026-09-01T18:30:00+00:00",
    });

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: persistedAttempt.responseChinese,
      assistanceLevel: persistedAttempt.assistanceLevel,
    })).resolves.toMatchObject({ nextDueAt: "2026-08-29T12:00:00.000Z", created: false });
    expect(store.completeDuePractice).toHaveBeenCalledWith(expect.objectContaining({
      completedAt: "2026-08-22T12:00:00.000Z",
    }));
    expect(gateway.complete).not.toHaveBeenCalled();
  });

  test.each([
    { responseChinese: "换一个回答。", assistanceLevel: "none" as const },
    { responseChinese: persistedAttempt.responseChinese, assistanceLevel: "hint" as const },
  ])("fails closed on a changed retry before Provider or RPC: $assistanceLevel", async (input) => {
    const store = repository();
    store.findCompletionState = vi.fn(async () => ({
      status: "completed" as const,
      task,
      attempt: persistedAttempt,
    }));
    const gateway = { model: "must-not-run", complete: vi.fn(async () => ({})) };
    const { service: complete } = service(store, { ci: false, gateway });

    await expect(complete.complete(USER, REVIEW, input)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(store.resolveActiveGatewayPin).not.toHaveBeenCalled();
    expect(gateway.complete).not.toHaveBeenCalled();
    expect(store.completeDuePractice).not.toHaveBeenCalled();
  });

  test.each([
    { status: "cancelled" as const, dueAt: "2026-08-21T12:00:00.000Z" },
    { status: "pending" as const, dueAt: "2026-08-23T12:00:00.000Z" },
  ])("rejects an existing $status review that is not eligible before Provider", async ({ status, dueAt }) => {
    const store = repository();
    store.findCompletionState = vi.fn(async () => ({
      status,
      task: { ...task, dueAt },
      attempt: null,
    }));
    const gateway = { model: "must-not-run", complete: vi.fn(async () => ({})) };
    const { service: complete } = service(store, { gateway });

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "太离谱了。", assistanceLevel: "none",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(gateway.complete).not.toHaveBeenCalled();
    expect(store.completeDuePractice).not.toHaveBeenCalled();
  });

  test.each([
    { priorState: "tried" as const, newState: "tried" as const, intervalDays: 7, nextDueAt: "2026-08-29T12:00:00.000Z" },
    { priorState: "tried" as const, newState: "owned" as const, intervalDays: 30, nextDueAt: "2026-09-21T12:00:00.000Z" },
    { priorState: "reused" as const, newState: "tried" as const, intervalDays: 7, nextDueAt: "2026-08-29T12:00:00.000Z" },
  ])("rejects illegal independent mastery result $priorState -> $newState", async (result) => {
    const store = repository();
    const taskForState = { ...task, masteryState: result.priorState };
    store.findTransferTask = vi.fn(async () => taskForState);
    store.findCompletionState = vi.fn(async () => pendingState(taskForState));
    store.completeDuePractice = vi.fn(async () => ({
      reviewTaskId: REVIEW, practiceTaskId: TASK,
      attemptId: "66666666-6666-4666-8666-666666666666",
      masteryEventId: "77777777-7777-4777-8777-777777777777",
      nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
      ...result,
      created: true,
    }));
    const { service: complete } = service(store);

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "这也太离谱了吧。", assistanceLevel: "none",
    })).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  test.each([
    { masteryState: "tried" as const, newState: "reused" as const, intervalDays: 7, nextDueAt: "2026-08-29T12:00:00.000Z" },
    { masteryState: "reused" as const, newState: "reused" as const, intervalDays: 7, nextDueAt: "2026-08-29T12:00:00.000Z" },
    { masteryState: "reused" as const, newState: "owned" as const, intervalDays: 30, nextDueAt: "2026-09-21T12:00:00.000Z" },
    { masteryState: "owned" as const, newState: "owned" as const, intervalDays: 30, nextDueAt: "2026-09-21T12:00:00.000Z" },
  ])("accepts legal independent mastery result $masteryState -> $newState", async (result) => {
    const store = repository();
    const taskForState = { ...task, masteryState: result.masteryState };
    store.findTransferTask = vi.fn(async () => taskForState);
    store.findCompletionState = vi.fn(async () => pendingState(taskForState));
    store.completeDuePractice = vi.fn(async () => ({
      reviewTaskId: REVIEW, practiceTaskId: TASK,
      attemptId: "66666666-6666-4666-8666-666666666666",
      masteryEventId: "77777777-7777-4777-8777-777777777777",
      nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
      priorState: result.masteryState, newState: result.newState,
      intervalDays: result.intervalDays, nextDueAt: result.nextDueAt, created: true,
    }));
    const { service: complete } = service(store);

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "这也太离谱了吧。", assistanceLevel: "none",
    })).resolves.toMatchObject({ newState: result.newState });
  });

  test("maps stale, future, and task-graph RPC rejections to a closed generic failure", async () => {
    for (const message of ["stale review", "future due", "task graph mismatch"]) {
      const store = repository();
      store.completeDuePractice = vi.fn(async () => { throw new Error(message); });
      const { service: complete } = service(store);
      await expect(complete.complete(USER, REVIEW, { responseChinese: "太离谱了。", assistanceLevel: "none" }))
        .rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    }
  });
});
