import { describe, expect, it, vi } from "vitest";
import { createReviewCompletionService } from "./review-completion";
import { PracticeError, type PracticeErrorCode } from "./create-practice-task";
import { ModelGatewayError } from "@/server/ai/provider";
import type { StructuredJsonCompletionOptions, StructuredJsonGateway } from "@/server/ai/structured-json-gateway";
import type { ReviewContext, ReviewPracticeRepository, OfficialReviewCompletion, ReviewScoredOutput } from "@/server/repositories/review-practice-repository";
import type { DueReviewState, ReviewCompletionInput } from "@/contracts/review-practice";
import type { LearningCardFields } from "@/contracts/knowledge";
import type { PracticeMaterialView } from "@/features/practice/material-schema";
import { reviewTransferFixture } from "@/features/practice/review-fixtures.test-support";

const owner = "43000000-0000-4000-8000-000000000001", review = "43000000-0000-4000-8000-000000000002", task = "43000000-0000-4000-8000-000000000003", attempt = "43000000-0000-4000-8000-000000000004", request = "43000000-0000-4000-8000-000000000005", nextId = "43000000-0000-4000-8000-000000000006";
const at = "2026-11-01T12:00:00.000Z";
const input: ReviewCompletionInput = { taskId: task, scenarioVersion: 1, scenarioFingerprint: "a".repeat(64), requestId: request, responseChinese: "这个价格高得要命，我不想买。" };
const card: LearningCardFields = { meaningHere: "Outrageously high.", useItWhen: "Complain about excessive prices.", comparedWith: "很高 is neutral.", howItFits: "After an adjective.", toneAndWho: "Casual with friends.", watchOut: null, examples: null, functionCategories: ["complain"], usageSettings: ["casual_chat"], suitability: "expression" };
const wire = (score = 4, naturalRevisionChinese: unknown = "这个价格高得要命，还是不买了。") => ({ accuracy: { score, englishFeedback: "Accurate meaning." }, naturalness: { score, englishFeedback: "Natural wording." }, contextualFit: { score, englishFeedback: "Fits the complaint." }, naturalRevisionChinese });

function harness() {
  const material: PracticeMaterialView = {
    task: { kind: "due_practice", id: task, userExpressionId: owner, nativeLanguage: "en", targetLanguage: "zh-CN", targetExpression: "高得要命", promptChinese: "你和朋友看见一支笔卖两百元，朋友问你想不想买。", instructionsEnglish: "Complain about the price.", goalEnglish: "Use the target expression naturally.", createdAt: at, dueAt: at,
      situation: { situationZh: "你和朋友看见一支笔卖两百元，朋友问你想不想买。", situationEn: "Your friend asks if you want a pen costing two hundred yuan.", interlocutor: "朋友", taskEn: "Complain about the price.", targetFunction: "complain", targetSetting: "casual_chat" } },
    masteryState: "tried", learningCard: card, examplesOpened: false,
    source: { videoTitle: "Synthetic source", youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk", evidenceText: "这里的价格高得要命。", startSeconds: 1 },
    expression: { englishMeaning: "Outrageously high.", englishExplanation: "Complain about excessive prices.", tone: "Casual.", communicativeFunction: "Complaint.", register: "Informal." },
  };
  const prepared = reviewTransferFixture(review, material);
  const context: ReviewContext = { userId: owner, reviewTaskId: review, userExpressionId: owner, sourceId: owner, status: "pending", dueAt: at, masteryState: "tried", targetExpression: "高得要命", card, prepared, history: [], lastTransferType: "near" };
  type Cycle = { input: ReviewCompletionInput; kind: "claimed" | "failed" | "ready"; code?: PracticeErrorCode; response?: OfficialReviewCompletion };
  const cycles = new Map<string, Cycle>();
  const published: (ReviewScoredOutput & { submittedAt: string })[] = [];
  let completed: DueReviewState | null = null, responseWire: unknown = wire(), clock = at, forceAssisted = false;
  const makeResponse = (result: ReviewScoredOutput & { submittedAt: string }): OfficialReviewCompletion => {
    const evaluation = forceAssisted ? { ...result.evaluation, independentUse: false, assistanceLevel: "model_answer" as const } : result.evaluation;
    const independent = evaluation.independentUse;
    const receipt = { reviewTaskId: review, practiceTaskId: task, attemptId: attempt, masteryEventId: owner, nextReviewTaskId: nextId, priorState: "tried" as const, newState: independent ? "reused" as const : "tried" as const, nextDueAt: independent ? "2026-11-08T12:00:00.000Z" : "2026-11-02T12:00:00.000Z", intervalDays: independent ? 7 : 1, created: true, transition: independent ? { from: "tried" as const, to: "reused" as const } : null };
    const reviewState: DueReviewState = { ...prepared.reviewState, canRegenerate: false, ...(forceAssisted ? { examplesOpenedAt: clock, expressionRevealedAt: clock } : {}), firstAnswer: { attemptId: attempt, responseChinese: input.responseChinese, evaluation, coaching: result.coaching, naturalVersion: result.coaching?.naturalRevisionChinese ?? null, submittedAt: result.submittedAt, result: { ...receipt, created: false } } };
    return { ...receipt, evaluation, coaching: result.coaching, reviewState };
  };
  const repository = {
    lookupCompletion: vi.fn(async (_user: string, _review: string, candidate: ReviewCompletionInput) => {
      const cycle = cycles.get(candidate.requestId);
      if (!cycle) return null;
      if (JSON.stringify(cycle.input) !== JSON.stringify(candidate)) throw new PracticeError("IDEMPOTENCY_CONFLICT");
      if (cycle.kind === "ready") return { kind: "ready" as const, response: cycle.response! };
      if (cycle.kind === "failed") return { kind: "failed" as const, code: cycle.code! };
      return { kind: "pending" as const };
    }),
    completionState: vi.fn(async () => completed), read: vi.fn(async () => context as ReviewContext | null),
    resolveActiveGatewayPin: vi.fn(async () => ({ configId: owner, revision: 1, fingerprint: "b".repeat(64) })),
    claimCompletion: vi.fn(async (_user: string, _review: string, candidate: ReviewCompletionInput) => {
      const existing = cycles.get(candidate.requestId); if (existing?.kind === "ready") return { kind: "ready" as const, response: existing.response! }; if (existing) return { kind: "pending" as const };
      cycles.set(candidate.requestId, { input: candidate, kind: "claimed" }); return { kind: "claimed" as const, token: "claim-token" };
    }),
    publishCompletion: vi.fn(async (_user: string, _review: string, candidate: ReviewCompletionInput, _token: string, result: ReviewScoredOutput & { submittedAt: string }) => {
      published.push(result); const response = makeResponse(result); completed = response.reviewState;
      cycles.set(candidate.requestId, { input: candidate, kind: "ready", response: { ...response, created: false } }); return response;
    }),
    failCompletion: vi.fn(async (_user: string, _review: string, id: string, _token: string, code: PracticeErrorCode) => {
      const cycle = cycles.get(id); if (!cycle || cycle.kind !== "claimed") return false; cycle.kind = "failed"; cycle.code = code; return true;
    }),
  };
  const complete = vi.fn(async <T>(_version: string, _prompt: string, options: StructuredJsonCompletionOptions<T>): Promise<T> => { const decoded = options.normalize(responseWire as Record<string, unknown>); if (!decoded.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema"); return decoded.data; });
  const gateway: StructuredJsonGateway = { model: "fixture/review-completion", complete: complete as StructuredJsonGateway["complete"] };
  const gatewayResolver = { resolve: vi.fn(async () => gateway) };
  const deps = { repository: repository as unknown as ReviewPracticeRepository, gatewayResolver, fixtureGateway: gateway, ci: false, now: () => clock };
  const service = createReviewCompletionService(deps);
  const exampleEvaluation = { accuracy: { score: 4, englishFeedback: "Accurate meaning." }, naturalness: { score: 4, englishFeedback: "Natural wording." }, contextualFit: { score: 4, englishFeedback: "Fits the complaint." }, passed: true, independentUse: true, assistanceLevel: "none" as const };
  return { repository, context, prepared, cycles, published, complete, gatewayResolver, deps, service,
    setWire(value: unknown) { responseWire = value; }, setClock(value: string) { clock = value; }, setAssisted() { forceAssisted = true; },
    completedFixture() { const result = makeResponse({ evaluation: exampleEvaluation, coaching: null, model: gateway.model, pin: null, promptVersion: "evaluate-practice-v5", submittedAt: at }); completed = result.reviewState; return result; }, setCompleted(state: DueReviewState | null) { completed = state; },
  };
}

describe("claimed official review completion", () => {
  it("claims once, scores frozen modern v5 context and publishes the full authoritative first/latest DTO", async () => {
    const h = harness(); const result = await h.service.complete(owner, review, input);
    expect(h.repository.claimCompletion).toHaveBeenCalledWith(owner, review, input, at);
    expect(h.complete).toHaveBeenCalledTimes(1); expect(h.complete.mock.calls[0][0]).toBe("evaluate-practice-v5");
    expect(h.complete.mock.calls[0][2]).toMatchObject({ maxTokens: 1844, timeoutMs: 30000 });
    expect(JSON.parse(h.complete.mock.calls[0][1].split("\n")[0])).toMatchObject({ targetExpression: "高得要命", targetMeaning: card.meaningHere, situationZh: h.prepared.promptChinese, learnerResponse: input.responseChinese, targetFunction: { value: "complain" }, targetSetting: { value: "casual_chat" } });
    expect(h.published[0]).toMatchObject({ submittedAt: at, promptVersion: "evaluate-practice-v5", evaluation: { passed: true, independentUse: true, assistanceLevel: "none" } });
    expect(result.reviewState.firstAnswer).toMatchObject({ attemptId: attempt, responseChinese: input.responseChinese }); expect(result.reviewState.latestRevision).toBeNull();
  });
  it("replays a cached success without material, gateway lookup, claim or extra scoring", async () => {
    const h = harness(); await h.service.complete(owner, review, input);
    h.repository.read.mockClear(); h.repository.claimCompletion.mockClear(); h.repository.resolveActiveGatewayPin.mockClear(); h.gatewayResolver.resolve.mockClear(); h.complete.mockClear();
    expect((await h.service.complete(owner, review, input)).created).toBe(false);
    expect(h.repository.read).not.toHaveBeenCalled(); expect(h.repository.claimCompletion).not.toHaveBeenCalled(); expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled(); expect(h.gatewayResolver.resolve).not.toHaveBeenCalled(); expect(h.complete).not.toHaveBeenCalled();
    await expect(h.service.complete(owner, review, { ...input, responseChinese: "这里高得要命。" })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" }); expect(h.complete).not.toHaveBeenCalled();
  });
  it("replays a source-free completed first answer and latest revision, preserving historical assistance", async () => {
    const h = harness(), original = h.completedFixture(); const state = original.reviewState;
    state.examplesOpenedAt = "2026-11-01T12:10:00.000Z";
    state.latestRevision = { id: nextId, requestId: nextId, attemptId: attempt, taskId: task, scenarioVersion: 1, scenarioFingerprint: input.scenarioFingerprint, responseChinese: "这里高得要命。", evaluation: { ...original.evaluation, assistanceLevel: "model_answer", independentUse: false }, coaching: null, naturalVersion: null, createdAt: "2026-11-01T12:11:00.000Z" };
    h.repository.read.mockRejectedValue(new Error("source material unavailable"));
    const result = await h.service.complete(owner, review, { ...input, requestId: "43000000-0000-4000-8000-000000000007" });
    expect(result).toMatchObject({ attemptId: attempt, created: false, nextDueAt: "2026-11-08T12:00:00.000Z", evaluation: { assistanceLevel: "none", independentUse: true } });
    expect(result.reviewState.latestRevision?.id).toBe(nextId); expect(result.reviewState.examplesOpenedAt).toBe(state.examplesOpenedAt);
    expect(h.repository.read).not.toHaveBeenCalled(); expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled(); expect(h.complete).not.toHaveBeenCalled(); expect(h.repository.claimCompletion).not.toHaveBeenCalled();
  });
  it("rejects a changed source-free completed answer instead of scoring it as another official first", async () => {
    const h = harness(); h.completedFixture();
    await expect(h.service.complete(owner, review, { ...input, responseChinese: "这个费用高得要命。" })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(h.repository.read).not.toHaveBeenCalled(); expect(h.complete).not.toHaveBeenCalled();
  });
  it.each(["task", "version", "hash", "foreign-review"])("does not use source-free receipt for a mismatched %s", async mode => {
    const h = harness(), saved = h.completedFixture();
    if (mode === "foreign-review") saved.reviewState.reviewTaskId = nextId;
    const candidate = { ...input, ...(mode === "task" ? { taskId: nextId } : mode === "version" ? { scenarioVersion: 2 } : mode === "hash" ? { scenarioFingerprint: "c".repeat(64) } : {}) };
    await expect(h.service.complete(owner, review, candidate)).rejects.toBeInstanceOf(PracticeError);
    expect(h.complete).not.toHaveBeenCalled(); expect(h.repository.read).not.toHaveBeenCalled();
  });
  it.each(["bad-user", "bad-review", "bad-input", "missing", "foreign-owner", "foreign-review", "cancelled", "completed-without-receipt", "future", "no-task", "stale-task", "stale-version", "stale-hash", "material-task", "material-prompt", "structured-prompt"])("rejects %s before operation claim or model egress", async mode => {
    const h = harness(); let user = owner, reviewId = review; const candidate = { ...input };
    if (mode === "bad-user") user = "invalid"; if (mode === "bad-review") reviewId = "invalid"; if (mode === "bad-input") candidate.responseChinese = "";
    if (mode === "missing") h.repository.read.mockResolvedValue(null); if (mode === "foreign-owner") h.context.userId = nextId; if (mode === "foreign-review") h.context.reviewTaskId = nextId;
    if (mode === "cancelled") h.context.status = "cancelled"; if (mode === "completed-without-receipt") h.context.status = "completed"; if (mode === "future") h.context.dueAt = "2026-12-01T00:00:00.000Z";
    if (mode === "no-task") h.context.prepared = null; if (mode === "stale-task") candidate.taskId = nextId; if (mode === "stale-version") candidate.scenarioVersion = 2; if (mode === "stale-hash") candidate.scenarioFingerprint = "c".repeat(64);
    if (mode === "material-task") h.prepared.material.task.id = nextId; if (mode === "material-prompt") h.prepared.material.task.promptChinese = "新的问题已经变了。"; if (mode === "structured-prompt") h.prepared.material.task.situation!.situationZh = "旧情境已经被替换。";
    await expect(h.service.complete(user, reviewId, candidate)).rejects.toBeInstanceOf(PracticeError);
    expect(h.repository.claimCompletion).not.toHaveBeenCalled(); expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled(); expect(h.complete).not.toHaveBeenCalled();
  });
  it("keeps an unclaimed request reusable after zero-model gateway setup failure", async () => {
    const h = harness(); h.repository.resolveActiveGatewayPin.mockResolvedValueOnce(null as never);
    await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code: "GATEWAY_REQUIRED" });
    expect(h.repository.claimCompletion).not.toHaveBeenCalled(); expect(h.repository.failCompletion).not.toHaveBeenCalled();
    expect((await h.service.complete(owner, review, input)).attemptId).toBe(attempt);
  });
  it("handles two same-ID submissions with one score call and no extra egress for the pending duplicate", async () => {
    const h = harness(), score = h.complete.getMockImplementation()!; let release!: () => void, entered!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    h.complete.mockImplementationOnce(async (...args) => { entered(); await blocked; return score(...args); });
    const first = h.service.complete(owner, review, input); await started;
    await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code: "REQUEST_IN_PROGRESS", details: { operation: { kind: "complete", requestId: request, state: "in_progress" } } });
    await expect(h.service.complete(owner, review, { ...input, responseChinese: "这里高得要命。" })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(h.complete).toHaveBeenCalledTimes(1); expect(h.gatewayResolver.resolve).toHaveBeenCalledTimes(1); release();
    expect((await first).attemptId).toBe(attempt); expect(h.repository.publishCompletion).toHaveBeenCalledTimes(1);
  });
  it("handles a claim-time winner or pending race without another score call", async () => {
    const h = harness(), winner = h.completedFixture(); h.setCompleted(null); h.repository.claimCompletion.mockResolvedValueOnce({ kind: "ready", response: winner });
    expect(await h.service.complete(owner, review, input)).toBe(winner); expect(h.complete).not.toHaveBeenCalled();
    h.repository.claimCompletion.mockResolvedValueOnce({ kind: "pending" });
    await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code: "REQUEST_IN_PROGRESS" }); expect(h.complete).not.toHaveBeenCalled();
  });
  it("persists one terminal four-format-attempt failure; same ID never reopens scoring", async () => {
    const h = harness(); h.setWire({ accuracy: { score: 9 } });
    await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID", details: { operation: { kind: "complete", requestId: request, state: "failed" } } });
    expect(h.complete).toHaveBeenCalledTimes(4); expect(h.repository.failCompletion).toHaveBeenCalledTimes(1); expect(h.repository.publishCompletion).not.toHaveBeenCalled();
    h.complete.mockClear(); h.repository.resolveActiveGatewayPin.mockClear();
    await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID", details: { operation: { state: "failed" } } });
    expect(h.complete).not.toHaveBeenCalled(); expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled();
    h.setWire(wire()); expect((await h.service.complete(owner, review, { ...input, requestId: nextId })).attemptId).toBe(attempt);
  });
  it("does not spend format retries on transport failure", async () => {
    const h = harness(); h.complete.mockRejectedValue(new ModelGatewayError("PROVIDER_UNAVAILABLE", "transport"));
    await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" }); expect(h.complete).toHaveBeenCalledTimes(1);
  });
  it("captures original submission time but fences publication using the later real clock", async () => {
    const h = harness(), score = h.complete.getMockImplementation()!;
    h.complete.mockImplementationOnce(async (...args) => { h.setClock("2026-11-01T12:00:09.000Z"); return score(...args); });
    await h.service.complete(owner, review, input);
    expect(h.published[0].submittedAt).toBe(at);
    expect(h.repository.publishCompletion).toHaveBeenCalledWith(owner, review, input, "claim-token", expect.objectContaining({ submittedAt: at }), "2026-11-01T12:00:09.000Z");
  });
  it("returns late-example SQL authority without comparing it to earlier preview flags", async () => {
    const h = harness(); h.setAssisted(); const result = await h.service.complete(owner, review, input);
    expect(h.published[0].evaluation.independentUse).toBe(true);
    expect(result).toMatchObject({ priorState: "tried", newState: "tried", intervalDays: 1, evaluation: { assistanceLevel: "model_answer", independentUse: false } });
    expect(result.reviewState.firstAnswer?.evaluation).toEqual(result.evaluation);
  });
  it("scores currently persisted examples as assisted", async () => {
    const h = harness(); h.prepared.reviewState.examplesOpenedAt = at; const result = await h.service.complete(owner, review, input);
    expect(h.published[0].evaluation).toMatchObject({ assistanceLevel: "model_answer", independentUse: false }); expect(result.intervalDays).toBe(1);
  });
  it("does not treat expression reveal alone as assistance", async () => {
    const h = harness(); h.prepared.reviewState.expressionRevealedAt = at;
    const result = await h.service.complete(owner, review, input);
    expect(result.evaluation).toMatchObject({ assistanceLevel: "none", independentUse: true });
  });
  it.each(["SCENARIO_CHANGED", "ALREADY_SUBMITTED"] as const)("preserves atomic publisher %s when another operation wins during scoring", async code => {
    const h = harness(); h.repository.publishCompletion.mockRejectedValue(new PracticeError(code, false, { current: h.prepared }));
    await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code, details: { current: h.prepared } });
    expect(h.complete).toHaveBeenCalledTimes(1); expect(h.repository.failCompletion).toHaveBeenCalledTimes(1);
  });
  it.each(["all-five", "legacy-all-five", "targetless", "invalid"])("discards %s optional coaching without extra evaluation", async mode => {
    const h = harness();
    if (mode === "legacy-all-five") { h.context.card = null; h.prepared.metadataMode = "legacy"; h.prepared.material.task.situation = null; }
    h.setWire(mode === "all-five" || mode === "legacy-all-five" ? wire(5) : mode === "targetless" ? wire(4, "还是不要买了。") : wire(4, 10));
    const result = await h.service.complete(owner, review, input); expect(result.coaching).toBeNull(); expect(result.reviewState.firstAnswer?.naturalVersion).toBeNull(); expect(h.complete).toHaveBeenCalledTimes(1);
  });
  it("uses already-ready legacy v4 without inventing card metadata", async () => {
    const h = harness(); h.context.card = null; h.prepared.metadataMode = "legacy"; h.prepared.scenarioSource = "legacy"; h.prepared.material.task.situation = null;
    await h.service.complete(owner, review, input); expect(h.complete.mock.calls[0][0]).toBe("evaluate-practice-v4");
    expect(JSON.parse(h.complete.mock.calls[0][1].split("\n")[0])).toEqual({ task: "evaluation", targetExpression: "高得要命", promptChinese: h.prepared.promptChinese, learnerResponse: input.responseChinese });
  });
  it.each(["card", "situation"])("does not downgrade missing modern %s to a legacy score call", async mode => {
    const h = harness(); if (mode === "card") h.context.card = null; else h.prepared.material.task.situation = null;
    await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code: "LEGACY_METADATA_REQUIRED" }); expect(h.repository.claimCompletion).not.toHaveBeenCalled(); expect(h.complete).not.toHaveBeenCalled();
  });
  it("recovers a committed publication before any failure write when its response was lost", async () => {
    const h = harness(), persist = h.repository.publishCompletion.getMockImplementation()!;
    h.repository.publishCompletion.mockImplementationOnce(async (...args) => { await persist(...args); throw new Error("lost private response"); });
    const result = await h.service.complete(owner, review, input);
    expect(result).toMatchObject({ attemptId: attempt, created: false }); expect(h.repository.failCompletion).not.toHaveBeenCalled(); expect(h.complete).toHaveBeenCalledTimes(1);
  });
  it("keeps an unknown publication under the same ID until an authoritative outcome is known", async () => {
    const h = harness(); h.repository.publishCompletion.mockRejectedValue(new Error("private persistence payload")); h.repository.failCompletion.mockRejectedValue(new Error("unknown failure write"));
    const error = await h.service.complete(owner, review, input).catch(value => value);
    expect(error).toMatchObject({ code: "REQUEST_IN_PROGRESS", retryable: true }); expect(error.details?.operation?.state).not.toBe("failed"); expect(error.message).not.toContain("private");
    await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code: "REQUEST_IN_PROGRESS" }); expect(h.complete).toHaveBeenCalledTimes(1);
  });
  it.each(["ready", "failed"] as const)("rechecks authoritative %s after an unconfirmed failure write", async status => {
    const h = harness(), winner = h.completedFixture(); h.setCompleted(null);
    h.repository.publishCompletion.mockRejectedValue(new Error("lost publication response")); h.repository.failCompletion.mockResolvedValue(false);
    h.repository.lookupCompletion.mockResolvedValueOnce(null).mockResolvedValueOnce({ kind: "pending" }).mockResolvedValueOnce(status === "ready" ? { kind: "ready", response: winner } : { kind: "failed", code: "PROVIDER_UNAVAILABLE" });
    if (status === "ready") expect(await h.service.complete(owner, review, input)).toBe(winner);
    else await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", details: { operation: { kind: "complete", requestId: request, state: "failed" } } });
    expect(h.complete).toHaveBeenCalledTimes(1); expect(h.repository.failCompletion).toHaveBeenCalledTimes(1);
  });
  it("does not declare terminal failure when publication, failure write and recovery lookups are all unknown", async () => {
    const h = harness(); h.repository.publishCompletion.mockRejectedValue(new Error("private publication payload")); h.repository.failCompletion.mockRejectedValue(new Error("private failure payload"));
    h.repository.lookupCompletion.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("private first recovery")).mockRejectedValueOnce(new Error("private second recovery"));
    const error = await h.service.complete(owner, review, input).catch(value => value);
    expect(error).toMatchObject({ code: "INTERNAL_ERROR", retryable: true }); expect(error.details?.operation).toBeUndefined(); expect(error.message).not.toContain("private");
    await expect(h.service.complete(owner, review, input)).rejects.toMatchObject({ code: "REQUEST_IN_PROGRESS" }); expect(h.complete).toHaveBeenCalledTimes(1);
  });
  it("uses only the evaluation fixture in CI without a real gateway pin", async () => {
    const h = harness(); h.deps.ci = true; await h.service.complete(owner, review, input);
    expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled(); expect(h.gatewayResolver.resolve).not.toHaveBeenCalled(); expect(h.published[0].pin).toBeNull();
  });
});
