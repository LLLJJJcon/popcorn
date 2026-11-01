import { describe, expect, it, vi } from "vitest";
import { createPrepareTransferTaskHandler } from "./prepare-transfer-task";
import type { KnowledgeJob, LearningCardFields } from "@/contracts/knowledge";
import type { DuePreparationPending } from "@/contracts/review-practice";
import type { DurableJobStore } from "@/server/jobs/process-jobs";
import { PracticeError } from "@/server/domain/create-practice-task";
import { createReviewPracticeService } from "@/server/domain/review-practice";
import type { ReviewContext, ReviewPracticeRepository, ReviewGeneratedScenario } from "@/server/repositories/review-practice-repository";
import { reviewTransferFixture } from "@/features/practice/review-fixtures.test-support";
import { createTransferScenarioFixtureGateway } from "@/server/ai/prompts/transfer-scenario.v1";
import { scenarioFingerprint } from "@/server/ai/prompts/activate.v2";
import type { StructuredJsonGateway } from "@/server/ai/structured-json-gateway";

type LeasedJob = Extract<KnowledgeJob, { status: "leased" }>;
const owner = "44000000-0000-4000-8000-000000000001", jobId = "44000000-0000-4000-8000-000000000002", task = "44000000-0000-4000-8000-000000000003", review = "44000000-0000-4000-8000-000000000004", foreign = "44000000-0000-4000-8000-000000000005";
const at = "2026-11-01T12:00:00.000Z";
const card: LearningCardFields = { meaningHere: "Outrageously high.", useItWhen: "Complain about excessive prices.", comparedWith: "很高 is neutral.", howItFits: "After an adjective.", toneAndWho: "Casual with friends.", watchOut: null, examples: null, functionCategories: ["complain"], usageSettings: ["casual_chat"], suitability: "expression" };
const readyFixture = () => reviewTransferFixture(review, {
  task: { kind: "due_practice", id: task, userExpressionId: owner, nativeLanguage: "en", targetLanguage: "zh-CN", targetExpression: "高得要命", promptChinese: "朋友问这支笔卖两百元合不合理。", instructionsEnglish: "Complain about the price.", goalEnglish: "Use the target expression.", createdAt: at, dueAt: at, situation: { situationZh: "朋友问这支笔卖两百元合不合理。", situationEn: "A friend asks whether a pen should cost two hundred yuan.", interlocutor: "朋友", taskEn: "Complain about the price.", targetFunction: "complain", targetSetting: "casual_chat" } },
  masteryState: "tried", learningCard: card, source: { videoTitle: "Synthetic source", youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk", evidenceText: "这里的价格高得要命。", startSeconds: 1 }, expression: { englishMeaning: "Outrageously high.", englishExplanation: "Complain about excessive prices.", tone: "Casual.", communicativeFunction: "Complaint.", register: "Informal." },
});
function harness() {
  const job: LeasedJob = { id: jobId, userId: owner, sourceId: foreign, savedItemId: null, type: "prepare_transfer_task", status: "leased", attemptCount: 1, dedupeKey: "a".repeat(64), createdAt: at, updatedAt: at, leaseExpiresAt: "2026-11-01T12:05:00.000Z", nextAttemptAt: null, lastErrorCode: null };
  const ready = readyFixture();
  const pending: DuePreparationPending = { status: "preparing", reviewTaskId: review, requestId: job.id, retryAfterMs: 1000 };
  const finish = vi.fn<NonNullable<DurableJobStore["finishReviewPreparationJob"]>>(async () => true);
  const forbidden = { readVideoId: vi.fn(), readLearningArtifactEvidence: vi.fn(), readSavedItemAnalysisEvidence: vi.fn(), persistSnapshotEvidence: vi.fn(), completeResolved: vi.fn(), completeGatewayLearningArtifact: vi.fn(), completeSavedItemHighlights: vi.fn(), transitionFailure: vi.fn(), transitionLearningArtifactFailure: vi.fn() };
  const privateInput = vi.fn(async (): Promise<unknown> => ({ kind: "prepare_transfer_task", reviewTaskId: review }));
  const store = { readPrivateInput: privateInput, finishReviewPreparationJob: finish, ...forbidden } as unknown as DurableJobStore;
  const service = { prepareInBackground: vi.fn<ReturnType<typeof createReviewPracticeService>["prepareInBackground"]>(async () => ready) };
  let milliseconds = Date.parse(at);
  const now = () => new Date(milliseconds).toISOString();
  const wait = vi.fn(async (duration: number) => { milliseconds += duration; });
  const handler = createPrepareTransferTaskHandler({ store, service, now, wait });
  return { job, ready, pending, store, service, finish, forbidden, privateInput, now, wait, handler, advance(duration: number) { milliseconds += duration; } };
}

describe("single-cycle transfer preparation worker", () => {
  it("finishes an already-ready task using the exact owned job lease, without source or Saved operations", async () => {
    const h = harness();
    expect(await h.handler(h.job, owner, at)).toBe("completed");
    expect(h.privateInput).toHaveBeenCalledWith(owner, jobId);
    expect(h.service.prepareInBackground).toHaveBeenCalledWith(owner, review, { jobId, attemptCount: 1, leaseExpiresAt: h.job.leaseExpiresAt });
    expect(h.finish).toHaveBeenCalledWith(owner, h.job, { status: "succeeded", reviewTaskId: review, taskId: task }, at);
    for (const forbidden of Object.values(h.forbidden)) expect(forbidden).not.toHaveBeenCalled();
    expect(h.wait).not.toHaveBeenCalled();
  });
  it.each(["foreign-owner", "wrong-type", "not-leased"])("rejects %s before reading input or making any write", async mode => {
    const h = harness(); const job = { ...h.job, ...(mode === "wrong-type" ? { type: "analyze_saved_item" } : mode === "not-leased" ? { status: "pending" } : {}) } as LeasedJob;
    await expect(h.handler(job, mode === "foreign-owner" ? foreign : owner, at)).rejects.toThrow();
    expect(h.privateInput).not.toHaveBeenCalled(); expect(h.service.prepareInBackground).not.toHaveBeenCalled(); expect(h.finish).not.toHaveBeenCalled();
  });
  it.each([null, {}, { kind: "other", reviewTaskId: review }, { kind: "prepare_transfer_task", reviewTaskId: "invalid" }, { kind: "prepare_transfer_task", reviewTaskId: review, sourceId: foreign }, { kind: "prepare_transfer_task", reviewTaskId: review, userId: foreign }])("terminally rejects invalid private input without a fake review identity", async value => {
    const h = harness(); h.privateInput.mockResolvedValue(value);
    expect(await h.handler(h.job, owner, at)).toBe("failed");
    expect(h.service.prepareInBackground).not.toHaveBeenCalled();
    expect(h.finish).toHaveBeenCalledWith(owner, h.job, { status: "terminal_failed", errorCode: "VALIDATION_FAILED" }, at);
  });
  it.each(["GATEWAY_REQUIRED", "LEGACY_METADATA_REQUIRED"] as const)("records known zero-model prerequisite %s only on the fenced job", async code => {
    const h = harness(); h.service.prepareInBackground.mockRejectedValue(new PracticeError(code));
    expect(await h.handler(h.job, owner, at)).toBe("failed");
    expect(h.finish).toHaveBeenCalledWith(owner, h.job, { status: "terminal_failed", reviewTaskId: review, errorCode: code }, at);
  });
  it("records a confirmed terminal model cycle without scheduling another durable execution", async () => {
    const h = harness(); h.service.prepareInBackground.mockRejectedValue(new PracticeError("PROVIDER_OUTPUT_INVALID", false, { operation: { kind: "prepare", requestId: jobId, state: "failed" } }));
    expect(await h.handler(h.job, owner, at)).toBe("failed"); expect(h.service.prepareInBackground).toHaveBeenCalledTimes(1);
    expect(h.finish).toHaveBeenCalledWith(owner, h.job, { status: "terminal_failed", reviewTaskId: review, errorCode: "PROVIDER_OUTPUT_INVALID" }, at);
    expect(h.forbidden.transitionFailure).not.toHaveBeenCalled(); expect(h.forbidden.transitionLearningArtifactFailure).not.toHaveBeenCalled();
  });
  it.each([
    new Error("private transport payload"), new PracticeError("PROVIDER_UNAVAILABLE", true), new PracticeError("INTERNAL_ERROR", true), new PracticeError("NOT_FOUND"),
    new PracticeError("PROVIDER_OUTPUT_INVALID", false, { operation: { kind: "prepare", requestId: foreign, state: "failed" } }),
  ])("defers unconfirmed outcomes without falsely writing terminal failure", async error => {
    const h = harness(); h.service.prepareInBackground.mockRejectedValue(error);
    expect(await h.handler(h.job, owner, at)).toBe("deferred"); expect(h.finish).not.toHaveBeenCalled(); expect(h.wait).not.toHaveBeenCalled();
  });
  it("polls the same job fence after preparing responses and in-progress errors", async () => {
    const h = harness(); h.service.prepareInBackground.mockResolvedValueOnce({ ...h.pending, requestId: foreign }).mockRejectedValueOnce(new PracticeError("REQUEST_IN_PROGRESS", true, { operation: { kind: "prepare", requestId: jobId, state: "in_progress" } })).mockResolvedValueOnce(h.ready);
    expect(await h.handler(h.job, owner, at)).toBe("completed");
    expect(h.wait.mock.calls.map(call => call[0])).toEqual([1000, 1000]);
    expect(h.service.prepareInBackground.mock.calls).toEqual(Array.from({ length: 3 }, () => [owner, review, { jobId, attemptCount: 1, leaseExpiresAt: h.job.leaseExpiresAt }]));
    expect(h.finish).toHaveBeenCalledWith(owner, h.job, { status: "succeeded", reviewTaskId: review, taskId: task }, "2026-11-01T12:00:02.000Z");
  });
  it("stops polling at the real job lease without declaring failure or publishing a stale finish", async () => {
    const h = harness(); h.job.leaseExpiresAt = "2026-11-01T12:00:02.000Z"; h.service.prepareInBackground.mockResolvedValue(h.pending);
    expect(await h.handler(h.job, owner, at)).toBe("deferred"); expect(h.service.prepareInBackground).toHaveBeenCalledTimes(2); expect(h.finish).not.toHaveBeenCalled();
  });
  it("bounds its last polling wait to the remaining fractional lease", async () => {
    const h = harness(); h.job.leaseExpiresAt = "2026-11-01T12:00:01.500Z"; h.service.prepareInBackground.mockResolvedValue(h.pending);
    expect(await h.handler(h.job, owner, at)).toBe("deferred");
    expect(h.wait.mock.calls.map(call => call[0])).toEqual([1000, 500]); expect(h.finish).not.toHaveBeenCalled();
  });
  it("uses the engineering poll bound even when an injected clock does not advance", async () => {
    const h = harness(); h.wait.mockImplementation(async () => {}); h.service.prepareInBackground.mockResolvedValue(h.pending);
    expect(await h.handler(h.job, owner, at)).toBe("deferred"); expect(h.service.prepareInBackground).toHaveBeenCalledTimes(300); expect(h.wait).toHaveBeenCalledTimes(299); expect(h.finish).not.toHaveBeenCalled();
  });
  it("does not finish a ready result after its lease expired while awaiting preparation", async () => {
    const h = harness(); h.service.prepareInBackground.mockImplementationOnce(async () => { h.advance(300000); return h.ready; });
    expect(await h.handler(h.job, owner, at)).toBe("deferred"); expect(h.finish).not.toHaveBeenCalled();
  });
  it.each(["ready", "known-failure"])("does not overwrite a changed job lease when finishing %s is rejected", async mode => {
    const h = harness(); h.finish.mockResolvedValue(false);
    if (mode === "known-failure") h.service.prepareInBackground.mockRejectedValue(new PracticeError("GATEWAY_REQUIRED"));
    expect(await h.handler(h.job, owner, at)).toBe("deferred"); expect(h.finish).toHaveBeenCalledTimes(1);
  });
  it("defers uncertain input/finish/wait persistence instead of invoking generic durable retries", async () => {
    const h = harness(); h.privateInput.mockRejectedValueOnce(new Error("private input unavailable"));
    expect(await h.handler(h.job, owner, at)).toBe("deferred"); expect(h.finish).not.toHaveBeenCalled(); expect(h.service.prepareInBackground).not.toHaveBeenCalled();
    h.finish.mockRejectedValue(new Error("private finish unavailable"));
    expect(await h.handler(h.job, owner, at)).toBe("deferred");
    h.service.prepareInBackground.mockResolvedValue(h.pending); h.wait.mockRejectedValueOnce(new Error("wait interrupted"));
    expect(await h.handler(h.job, owner, at)).toBe("deferred"); expect(h.forbidden.transitionFailure).not.toHaveBeenCalled();
  });
  it("defers without generation if the fenced finish port is unavailable", async () => {
    const h = harness(); delete h.store.finishReviewPreparationJob;
    expect(await h.handler(h.job, owner, at)).toBe("deferred"); expect(h.service.prepareInBackground).not.toHaveBeenCalled(); expect(h.privateInput).not.toHaveBeenCalled();
  });
  it("rejects a returned foreign review instead of completing the wrong owned job", async () => {
    const h = harness(); h.service.prepareInBackground.mockResolvedValue({ ...h.ready, reviewTaskId: foreign });
    expect(await h.handler(h.job, owner, at)).toBe("deferred"); expect(h.finish).not.toHaveBeenCalled();
  });
  it("does no input/model/write work for an already expired lease", async () => {
    const h = harness(); h.advance(300000);
    expect(await h.handler(h.job, owner, at)).toBe("deferred"); expect(h.privateInput).not.toHaveBeenCalled(); expect(h.service.prepareInBackground).not.toHaveBeenCalled(); expect(h.finish).not.toHaveBeenCalled();
  });
  it("coalesces with an actual concurrent GET coordinator and performs only one fixture model cycle", async () => {
    const h = harness(); let release!: () => void, entered!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    const fixture = createTransferScenarioFixtureGateway();
    const complete = vi.fn(async (...args: Parameters<StructuredJsonGateway["complete"]>) => { entered(); await blocked; return fixture.complete(...args); });
    const gateway: StructuredJsonGateway = { model: fixture.model, complete: complete as StructuredJsonGateway["complete"] };
    const context: ReviewContext = { userId: owner, reviewTaskId: review, userExpressionId: owner, sourceId: foreign, status: "pending", dueAt: at, masteryState: "tried", targetExpression: "高得要命", card, prepared: null, history: [], lastTransferType: null };
    let claimed = false;
    const repository = { read: vi.fn(async () => context), lookupPreparation: vi.fn(async () => null), claim: vi.fn(async (_user: string, _review: string, _kind: string, id: string | null) => {
      if (claimed) return { kind: "pending", requestId: id }; claimed = true;
      return { kind: "claimed", requestId: foreign, token: task, expectedVersion: 0, leaseExpiresAt: h.job.leaseExpiresAt };
    }), publish: vi.fn(async (_user: string, _review: string, _claim: unknown, generated: ReviewGeneratedScenario) => {
      const fingerprint = scenarioFingerprint(generated.scenario.situationZh);
      context.prepared = { ...h.ready, promptChinese: generated.scenario.situationZh, scenarioFingerprint: fingerprint, material: { ...h.ready.material, task: { ...h.ready.material.task, promptChinese: generated.scenario.situationZh, situation: { ...generated.scenario, targetFunction: generated.targetFunction.value, targetSetting: generated.targetSetting.value } } }, reviewState: { ...h.ready.reviewState, identity: { ...h.ready.reviewState.identity, scenarioFingerprint: fingerprint } } };
      return context.prepared;
    }), fail: vi.fn(async () => true) };
    const service = createReviewPracticeService({ repository: repository as unknown as ReviewPracticeRepository, gatewayResolver: { resolve: async () => gateway }, fixtureGateway: gateway, ci: true, now: h.now, id: () => foreign });
    const get = service.ensure(owner, review, {}); await started;
    h.wait.mockImplementationOnce(async duration => { release(); await get; h.advance(duration); });
    const handler = createPrepareTransferTaskHandler({ store: h.store, service, now: h.now, wait: h.wait });
    expect(await handler(h.job, owner, at)).toBe("completed");
    expect(complete).toHaveBeenCalledTimes(1); expect(repository.claim).toHaveBeenCalledTimes(2);
    expect(repository.claim.mock.calls[1][3]).toBe(jobId); expect(h.wait).toHaveBeenCalledTimes(1);
    expect(h.finish).toHaveBeenCalledWith(owner, h.job, { status: "succeeded", reviewTaskId: review, taskId: task }, "2026-11-01T12:00:01.000Z");
    h.finish.mockResolvedValueOnce(false);
    expect(await handler(h.job, owner, h.now())).toBe("deferred");
    expect(complete).toHaveBeenCalledTimes(1); expect(repository.claim).toHaveBeenCalledTimes(2);
    for (const forbidden of Object.values(h.forbidden)) expect(forbidden).not.toHaveBeenCalled();
  });
});
