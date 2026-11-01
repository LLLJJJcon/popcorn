import { describe, expect, it, vi } from "vitest";
import { createReviewRevisionService } from "./review-revisions";
import { PracticeError } from "./create-practice-task";
import { ModelGatewayError } from "@/server/ai/provider";
import type { StructuredJsonCompletionOptions, StructuredJsonGateway } from "@/server/ai/structured-json-gateway";
import type { ReviewContext, ReviewPracticeRepository } from "@/server/repositories/review-practice-repository";
import type { ReviewRevisionInput, ReviewRevisionResponse, DueTransfer } from "@/contracts/review-practice";
import type { LearningCardFields } from "@/contracts/knowledge";

const owner = "42000000-0000-4000-8000-000000000001", review = "42000000-0000-4000-8000-000000000002", task = "42000000-0000-4000-8000-000000000003", attempt = "42000000-0000-4000-8000-000000000004", request = "42000000-0000-4000-8000-000000000005", revisionId = "42000000-0000-4000-8000-000000000006";
const now = "2026-11-01T12:00:00.000Z", fingerprint = "a".repeat(64);
const input: ReviewRevisionInput = { taskId: task, scenarioVersion: 1, scenarioFingerprint: fingerprint, attemptId: attempt, requestId: request, responseChinese: "这个价格高得要命，我不想买。" };
const card: LearningCardFields = { meaningHere: "Outrageously high.", useItWhen: "Complain about excessive prices.", comparedWith: "很高 is neutral.", howItFits: "After an adjective.", toneAndWho: "Casual with friends.", watchOut: null, examples: null, functionCategories: ["complain"], usageSettings: ["casual_chat"], suitability: "expression" };
const wire = (score = 4, naturalRevisionChinese = "这个价格高得要命，还是不买了。") => ({ accuracy: { score, englishFeedback: "The meaning is correct." }, naturalness: { score, englishFeedback: "The wording fits." }, contextualFit: { score, englishFeedback: "The complaint fits." }, naturalRevisionChinese });
function harness() {
  const evaluation = { ...wire(4), passed: true, independentUse: true, assistanceLevel: "none" as const };
  const { naturalRevisionChinese: _revision, ...officialEvaluation } = evaluation; void _revision;
  const receipt = { reviewTaskId: review, practiceTaskId: task, attemptId: attempt, masteryEventId: owner, nextReviewTaskId: revisionId, priorState: "tried" as const, newState: "reused" as const, nextDueAt: "2026-11-08T12:00:00.000Z", intervalDays: 7, created: true, transition: { from: "tried" as const, to: "reused" as const } };
  const prepared: DueTransfer = { status: "ready", id: task, reviewTaskId: review, targetExpression: "高得要命", promptChinese: "你和朋友看见一支笔卖两百元，朋友问你想不想买。", instructionsEnglish: "Complain about the price.", goalEnglish: "Use the target expression naturally.", scenarioVersion: 1, scenarioFingerprint: fingerprint, situationEn: "Your friend asks if you want a pen costing two hundred yuan.", interlocutor: "朋友", taskEn: "Complain about the price.", targetFunction: "complain", targetSetting: "casual_chat", transferType: "near", metadataMode: "modern", scenarioSource: "model", canRegenerate: false, expressionRevealed: false,
    material: { task: { kind: "due_practice", id: task, userExpressionId: owner, nativeLanguage: "en", targetLanguage: "zh-CN", targetExpression: "高得要命", promptChinese: "你和朋友看见一支笔卖两百元，朋友问你想不想买。", instructionsEnglish: "Complain about the price.", goalEnglish: "Use the target expression naturally.", createdAt: now, dueAt: now, situation: { situationZh: "你和朋友看见一支笔卖两百元，朋友问你想不想买。", situationEn: "Your friend asks if you want a pen costing two hundred yuan.", interlocutor: "朋友", taskEn: "Complain about the price.", targetFunction: "complain", targetSetting: "casual_chat" } }, masteryState: "tried", learningCard: card, examplesOpened: false, source: { videoTitle: "Test source", youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk", evidenceText: "这里的房价高得要命。", startSeconds: 1 }, expression: { englishMeaning: "Outrageously high.", englishExplanation: "Complain about excess.", tone: "Casual.", communicativeFunction: "Complaint.", register: "Informal." } },
    reviewState: { reviewTaskId: review, identity: { taskId: task, scenarioVersion: 1, scenarioFingerprint: fingerprint }, regenerated: false, canRegenerate: false, expressionRevealedAt: null, examplesOpenedAt: null, firstAnswer: { attemptId: attempt, responseChinese: "价格高得要命。", evaluation: officialEvaluation, coaching: null, naturalVersion: null, submittedAt: now, result: receipt }, latestRevision: null },
  };
  const context: ReviewContext = { userId: owner, reviewTaskId: review, userExpressionId: owner, sourceId: owner, status: "completed", dueAt: now, masteryState: "reused", targetExpression: "高得要命", card, prepared, history: [], lastTransferType: "near" };
  const published: Parameters<ReviewPracticeRepository["publishRevision"]>[4][] = [];
  let cached: ReviewRevisionResponse | null = null;
  const repository = {
    read: vi.fn(async () => context as ReviewContext | null), resolveActiveGatewayPin: vi.fn(async () => ({ configId: owner, revision: 1, fingerprint: "b".repeat(64) })),
    lookupRevision: vi.fn(async (_user: string, _review: string, candidate: ReviewRevisionInput) => { if (cached && candidate.requestId === request) { if (candidate.responseChinese !== input.responseChinese) throw new PracticeError("IDEMPOTENCY_CONFLICT"); return { kind: "ready" as const, response: cached }; } return null; }),
    claimRevision: vi.fn(async () => ({ kind: "claimed" as const, token: "claim-token" })),
    publishRevision: vi.fn(async (_user: string, _review: string, candidate: ReviewRevisionInput, _token: string, result: Parameters<ReviewPracticeRepository["publishRevision"]>[4]) => {
      published.push(result);
      const revision = { id: revisionId, requestId: candidate.requestId, attemptId: candidate.attemptId, taskId: candidate.taskId, scenarioVersion: candidate.scenarioVersion, scenarioFingerprint: candidate.scenarioFingerprint, responseChinese: candidate.responseChinese, evaluation: result.evaluation, coaching: result.coaching, naturalVersion: result.coaching?.naturalRevisionChinese ?? null, createdAt: now };
      cached = { revision, reviewState: { ...prepared.reviewState, latestRevision: revision } }; return cached;
    }), failRevision: vi.fn(async () => true),
  };
  let response: unknown = wire();
  const complete = vi.fn(async <T>(_version: string, _prompt: string, options: StructuredJsonCompletionOptions<T>): Promise<T> => {
    const decoded = options.normalize(response as Record<string, unknown>);
    if (!decoded.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema");
    return decoded.data;
  });
  const gateway: StructuredJsonGateway = { model: "fixture/review-revision", complete: complete as StructuredJsonGateway["complete"] };
  const gatewayResolver = { resolve: vi.fn(async () => gateway) };
  const deps = { repository: repository as unknown as ReviewPracticeRepository, gatewayResolver, fixtureGateway: gateway, ci: false, now: () => now };
  const service = createReviewRevisionService(deps);
  return { repository, context, prepared, complete, gatewayResolver, published, service, deps, setWire(value: unknown) { response = value; } };
}

describe("independent due-review revisions", () => {
  it("uses the frozen modern v5 task and writes only a revision result", async () => {
    const h = harness(), before = structuredClone(h.context);
    const result = await h.service.revise(owner, review, input);
    expect(result.revision.responseChinese).toBe(input.responseChinese);
    expect(h.published[0]).toMatchObject({ promptVersion: "evaluate-practice-v5", model: "fixture/review-revision", evaluation: { assistanceLevel: "none", independentUse: true } });
    expect(h.complete.mock.calls[0][2]).toMatchObject({ maxTokens: 1844, timeoutMs: 30000 });
    const data = JSON.parse(h.complete.mock.calls[0][1].split("\n")[0]);
    expect(data).toMatchObject({ targetExpression: "高得要命", targetMeaning: card.meaningHere, situationZh: h.prepared.promptChinese, learnerResponse: input.responseChinese, targetFunction: { value: "complain" }, targetSetting: { value: "casual_chat" } });
    expect(data).not.toHaveProperty("sourceLine");
    expect(h.context).toEqual(before);
    expect(h.repository.publishRevision).toHaveBeenCalledWith(owner, review, input, "claim-token", expect.any(Object), now);
  });
  it("replays an uncertain success with zero new gateway lookups or claims and rejects a changed same-ID signature", async () => {
    const h = harness();
    const first = await h.service.revise(owner, review, input);
    h.complete.mockClear(); h.gatewayResolver.resolve.mockClear(); h.repository.resolveActiveGatewayPin.mockClear(); h.repository.claimRevision.mockClear();
    expect(await h.service.revise(owner, review, input)).toBe(first);
    expect(h.complete).not.toHaveBeenCalled(); expect(h.gatewayResolver.resolve).not.toHaveBeenCalled(); expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled(); expect(h.repository.claimRevision).not.toHaveBeenCalled();
    await expect(h.service.revise(owner, review, { ...input, responseChinese: "这里高得要命。" })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(h.complete).not.toHaveBeenCalled();
  });
  it.each(["bad-user", "bad-review", "bad-input", "missing", "foreign-owner", "foreign-review", "not-completed", "cancelled", "foreign-attempt", "stale-task", "stale-version", "stale-hash", "missing-prepared", "missing-first", "receipt-attempt", "receipt-task", "receipt-review", "state-identity"])("rejects %s before gateway lookup or operation claim", async kind => {
    const h = harness(); let user = owner, reviewId = review; const value = { ...input };
    if (kind === "bad-user") user = "invalid";
    if (kind === "bad-review") reviewId = "invalid";
    if (kind === "bad-input") value.responseChinese = "";
    if (kind === "missing") h.repository.read.mockResolvedValue(null);
    if (kind === "foreign-owner") h.context.userId = revisionId;
    if (kind === "foreign-review") h.context.reviewTaskId = revisionId;
    if (kind === "not-completed") h.context.status = "pending";
    if (kind === "cancelled") h.context.status = "cancelled";
    if (kind === "foreign-attempt") value.attemptId = revisionId;
    if (kind === "stale-task") value.taskId = revisionId;
    if (kind === "stale-version") value.scenarioVersion = 2;
    if (kind === "stale-hash") value.scenarioFingerprint = "c".repeat(64);
    if (kind === "missing-prepared") h.context.prepared = null;
    if (kind === "missing-first") h.prepared.reviewState.firstAnswer = null;
    if (kind === "receipt-attempt") h.prepared.reviewState.firstAnswer!.result.attemptId = revisionId;
    if (kind === "receipt-task") h.prepared.reviewState.firstAnswer!.result.practiceTaskId = revisionId;
    if (kind === "receipt-review") h.prepared.reviewState.firstAnswer!.result.reviewTaskId = revisionId;
    if (kind === "state-identity") h.prepared.reviewState.identity.scenarioFingerprint = "c".repeat(64);
    await expect(h.service.revise(user, reviewId, value)).rejects.toBeInstanceOf(PracticeError);
    expect(h.repository.lookupRevision).not.toHaveBeenCalled(); expect(h.repository.claimRevision).not.toHaveBeenCalled(); expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled(); expect(h.complete).not.toHaveBeenCalled();
  });
  it("preserves the request ID through gateway setup because no operation was claimed", async () => {
    const h = harness(); h.repository.resolveActiveGatewayPin.mockResolvedValueOnce(null as never);
    await expect(h.service.revise(owner, review, input)).rejects.toMatchObject({ code: "GATEWAY_REQUIRED" });
    expect(h.repository.claimRevision).not.toHaveBeenCalled(); expect(h.repository.failRevision).not.toHaveBeenCalled();
    expect((await h.service.revise(owner, review, input)).revision.requestId).toBe(request);
  });
  it("returns known pending and failed receipts before egress, while a new request may retry failure", async () => {
    const h = harness();
    h.repository.lookupRevision.mockResolvedValueOnce({ kind: "pending" } as never).mockResolvedValueOnce({ kind: "failed", code: "PROVIDER_OUTPUT_INVALID" } as never);
    await expect(h.service.revise(owner, review, input)).rejects.toMatchObject({ code: "REQUEST_IN_PROGRESS", details: { operation: { kind: "revision", requestId: request, state: "in_progress" } } });
    await expect(h.service.revise(owner, review, input)).rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID", details: { operation: { kind: "revision", requestId: request, state: "failed" } } });
    expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled(); expect(h.repository.claimRevision).not.toHaveBeenCalled(); expect(h.complete).not.toHaveBeenCalled();
    expect((await h.service.revise(owner, review, { ...input, requestId: revisionId })).revision.requestId).toBe(revisionId);
  });
  it("joins a concurrent claim and never sends a duplicate model request", async () => {
    const h = harness(); h.repository.claimRevision.mockResolvedValue({ kind: "pending" } as never);
    await expect(h.service.revise(owner, review, input)).rejects.toMatchObject({ code: "REQUEST_IN_PROGRESS" });
    expect(h.complete).not.toHaveBeenCalled(); expect(h.repository.failRevision).not.toHaveBeenCalled();
  });
  it("evaluates only once when the same revision is submitted concurrently", async () => {
    const h = harness(), evaluate = h.complete.getMockImplementation()!;
    let release!: () => void, entered!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    h.complete.mockImplementationOnce(async (...args) => { entered(); await blocked; return evaluate(...args); });
    h.repository.claimRevision.mockResolvedValue({ kind: "pending" } as never).mockResolvedValueOnce({ kind: "claimed", token: "claim-token" });
    const first = h.service.revise(owner, review, input);
    await started;
    await expect(h.service.revise(owner, review, input)).rejects.toMatchObject({ code: "REQUEST_IN_PROGRESS" });
    release();
    expect((await first).revision.requestId).toBe(request);
    expect(h.complete).toHaveBeenCalledTimes(1); expect(h.repository.publishRevision).toHaveBeenCalledTimes(1);
  });
  it("handles a receipt published between lookup and claim without a second evaluation", async () => {
    const h = harness(); const first = await h.service.revise(owner, review, input);
    h.repository.lookupRevision.mockResolvedValueOnce(null); h.repository.claimRevision.mockResolvedValueOnce({ kind: "ready", response: first } as never); h.complete.mockClear();
    expect(await h.service.revise(owner, review, input)).toBe(first); expect(h.complete).not.toHaveBeenCalled();
  });
  it("caps invalid scoring at four format attempts and marks one failed cycle without publication", async () => {
    const h = harness(); h.setWire({ accuracy: { score: 9 } });
    await expect(h.service.revise(owner, review, input)).rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID", details: { operation: { kind: "revision", requestId: request, state: "failed" } } });
    expect(h.complete).toHaveBeenCalledTimes(4); expect(h.repository.publishRevision).not.toHaveBeenCalled(); expect(h.repository.failRevision).toHaveBeenCalledWith(owner, review, request, "claim-token", "PROVIDER_OUTPUT_INVALID", now);
  });
  it("does not format-retry a transport failure", async () => {
    const h = harness(); h.complete.mockRejectedValue(new ModelGatewayError("PROVIDER_UNAVAILABLE", "transport"));
    await expect(h.service.revise(owner, review, input)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(h.complete).toHaveBeenCalledTimes(1); expect(h.repository.failRevision).toHaveBeenCalledTimes(1);
  });
  it("recovers a committed revision whose publication response was lost, preserving same-ID replay", async () => {
    const h = harness(), persist = h.repository.publishRevision.getMockImplementation()!;
    h.repository.publishRevision.mockImplementationOnce(async (...args) => { await persist(...args); throw new Error("unknown publication response"); });
    h.repository.failRevision.mockResolvedValue(false);
    const first = await h.service.revise(owner, review, input);
    expect(first.revision.requestId).toBe(request); expect(h.complete).toHaveBeenCalledTimes(1);
    expect(await h.service.revise(owner, review, input)).toBe(first); expect(h.complete).toHaveBeenCalledTimes(1);
  });
  it.each(["pending", "failed", "unknown"])("rechecks the request when failure publication was not confirmed: %s", async state => {
    const h = harness(); h.complete.mockRejectedValue(new ModelGatewayError("PROVIDER_UNAVAILABLE", "transport")); h.repository.failRevision.mockResolvedValue(false);
    h.repository.lookupRevision.mockResolvedValueOnce(null).mockResolvedValueOnce(state === "pending" ? { kind: "pending" } as never : state === "failed" ? { kind: "failed", code: "PROVIDER_UNAVAILABLE" } as never : null);
    const error = await h.service.revise(owner, review, input).catch(value => value);
    expect(error).toBeInstanceOf(PracticeError);
    expect(error.code).toBe(state === "pending" ? "REQUEST_IN_PROGRESS" : "PROVIDER_UNAVAILABLE");
    if (state === "unknown") expect(error.details?.operation).toBeUndefined();
    else expect(error.details?.operation).toEqual({ kind: "revision", requestId: request, state: state === "pending" ? "in_progress" : "failed" });
    expect(h.complete).toHaveBeenCalledTimes(1);
  });
  it("keeps the same request identity when both failure persistence and its lookup are unknown", async () => {
    const h = harness(); h.complete.mockRejectedValue(new ModelGatewayError("PROVIDER_UNAVAILABLE", "transport")); h.repository.failRevision.mockRejectedValue(new Error("private persistence payload"));
    h.repository.lookupRevision.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("private lookup payload"));
    const error = await h.service.revise(owner, review, input).catch(value => value);
    expect(error).toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true });
    expect(error.details?.operation).toBeUndefined(); expect(error.message).not.toContain("private");
    h.repository.lookupRevision.mockResolvedValueOnce({ kind: "pending" } as never);
    await expect(h.service.revise(owner, review, input)).rejects.toMatchObject({ code: "REQUEST_IN_PROGRESS" });
    expect(h.complete).toHaveBeenCalledTimes(1);
  });
  it("uses current server examples only for revision assistance and preserves the official first result", async () => {
    const h = harness(); h.prepared.reviewState.examplesOpenedAt = now; const original = structuredClone(h.prepared.reviewState.firstAnswer);
    const result = await h.service.revise(owner, review, input);
    expect(result.revision.evaluation).toMatchObject({ passed: true, assistanceLevel: "model_answer", independentUse: false });
    expect(h.prepared.reviewState.firstAnswer).toEqual(original); expect(original?.evaluation.independentUse).toBe(true);
  });
  it("returns authoritative publisher assistance when another tab opens examples during evaluation", async () => {
    const h = harness(), persist = h.repository.publishRevision.getMockImplementation()!, official = structuredClone(h.prepared.reviewState.firstAnswer);
    h.repository.publishRevision.mockImplementationOnce(async (...args) => {
      const saved = await persist(...args);
      const revision = { ...saved.revision, evaluation: { ...saved.revision.evaluation, assistanceLevel: "model_answer" as const, independentUse: false } };
      return { revision, reviewState: { ...saved.reviewState, examplesOpenedAt: now, latestRevision: revision } };
    });
    const result = await h.service.revise(owner, review, input);
    expect(h.published[0].evaluation.assistanceLevel).toBe("none");
    expect(result.revision.evaluation).toMatchObject({ assistanceLevel: "model_answer", independentUse: false });
    expect(result.reviewState.examplesOpenedAt).toBe(now); expect(h.prepared.reviewState.firstAnswer).toEqual(official);
  });
  it("uses the evaluation fixture in CI without gateway lookup or a real pin", async () => {
    const h = harness(); h.deps.ci = true; h.repository.resolveActiveGatewayPin.mockResolvedValue(null as never);
    await h.service.revise(owner, review, input);
    expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled(); expect(h.gatewayResolver.resolve).not.toHaveBeenCalled();
    expect(h.published[0]).toMatchObject({ promptVersion: "evaluate-practice-v5", pin: null });
  });
  it.each(["full-five", "missing-target", "invalid-optional"])("keeps valid scores but omits %s coaching", async mode => {
    const h = harness(); h.setWire(mode === "full-five" ? wire(5) : mode === "missing-target" ? wire(4, "还是不要买了。") : { ...wire(), naturalRevisionChinese: 10 });
    const result = await h.service.revise(owner, review, input);
    expect(result.revision.coaching).toBeNull(); expect(result.revision.naturalVersion).toBeNull(); expect(h.complete).toHaveBeenCalledTimes(1);
  });
  it("scores an already prepared legacy task with v4 without inventing modern metadata", async () => {
    const h = harness(); h.context.card = null; h.prepared.metadataMode = "legacy"; h.prepared.scenarioSource = "legacy"; h.prepared.material.task.situation = null; h.prepared.targetFunction = null; h.prepared.targetSetting = null; h.prepared.transferType = null;
    h.setWire(wire(5)); const result = await h.service.revise(owner, review, input);
    expect(h.complete.mock.calls[0][0]).toBe("evaluate-practice-v4");
    expect(JSON.parse(h.complete.mock.calls[0][1].split("\n")[0])).toEqual({ task: "evaluation", targetExpression: "高得要命", promptChinese: h.prepared.promptChinese, learnerResponse: input.responseChinese });
    expect(result.revision.coaching).toBeNull();
  });
  it.each(["no-card", "no-situation"])("does not silently fall back from malformed modern metadata: %s", async mode => {
    const h = harness(); if (mode === "no-card") h.context.card = null; else h.prepared.material.task.situation = null;
    await expect(h.service.revise(owner, review, input)).rejects.toMatchObject({ code: "LEGACY_METADATA_REQUIRED" });
    expect(h.repository.claimRevision).not.toHaveBeenCalled(); expect(h.complete).not.toHaveBeenCalled();
  });
});
