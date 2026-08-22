import { describe, expect, test, vi } from "vitest";

import {
  createDuePracticeCompletionService,
  type DuePracticeCompletionRepository,
  type DueTransferTask,
} from "@/server/domain/complete-due-practice";
import { createEvaluationFixtureGateway } from "@/server/ai/prompts/evaluate.v1";

const USER = "11111111-1111-4111-8111-111111111111";
const REVIEW = "22222222-2222-4222-8222-222222222222";
const TASK = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-08-22T12:00:00.000Z";

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

function repository(): DuePracticeCompletionRepository {
  return {
    findTransferTask: vi.fn(async () => task),
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

function service(store = repository(), options: { ci?: boolean; gateway?: { model: string; complete: () => Promise<unknown> } } = {}) {
  return {
    store,
    service: createDuePracticeCompletionService({
      repository: store,
      ci: options.ci ?? true,
      fixtureGateway: options.gateway ?? createEvaluationFixtureGateway(),
      gatewayResolver: { resolve: vi.fn(async () => options.gateway ?? createEvaluationFixtureGateway()) },
      now: () => NOW,
    }),
  };
}

describe("complete due Practice", () => {
  test("submits independent evidence before the sole completion RPC and returns its immutable transition", async () => {
    const { service: complete, store } = service();

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "这也太离谱了吧。",
      assistanceLevel: "none",
    })).resolves.toMatchObject({
      attemptId: "66666666-6666-4666-8666-666666666666",
      transition: { from: "tried", to: "reused" },
      created: true,
    });
    expect(store.completeDuePractice).toHaveBeenCalledOnce();
    expect(store.completeDuePractice).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER, reviewTaskId: REVIEW, practiceTaskId: TASK,
      assistanceLevel: "none", passed: true, completedAt: NOW,
    }));
    expect(store.resolveActiveGatewayPin).not.toHaveBeenCalled();
  });

  test("accepts the RPC-owned transition to owned only with its thirty-day immutable schedule", async () => {
    const store = repository();
    store.findTransferTask = vi.fn(async () => ({ ...task, masteryState: "reused" as const }));
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
    store.completeDuePractice = vi.fn(async () => ({
      reviewTaskId: REVIEW, practiceTaskId: TASK, attemptId: "66666666-6666-4666-8666-666666666666",
      masteryEventId: "77777777-7777-4777-8777-777777777777", nextReviewTaskId: "88888888-8888-4888-8888-888888888888",
      priorState: "reused" as const, newState: "reused" as const, nextDueAt: "2026-08-23T12:00:00.000Z", intervalDays: 1, created: true,
    }));
    const { service: complete } = service(store);

    await expect(complete.complete(USER, REVIEW, {
      responseChinese: "太离谱了。", assistanceLevel: "hint",
    })).resolves.toMatchObject({ transition: null, intervalDays: 1 });
    expect(store.completeDuePractice).toHaveBeenCalledWith(expect.objectContaining({
      passed: true, assistanceLevel: "hint",
    }));
  });

  test("fails closed before evaluating or writing a cross-owner, stale, or mismatched task", async () => {
    const store = repository();
    store.findTransferTask = vi.fn(async () => ({ ...task, userId: "99999999-9999-4999-8999-999999999999" }));
    const gateway = { model: "unsafe", complete: vi.fn(async () => ({})) };
    const { service: complete } = service(store, { gateway });

    await expect(complete.complete(USER, REVIEW, { responseChinese: "太离谱了。", assistanceLevel: "none" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(gateway.complete).not.toHaveBeenCalled();
    expect(store.completeDuePractice).not.toHaveBeenCalled();
  });

  test("does not call the completion RPC when the gateway fails", async () => {
    const store = repository();
    const { service: complete } = service(store, {
      gateway: { model: "fixture/failure", complete: vi.fn(async () => { throw new Error("baseUrl=secret"); }) },
    });

    await expect(complete.complete(USER, REVIEW, { responseChinese: "太离谱了。", assistanceLevel: "none" }))
      .rejects.toMatchObject({ code: "PROVIDER_FAILED" });
    expect(store.completeDuePractice).not.toHaveBeenCalled();
  });

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
