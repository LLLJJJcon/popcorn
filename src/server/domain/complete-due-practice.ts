import { createHash } from "node:crypto";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { MasteryState } from "@/contracts/memory";
import { AssistanceLevelSchema, EvaluationResultSchema, type EvaluationResult, type PracticeTask } from "@/contracts/practice";
import { TargetChineseTextSchema } from "@/contracts/source";
import { EVALUATE_PRACTICE_PROMPT_VERSION, buildEvaluatePracticePrompt } from "@/server/ai/prompts/evaluate.v1";
import type { StructuredJsonGateway, StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import { failure, success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";
import { PracticeError, practiceErrorResponse, readPracticeMutation, resolvePracticeEgress } from "@/server/domain/create-practice-task";
import { scheduleReview } from "@/server/domain/schedule-review";
import type { DueTransferTask } from "@/server/domain/create-transfer-task";
import { buildDueTransferTask } from "@/server/domain/create-transfer-task";
import type { Database } from "@/types/database.generated";

export type { DueTransferTask } from "@/server/domain/create-transfer-task";

export type DuePracticeRpcResult = {
  readonly reviewTaskId: string;
  readonly practiceTaskId: string;
  readonly attemptId: string;
  readonly masteryEventId: string;
  readonly nextReviewTaskId: string;
  readonly priorState: MasteryState;
  readonly newState: MasteryState;
  readonly nextDueAt: string;
  readonly intervalDays: number;
  readonly created: boolean;
};

export type DuePracticeCompletionRepository = {
  findTransferTask(userId: string, reviewTaskId: string): Promise<DueTransferTask | null>;
  resolveActiveGatewayPin(userId: string): Promise<import("@/server/ai/provider").ModelGatewayPin | null>;
  completeDuePractice(input: {
    readonly userId: string;
    readonly reviewTaskId: string;
    readonly practiceTaskId: string;
    readonly requestKey: string;
    readonly responseChinese: string;
    readonly assistanceLevel: "none" | "hint" | "model_answer";
    readonly passed: boolean;
    readonly accuracyScore: number;
    readonly accuracyFeedbackEnglish: string;
    readonly naturalnessScore: number;
    readonly naturalnessFeedbackEnglish: string;
    readonly contextualFitScore: number;
    readonly contextualFitFeedbackEnglish: string;
    readonly completedAt: string;
    readonly evaluationPromptVersion: string | null;
    readonly evaluationModel: string | null;
    readonly evaluationGatewayConfigId: string | null;
    readonly evaluationGatewayRevision: number | null;
    readonly evaluationGatewayFingerprint: string | null;
  }): Promise<DuePracticeRpcResult>;
};

const UserIdSchema = z.string().uuid();
const DueInputSchema = z.strictObject({
  responseChinese: TargetChineseTextSchema.max(5_000),
  assistanceLevel: AssistanceLevelSchema,
});

function taskView(task: DueTransferTask): PracticeTask {
  return {
    id: task.id,
    userId: task.userId,
    userExpressionId: task.userExpressionId,
    kind: "due_practice",
    nativeLanguage: "en",
    targetLanguage: "zh-CN",
    targetExpression: task.targetExpression,
    promptChinese: task.promptChinese,
    instructionsEnglish: task.instructionsEnglish,
    goalEnglish: task.goalEnglish,
    dueAt: task.dueAt,
    createdAt: task.dueAt,
  };
}

function requestKey(userId: string, reviewTaskId: string, taskId: string, responseChinese: string, assistanceLevel: string): string {
  return createHash("sha256").update([userId, reviewTaskId, taskId, responseChinese, assistanceLevel].join("\u0000"), "utf8").digest("hex");
}

function safeEvaluation(value: unknown): EvaluationResult {
  const parsed = EvaluationResultSchema.safeParse(value);
  if (!parsed.success) throw new PracticeError("PROVIDER_FAILED", true);
  return parsed.data;
}

function expectedSchedule(result: DuePracticeRpcResult, independent: boolean, completedAt: string) {
  if (!independent) return scheduleReview({ kind: "failed_or_heavily_assisted_reuse", now: completedAt });
  if (result.newState === "owned") return scheduleReview({ kind: "owned_maintenance", now: completedAt });
  return scheduleReview({ kind: "successful_independent_reuse", now: completedAt });
}

function validateRpcResult(result: DuePracticeRpcResult, task: DueTransferTask, independent: boolean, completedAt: string): void {
  if (
    result.reviewTaskId !== task.reviewTaskId || result.practiceTaskId !== task.id ||
    result.priorState !== task.masteryState ||
    !["tried", "reused", "owned"].includes(result.newState) ||
    (task.masteryState === "owned" && result.newState !== "owned") ||
    (!independent && result.newState !== task.masteryState)
  ) throw new PracticeError("INTERNAL_ERROR", true);
  const schedule = expectedSchedule(result, independent, completedAt);
  if (result.intervalDays !== schedule.intervalDays || result.nextDueAt !== schedule.dueAt) {
    throw new PracticeError("INTERNAL_ERROR", true);
  }
}

export function createDuePracticeCompletionService(dependencies: {
  readonly repository: DuePracticeCompletionRepository;
  readonly gatewayResolver: StructuredJsonGatewayResolver;
  readonly fixtureGateway: StructuredJsonGateway;
  readonly ci: boolean;
  readonly now: () => string;
}) {
  return {
    async complete(userIdValue: string, reviewTaskIdValue: string, inputValue: z.infer<typeof DueInputSchema>) {
      const userId = UserIdSchema.safeParse(userIdValue);
      const reviewTaskId = UserIdSchema.safeParse(reviewTaskIdValue);
      const input = DueInputSchema.safeParse(inputValue);
      if (!userId.success || !reviewTaskId.success || !input.success) throw new PracticeError("VALIDATION_FAILED");

      const task = await dependencies.repository.findTransferTask(userId.data, reviewTaskId.data);
      if (!task || task.userId !== userId.data || task.reviewTaskId !== reviewTaskId.data) {
        throw new PracticeError("NOT_FOUND");
      }

      const resolved = await resolvePracticeEgress(userId.data, dependencies);
      let evaluation: EvaluationResult;
      try {
        evaluation = safeEvaluation(await resolved.gateway.complete(
          EVALUATE_PRACTICE_PROMPT_VERSION,
          buildEvaluatePracticePrompt(taskView(task), input.data.responseChinese),
        ));
      } catch (error) {
        if (error instanceof PracticeError) throw error;
        throw new PracticeError("PROVIDER_FAILED", true);
      }

      const completedAt = dependencies.now();
      const independent = evaluation.passed && input.data.assistanceLevel === "none";
      let completed: DuePracticeRpcResult;
      try {
        completed = await dependencies.repository.completeDuePractice({
          userId: userId.data, reviewTaskId: reviewTaskId.data, practiceTaskId: task.id,
          requestKey: requestKey(userId.data, reviewTaskId.data, task.id, input.data.responseChinese, input.data.assistanceLevel),
          responseChinese: input.data.responseChinese, assistanceLevel: input.data.assistanceLevel, passed: evaluation.passed,
          accuracyScore: evaluation.accuracy.score, accuracyFeedbackEnglish: evaluation.accuracy.englishFeedback,
          naturalnessScore: evaluation.naturalness.score, naturalnessFeedbackEnglish: evaluation.naturalness.englishFeedback,
          contextualFitScore: evaluation.contextualFit.score, contextualFitFeedbackEnglish: evaluation.contextualFit.englishFeedback,
          completedAt,
          evaluationPromptVersion: resolved.pin ? EVALUATE_PRACTICE_PROMPT_VERSION : null,
          evaluationModel: resolved.pin ? resolved.gateway.model : null,
          evaluationGatewayConfigId: resolved.pin?.configId ?? null,
          evaluationGatewayRevision: resolved.pin?.revision ?? null,
          evaluationGatewayFingerprint: resolved.pin?.fingerprint ?? null,
        });
      } catch {
        throw new PracticeError("INTERNAL_ERROR", true);
      }
      validateRpcResult(completed, task, independent, completedAt);
      return {
        ...completed,
        transition: completed.priorState === completed.newState
          ? null
          : { from: completed.priorState, to: completed.newState },
        evaluation: {
          passed: evaluation.passed,
          accuracy: evaluation.accuracy,
          naturalness: evaluation.naturalness,
          contextualFit: evaluation.contextualFit,
          independentUse: independent,
          assistanceLevel: input.data.assistanceLevel,
        },
      };
    },
  };
}

export function createDuePracticeHttpHandler(dependencies: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly complete: (userId: string, reviewTaskId: string, input: z.infer<typeof DueInputSchema>) => Promise<unknown>;
  readonly appUrl: string;
  readonly requestId: () => string;
}) {
  return async (request: Request, context: { readonly params: Promise<{ readonly reviewTaskId?: string }> }): Promise<Response> => {
    const requestId = dependencies.requestId();
    const mutation = await readPracticeMutation(request, { ...dependencies, requestId });
    if (!mutation.ok) return mutation.response;
    const reviewTaskId = UserIdSchema.safeParse((await context.params).reviewTaskId);
    const input = DueInputSchema.safeParse(mutation.body);
    if (!reviewTaskId.success || !input.success) return practiceErrorResponse(new PracticeError("VALIDATION_FAILED"), requestId);
    try {
      return Response.json(success(await dependencies.complete(mutation.userId, reviewTaskId.data, input.data), requestId), {
        status: 201, headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      return practiceErrorResponse(error, requestId);
    }
  };
}

type TransferCreationRepository = {
  ensureTransferTask(userId: string, reviewTaskId: string, now: string): Promise<DueTransferTask>;
};

function transferRecord(row: Database["public"]["Tables"]["practice_tasks"]["Row"], masteryState: MasteryState): DueTransferTask | null {
  if (
    row.kind !== "due_practice" || !row.review_task_id || !row.due_at ||
    !row.context_fingerprint
  ) return null;
  return {
    id: row.id, userId: row.user_id, reviewTaskId: row.review_task_id, userExpressionId: row.user_expression_id,
    targetExpression: row.target_expression, promptChinese: row.prompt_chinese,
    instructionsEnglish: row.instructions_english, goalEnglish: row.goal_english,
    dueAt: row.due_at, masteryState, contextFingerprint: row.context_fingerprint,
  };
}

/** Owner-scoped adapter: the only completion mutation is the frozen RPC below. */
export function createSupabaseDuePracticeRepository(client: SupabaseClient<Database>): DuePracticeCompletionRepository & TransferCreationRepository {
  async function findTransferTask(userId: string, reviewTaskId: string): Promise<DueTransferTask | null> {
    const review = await client.from("review_tasks").select("id,user_id,user_expression_id,mastery_state")
      .eq("user_id", userId).eq("id", reviewTaskId).maybeSingle();
    if (review.error) throw review.error;
    if (!review.data || review.data.user_id !== userId) return null;
    const task = await client.from("practice_tasks").select("*")
      .eq("user_id", userId).eq("review_task_id", reviewTaskId).maybeSingle();
    if (task.error) throw task.error;
    if (!task.data || task.data.user_id !== userId || task.data.user_expression_id !== review.data.user_expression_id) return null;
    return transferRecord(task.data, review.data.mastery_state as MasteryState);
  }

  return {
    findTransferTask,
    async resolveActiveGatewayPin(userId) {
      const result = await client.rpc("resolve_active_user_model_gateway_pin", { p_user_id: userId });
      if (result.error) throw result.error;
      const row = result.data[0];
      if (!row || result.data.length !== 1) return null;
      return { configId: row.config_id, revision: row.revision, fingerprint: row.config_fingerprint };
    },
    async ensureTransferTask(userId, reviewTaskId, now) {
      const existing = await findTransferTask(userId, reviewTaskId);
      if (existing) return existing;
      const review = await client.from("review_tasks")
        .select("id,user_id,user_expression_id,mastery_state,status,due_at")
        .eq("user_id", userId).eq("id", reviewTaskId).maybeSingle();
      if (review.error) throw review.error;
      if (!review.data || review.data.user_id !== userId || review.data.status !== "pending" || review.data.due_at > now) {
        throw new PracticeError("NOT_FOUND");
      }
      const source = await client.from("practice_tasks").select("id,user_id,user_expression_id,target_expression,prompt_chinese")
        .eq("user_id", userId).eq("user_expression_id", review.data.user_expression_id).eq("kind", "use_it_now")
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (source.error) throw source.error;
      if (!source.data || source.data.user_id !== userId || source.data.user_expression_id !== review.data.user_expression_id) {
        throw new PracticeError("NOT_FOUND");
      }
      const built = buildDueTransferTask({
        id: crypto.randomUUID(), userId, reviewTaskId, userExpressionId: review.data.user_expression_id,
        targetExpression: source.data.target_expression, originalPromptChinese: source.data.prompt_chinese,
        dueAt: review.data.due_at, masteryState: review.data.mastery_state as MasteryState,
      });
      const inserted = await client.from("practice_tasks").insert({
        id: built.id, user_id: built.userId, user_expression_id: built.userExpressionId, kind: "due_practice",
        native_language: "en", target_language: "zh-CN", target_expression: built.targetExpression,
        prompt_chinese: built.promptChinese, instructions_english: built.instructionsEnglish, goal_english: built.goalEnglish,
        due_at: built.dueAt, review_task_id: built.reviewTaskId, context_fingerprint: built.contextFingerprint,
      }).select("*").maybeSingle();
      if (!inserted.error && inserted.data) {
        const record = transferRecord(inserted.data, built.masteryState);
        if (record) return record;
      }
      const raced = await findTransferTask(userId, reviewTaskId);
      if (raced) return raced;
      throw inserted.error ?? new PracticeError("INTERNAL_ERROR", true);
    },
    async completeDuePractice(input) {
      const result = await client.rpc("complete_due_practice", {
        p_user_id: input.userId, p_review_task_id: input.reviewTaskId, p_practice_task_id: input.practiceTaskId,
        p_request_key: input.requestKey, p_response_chinese: input.responseChinese, p_assistance_level: input.assistanceLevel,
        p_passed: input.passed, p_accuracy_score: input.accuracyScore, p_accuracy_feedback_english: input.accuracyFeedbackEnglish,
        p_naturalness_score: input.naturalnessScore, p_naturalness_feedback_english: input.naturalnessFeedbackEnglish,
        p_contextual_fit_score: input.contextualFitScore, p_contextual_fit_feedback_english: input.contextualFitFeedbackEnglish,
        p_completed_at: input.completedAt,
        ...(input.evaluationPromptVersion === null ? {} : { p_evaluation_prompt_version: input.evaluationPromptVersion }),
        ...(input.evaluationModel === null ? {} : { p_evaluation_model: input.evaluationModel }),
        ...(input.evaluationGatewayConfigId === null ? {} : { p_evaluation_gateway_config_id: input.evaluationGatewayConfigId }),
        ...(input.evaluationGatewayRevision === null ? {} : { p_evaluation_gateway_revision: input.evaluationGatewayRevision }),
        ...(input.evaluationGatewayFingerprint === null ? {} : { p_evaluation_gateway_fingerprint: input.evaluationGatewayFingerprint }),
      });
      if (result.error || !result.data || result.data.length !== 1) throw result.error ?? new Error("due completion failed");
      const row = result.data[0]!;
      return {
        reviewTaskId: row.review_task_id, practiceTaskId: row.practice_task_id, attemptId: row.attempt_id,
        masteryEventId: row.mastery_event_id, nextReviewTaskId: row.next_review_task_id,
        priorState: row.prior_state as MasteryState, newState: row.new_state as MasteryState,
        nextDueAt: row.next_due_at, intervalDays: row.interval_days, created: row.created,
      };
    },
  };
}

export function createDueTransferHttpHandler(dependencies: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly repository: TransferCreationRepository;
  readonly now: () => string;
  readonly requestId: () => string;
}) {
  return async (request: Request, context: { readonly params: Promise<{ readonly reviewTaskId?: string }> }): Promise<Response> => {
    const requestId = dependencies.requestId();
    const session = await dependencies.authenticate(request);
    if (!session.ok) return Response.json(failure({
      code: session.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED",
      message: session.reason === "missing" ? "Authentication is required" : "Your session has expired", retryable: false,
    }, requestId), { status: 401, headers: { "Cache-Control": "no-store" } });
    const reviewTaskId = UserIdSchema.safeParse((await context.params).reviewTaskId);
    if (!reviewTaskId.success) return practiceErrorResponse(new PracticeError("VALIDATION_FAILED"), requestId);
    try {
      const task = await dependencies.repository.ensureTransferTask(session.userId, reviewTaskId.data, dependencies.now());
      return Response.json(success({
        id: task.id, reviewTaskId: task.reviewTaskId, targetExpression: task.targetExpression,
        promptChinese: task.promptChinese, instructionsEnglish: task.instructionsEnglish, goalEnglish: task.goalEnglish,
      }, requestId), { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return practiceErrorResponse(error, requestId);
    }
  };
}
