import { MODEL_OUTPUT_TOKENS } from "@/server/ai/output-budgets";
import { createHash } from "node:crypto";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MasteryStateSchema, type MasteryState } from "@/contracts/memory";
import {
  AssistanceLevelSchema,
  EvaluationResultSchema,
  type EvaluationResult,
  type PracticeCoaching,
} from "@/contracts/practice";
import { TargetChineseTextSchema } from "@/contracts/source";
import {
  EVALUATE_PRACTICE_PROMPT_VERSION,
  buildEvaluatePracticePrompt,
  derivePracticeDecision,
  normalizePracticeEvaluationWire,
  parsePracticeEvaluationOutput,
  isReadableEvaluationPromptVersion,
} from "@/server/ai/prompts/evaluate.v1";
import type { StructuredJsonGateway, StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import { failure, success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";
import {
  PracticeError,
  practiceErrorFromUnknown,
  practiceErrorResponse,
  readPracticeMutation,
  resolvePracticeEgress,
} from "@/server/domain/create-practice-task";
import { scheduleReview } from "@/server/domain/schedule-review";
import { createPracticeRoundStore } from "@/server/domain/practice-rounds";
import * as modernEvaluation from "@/server/ai/prompts/evaluate.v2";
import { getTargetFunction,getTargetSetting } from "@/server/ai/prompts/learning-intent-constants";
import { completeWithFormatRetries } from "@/server/ai/structured-json-gateway";
import type { DueTransfer,DueReviewState } from "@/contracts/review-practice";
import type { DueTransferTask } from "@/server/domain/create-transfer-task";
import type { PracticeMaterialRepository } from "@/server/repositories/practice-material-repository";
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
  readonly assistanceLevel?: "none"|"hint"|"model_answer";
};

export type DuePracticePersistedAttempt = {
  readonly coaching?: PracticeCoaching|null;
  readonly responseChinese: string;
  readonly assistanceLevel: "none" | "hint" | "model_answer";
  readonly passed: boolean;
  readonly accuracyScore: number;
  readonly accuracyFeedbackEnglish: string;
  readonly naturalnessScore: number;
  readonly naturalnessFeedbackEnglish: string;
  readonly contextualFitScore: number;
  readonly contextualFitFeedbackEnglish: string;
  readonly submittedAt: string;
  readonly evaluationPromptVersion: string | null;
  readonly evaluationModel: string | null;
  readonly evaluationGatewayConfigId: string | null;
  readonly evaluationGatewayRevision: number | null;
  readonly evaluationGatewayFingerprint: string | null;
};

export type DuePracticeCompletionState = {
  readonly status: "pending" | "completed" | "cancelled";
  readonly task: DueTransferTask;
  readonly attempt: DuePracticePersistedAttempt | null;
};

type DuePracticeRpcInput = {
  readonly scenarioVersion?:number;readonly scenarioFingerprint?:string;readonly coaching?:PracticeCoaching|null;
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
};

export type DuePracticeCompletionRepository = {
  requireScenarioIdentity?:boolean;
  findCurrentReview?(userId:string,reviewTaskId:string):Promise<DueTransfer|null>;
  findCurrentReviewState?(userId:string,reviewTaskId:string):Promise<DueReviewState|null>;
  findAssistance?(userId:string,reviewTaskId:string):Promise<"none"|"model_answer">;
  findTransferTask(userId: string, reviewTaskId: string): Promise<DueTransferTask | null>;
  findCompletionState(userId: string, reviewTaskId: string): Promise<DuePracticeCompletionState | null>;
  resolveActiveGatewayPin(userId: string): Promise<import("@/server/ai/provider").ModelGatewayPin | null>;
  completeDuePractice(input: DuePracticeRpcInput): Promise<DuePracticeRpcResult>;
};

const UserIdSchema = z.string().uuid();
const ExplicitInstantSchema = z.string().datetime({ offset: true });
const DueInputSchema = z.strictObject({
  responseChinese: TargetChineseTextSchema.max(10_000),
  assistanceLevel: AssistanceLevelSchema,
  taskId:z.string().uuid().optional(),scenarioVersion:z.number().int().positive().optional(),scenarioFingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional(),requestId:z.string().uuid().optional(),
});

function requestKey(userId: string, reviewTaskId: string, taskId: string, responseChinese: string, assistanceLevel: string): string {
  return createHash("sha256").update([userId, reviewTaskId, taskId, responseChinese, assistanceLevel].join("\u0000"), "utf8").digest("hex");
}

function canonicalInstant(value: string): string {
  if (!ExplicitInstantSchema.safeParse(value).success || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new PracticeError("INTERNAL_ERROR", true);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new PracticeError("INTERNAL_ERROR", true);
  return new Date(milliseconds).toISOString();
}

function safeEvaluation(value: unknown): EvaluationResult {
  const parsed = EvaluationResultSchema.safeParse(value);
  if (!parsed.success) throw practiceErrorFromUnknown(parsed.error);
  return parsed.data;
}

function persistedEvaluation(attempt: DuePracticePersistedAttempt): EvaluationResult {
  return safeEvaluation({
    passed: attempt.passed,
    accuracy: { score: attempt.accuracyScore, englishFeedback: attempt.accuracyFeedbackEnglish },
    naturalness: { score: attempt.naturalnessScore, englishFeedback: attempt.naturalnessFeedbackEnglish },
    contextualFit: { score: attempt.contextualFitScore, englishFeedback: attempt.contextualFitFeedbackEnglish },
    independentUse: attempt.passed && attempt.assistanceLevel === "none",
    assistanceLevel: attempt.assistanceLevel,
  });
}

export function readableEvaluationProvenance(attempt: Pick<DuePracticePersistedAttempt,"evaluationPromptVersion"|"evaluationModel"|"evaluationGatewayConfigId"|"evaluationGatewayRevision"|"evaluationGatewayFingerprint">): boolean {
  const metadata = [
    attempt.evaluationModel,
    attempt.evaluationGatewayConfigId,
    attempt.evaluationGatewayRevision,
    attempt.evaluationGatewayFingerprint,
  ];
  return attempt.evaluationPromptVersion === null
    ? metadata.every((value) => value === null)
    : isReadableEvaluationPromptVersion(attempt.evaluationPromptVersion)
      && metadata.every((value) => value !== null);
}

function expectedSchedule(result: DuePracticeRpcResult, independent: boolean, completedAt: string) {
  if (!independent) return scheduleReview({ kind: "failed_or_heavily_assisted_reuse", now: completedAt });
  if (result.newState === "owned") return scheduleReview({ kind: "owned_maintenance", now: completedAt });
  return scheduleReview({ kind: "successful_independent_reuse", now: completedAt });
}

export function validateRpcResult(result: DuePracticeRpcResult, task: Pick<DueTransferTask,"id"|"reviewTaskId"|"masteryState">, independent: boolean, completedAt: string): DuePracticeRpcResult {
  const legalTransition = independent
    ? task.masteryState === "tried"
      ? result.newState === "reused"
      : task.masteryState === "reused"
        ? result.newState === "reused" || result.newState === "owned"
        : result.newState === "owned"
    : result.newState === task.masteryState;
  if (
    result.reviewTaskId !== task.reviewTaskId || result.practiceTaskId !== task.id ||
    result.priorState !== task.masteryState ||
    !["tried", "reused", "owned"].includes(result.newState) ||
    !legalTransition
  ) throw new PracticeError("INTERNAL_ERROR", true);
  const schedule = expectedSchedule(result, independent, completedAt);
  const nextDueAt = canonicalInstant(result.nextDueAt);
  if (result.intervalDays !== schedule.intervalDays || nextDueAt !== schedule.dueAt) {
    throw new PracticeError("INTERNAL_ERROR", true);
  }
  return { ...result, nextDueAt };
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

      const requestedAt = canonicalInstant(dependencies.now());
      const state = await dependencies.repository.findCompletionState(userId.data, reviewTaskId.data);
      const task = state?.task ? { ...state.task, dueAt: canonicalInstant(state.task.dueAt) } : null;
      if (!state || !task || task.userId !== userId.data || task.reviewTaskId !== reviewTaskId.data) {
        throw new PracticeError("NOT_FOUND");
      }
      if(dependencies.repository.requireScenarioIdentity&&(input.data.taskId!==task.id||input.data.scenarioVersion!==task.scenarioVersion||input.data.scenarioFingerprint!==task.scenarioFingerprint||!input.data.requestId)){
        throw new PracticeError("SCENARIO_CHANGED",false,{current:await dependencies.repository.findCurrentReview?.(userId.data,reviewTaskId.data)});
      }
      if(dependencies.repository.findAssistance){
        input.data.assistanceLevel=state.status==="completed"&&state.attempt
          ? state.attempt.assistanceLevel
          : await dependencies.repository.findAssistance(userId.data,reviewTaskId.data);
      }

      let evaluation: EvaluationResult;
      let coaching: PracticeCoaching | null = null;
      let completedAt: string;
      let evaluationPromptVersion: string | null;
      let evaluationModel: string | null;
      let evaluationGatewayConfigId: string | null;
      let evaluationGatewayRevision: number | null;
      let evaluationGatewayFingerprint: string | null;
      if (state.status === "completed") {
        const attempt = state.attempt;
        if (!attempt || !readableEvaluationProvenance(attempt)) {
          throw new PracticeError("NOT_FOUND");
        }
        if (
          attempt.responseChinese !== input.data.responseChinese ||
          attempt.assistanceLevel !== input.data.assistanceLevel
        ) throw new PracticeError("REVISION_CONFLICT");
        evaluation = persistedEvaluation(attempt);
        coaching=attempt.coaching??null;
        completedAt = canonicalInstant(attempt.submittedAt);
        evaluationPromptVersion = attempt.evaluationPromptVersion;
        evaluationModel = attempt.evaluationModel;
        evaluationGatewayConfigId = attempt.evaluationGatewayConfigId;
        evaluationGatewayRevision = attempt.evaluationGatewayRevision;
        evaluationGatewayFingerprint = attempt.evaluationGatewayFingerprint;
      } else {
        if (state.status !== "pending" || Date.parse(task.dueAt) > Date.parse(requestedAt)) {
          throw new PracticeError("NOT_FOUND");
        }
        const resolved = await resolvePracticeEgress(userId.data, dependencies);
        try {
          const modern=task.metadataMode==="modern"&&task.situation&&task.learningCard;
          if(task.metadataMode==="modern"&&!modern)throw new PracticeError("LEGACY_METADATA_REQUIRED");
          const prompt = modern ? modernEvaluation.buildEvaluatePracticePrompt({targetExpression:task.targetExpression,targetMeaning:task.learningCard!.meaningHere,situationZh:task.situation!.situationZh,interlocutor:task.situation!.interlocutor,targetFunction:getTargetFunction(task.situation!.targetFunction),targetSetting:getTargetSetting(task.situation!.targetSetting),taskEn:task.situation!.taskEn,toneAndWho:task.learningCard!.toneAndWho,watchOut:task.learningCard!.watchOut,learnerResponse:input.data.responseChinese}) : buildEvaluatePracticePrompt({targetExpression:task.targetExpression,promptChinese:task.promptChinese,learnerResponse:input.data.responseChinese});
          const version=modern?modernEvaluation.EVALUATE_PRACTICE_PROMPT_VERSION:EVALUATE_PRACTICE_PROMPT_VERSION;
          const parsed = (modern?modernEvaluation.parsePracticeEvaluationOutput:parsePracticeEvaluationOutput)(
            await completeWithFormatRetries(()=>resolved.gateway.complete(
              version,
              prompt.userPrompt,
              {
                systemPrompt: prompt.systemPrompt,
                timeoutMs: 30_000,
                maxTokens: MODEL_OUTPUT_TOKENS.evaluatePractice,
                normalize: modern?modernEvaluation.normalizePracticeEvaluationWire:normalizePracticeEvaluationWire,
              },
            )),
            task.targetExpression,
            input.data.assistanceLevel,
          );
          evaluation = EvaluationResultSchema.parse({
            ...parsed.evaluation,
            ...derivePracticeDecision(parsed.evaluation, input.data.assistanceLevel),
          });
          coaching = parsed.coaching;
          if([evaluation.accuracy,evaluation.naturalness,evaluation.contextualFit].every(d=>d.score===5))coaching=null;
        } catch (error) {
          throw practiceErrorFromUnknown(error);
        }
        completedAt = requestedAt;
        evaluationPromptVersion = resolved.pin ? (task.metadataMode==="modern"?modernEvaluation.EVALUATE_PRACTICE_PROMPT_VERSION:EVALUATE_PRACTICE_PROMPT_VERSION) : null;
        evaluationModel = resolved.pin ? resolved.gateway.model : null;
        evaluationGatewayConfigId = resolved.pin?.configId ?? null;
        evaluationGatewayRevision = resolved.pin?.revision ?? null;
        evaluationGatewayFingerprint = resolved.pin?.fingerprint ?? null;
      }

      let independent = evaluation.independentUse;
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
          evaluationPromptVersion,
          evaluationModel,
          evaluationGatewayConfigId,
          evaluationGatewayRevision,
          evaluationGatewayFingerprint,
          ...(dependencies.repository.requireScenarioIdentity?{scenarioVersion:task.scenarioVersion,scenarioFingerprint:task.scenarioFingerprint,coaching}:{}),
        });
      } catch (error) {
        if(error instanceof PracticeError)throw error;
        throw new PracticeError("INTERNAL_ERROR", true);
      }
      if(completed.assistanceLevel){evaluation={...evaluation,...derivePracticeDecision(evaluation,completed.assistanceLevel)};independent=evaluation.independentUse;}
      completed = validateRpcResult(completed, task, independent, completedAt);
      const {assistanceLevel:serverAssistance,...publicCompletion}=completed;
      void serverAssistance;
      return {
        ...publicCompletion,
        transition: completed.priorState === completed.newState
          ? null
          : { from: completed.priorState, to: completed.newState },
        evaluation,
        coaching,
        ...(dependencies.repository.findCurrentReviewState?{reviewState:await dependencies.repository.findCurrentReviewState(userId.data,reviewTaskId.data)}:dependencies.repository.findCurrentReview?{reviewState:(await dependencies.repository.findCurrentReview(userId.data,reviewTaskId.data))?.reviewState}:{}),
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
    const clean=typeof mutation.body==="object"&&mutation.body!==null?{...mutation.body as Record<string,unknown>,assistanceLevel:"none"}:mutation.body;
    const input = DueInputSchema.safeParse(clean);
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

const PersistedAttemptRowSchema = z.strictObject({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  user_expression_id: z.string().uuid(),
  practice_task_id: z.string().uuid(),
  response_chinese: TargetChineseTextSchema.max(10_000),
  assistance_level: AssistanceLevelSchema,
  passed: z.boolean(),
  independent_use: z.boolean(),
  accuracy_score: z.number().int().min(1).max(5),
  accuracy_feedback_english: z.string(),
  naturalness_score: z.number().int().min(1).max(5),
  naturalness_feedback_english: z.string(),
  contextual_fit_score: z.number().int().min(1).max(5),
  contextual_fit_feedback_english: z.string(),
  submitted_at: z.string(),
  evaluation_prompt_version: z.string().nullable(),
  evaluation_model: z.string().nullable(),
  evaluation_gateway_config_id: z.string().uuid().nullable(),
  evaluation_gateway_revision: z.number().int().nullable(),
  evaluation_gateway_fingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
});

const MasteryEventRowSchema = z.strictObject({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  user_expression_id: z.string().uuid(),
  attempt_id: z.string().uuid(),
  prior_state: MasteryStateSchema,
  new_state: MasteryStateSchema,
  occurred_at: z.string(),
});

const MASTERY_RANK: Readonly<Record<MasteryState, number>> = { tried: 0, reused: 1, owned: 2 };

export function legalHistoricalTransition(priorState: MasteryState, newState: MasteryState, independent: boolean): boolean {
  if (!independent) return newState === priorState;
  if (priorState === "tried") return newState === "reused";
  if (priorState === "reused") return newState === "reused" || newState === "owned";
  return newState === "owned";
}

function transferRecord(row: Database["public"]["Tables"]["practice_tasks"]["Row"], masteryState: MasteryState): DueTransferTask | null {
  if (
    row.kind !== "due_practice" || !row.review_task_id || !row.due_at ||
    !row.context_fingerprint
  ) return null;
  return {
    id: row.id, userId: row.user_id, reviewTaskId: row.review_task_id, userExpressionId: row.user_expression_id,
    targetExpression: row.target_expression, promptChinese: row.prompt_chinese,
    instructionsEnglish: row.instructions_english, goalEnglish: row.goal_english,
    dueAt: canonicalInstant(row.due_at), masteryState, contextFingerprint: row.context_fingerprint,
  };
}

/** Owner-scoped adapter: the only completion mutation is the frozen RPC below. */
export function createSupabaseDuePracticeRepository(client: SupabaseClient<Database>): DuePracticeCompletionRepository & TransferCreationRepository {
  async function findReviewGraph(userId: string, reviewTaskId: string) {
    const review = await client.from("review_tasks")
      .select("id,user_id,user_expression_id,mastery_state,status,due_at,completed_attempt_id,completed_at")
      .eq("user_id", userId).eq("id", reviewTaskId).maybeSingle();
    if (review.error) throw review.error;
    if (!review.data || review.data.user_id !== userId) return null;
    const expression = await client.from("user_expressions").select("id,user_id,mastery_state")
      .eq("user_id", userId).eq("id", review.data.user_expression_id).maybeSingle();
    if (expression.error) throw expression.error;
    const masteryState = MasteryStateSchema.safeParse(review.data.mastery_state);
    const expressionMasteryState = MasteryStateSchema.safeParse(expression.data?.mastery_state);
    if (
      !expression.data || expression.data.user_id !== userId ||
      expression.data.id !== review.data.user_expression_id ||
      !masteryState.success || !expressionMasteryState.success
    ) return null;
    return {
      ...review.data,
      mastery_state: masteryState.data,
      expression_mastery_state: expressionMasteryState.data,
      due_at: canonicalInstant(review.data.due_at),
      completed_at: review.data.completed_at === null ? null : canonicalInstant(review.data.completed_at),
    };
  }

  async function findTaskForReview(userId: string, reviewTaskId: string) {
    const task = await client.from("practice_tasks").select("*")
      .eq("user_id", userId).eq("review_task_id", reviewTaskId).maybeSingle();
    if (task.error) throw task.error;
    return task.data;
  }

  function eligiblePendingReview(review: Awaited<ReturnType<typeof findReviewGraph>>, now: string): review is NonNullable<typeof review> {
    return Boolean(
      review && review.status === "pending" &&
      review.expression_mastery_state === review.mastery_state &&
      review.completed_attempt_id === null && review.completed_at === null &&
      review.due_at <= now,
    );
  }

  function taskForGraph(
    row: Database["public"]["Tables"]["practice_tasks"]["Row"] | null,
    review: NonNullable<Awaited<ReturnType<typeof findReviewGraph>>>,
  ): DueTransferTask | null {
    if (
      !row || row.user_id !== review.user_id ||
      row.review_task_id !== review.id ||
      row.user_expression_id !== review.user_expression_id ||
      !row.due_at || canonicalInstant(row.due_at) !== review.due_at
    ) return null;
    return transferRecord(row, review.mastery_state);
  }

  async function findTransferTask(userId: string, reviewTaskId: string): Promise<DueTransferTask | null> {
    const review = await findReviewGraph(userId, reviewTaskId);
    if (!review || review.expression_mastery_state !== review.mastery_state) return null;
    return taskForGraph(await findTaskForReview(userId, reviewTaskId), review);
  }

  return {
    findTransferTask,
    findAssistance(userId,reviewTaskId){return createPracticeRoundStore(client as never).dueAssistance(userId,reviewTaskId);},
    async findCompletionState(userId, reviewTaskId) {
      const review = await findReviewGraph(userId, reviewTaskId);
      if (!review) return null;
      const task = taskForGraph(await findTaskForReview(userId, reviewTaskId), review);
      if (!task || !["pending", "completed", "cancelled"].includes(review.status)) return null;
      if (review.status !== "completed") {
        if (
          review.expression_mastery_state !== review.mastery_state ||
          review.completed_attempt_id !== null || review.completed_at !== null
        ) return null;
        return { status: review.status as "pending" | "cancelled", task, attempt: null };
      }
      if (!review.completed_attempt_id || !review.completed_at) return null;
      const attemptResult = await client.from("attempts").select([
        "id", "user_id", "user_expression_id", "practice_task_id", "response_chinese",
        "assistance_level", "passed", "independent_use", "accuracy_score", "accuracy_feedback_english",
        "naturalness_score", "naturalness_feedback_english", "contextual_fit_score",
        "contextual_fit_feedback_english", "submitted_at", "evaluation_prompt_version", "evaluation_model",
        "evaluation_gateway_config_id", "evaluation_gateway_revision", "evaluation_gateway_fingerprint",
      ].join(","))
        .eq("user_id", userId).eq("id", review.completed_attempt_id)
        .eq("practice_task_id", task.id).maybeSingle();
      if (attemptResult.error) throw attemptResult.error;
      const attempt = PersistedAttemptRowSchema.safeParse(attemptResult.data);
      if (
        !attempt.success || attempt.data.user_id !== userId ||
        attempt.data.user_expression_id !== task.userExpressionId ||
        canonicalInstant(attempt.data.submitted_at) !== review.completed_at ||
        attempt.data.independent_use !== (attempt.data.passed && attempt.data.assistance_level === "none")
      ) return null;
      const persisted = {
        responseChinese: attempt.data.response_chinese,
        assistanceLevel: attempt.data.assistance_level,
        passed: attempt.data.passed,
        accuracyScore: attempt.data.accuracy_score,
        accuracyFeedbackEnglish: attempt.data.accuracy_feedback_english,
        naturalnessScore: attempt.data.naturalness_score,
        naturalnessFeedbackEnglish: attempt.data.naturalness_feedback_english,
        contextualFitScore: attempt.data.contextual_fit_score,
        contextualFitFeedbackEnglish: attempt.data.contextual_fit_feedback_english,
        submittedAt: canonicalInstant(attempt.data.submitted_at),
        evaluationPromptVersion: attempt.data.evaluation_prompt_version,
        evaluationModel: attempt.data.evaluation_model,
        evaluationGatewayConfigId: attempt.data.evaluation_gateway_config_id,
        evaluationGatewayRevision: attempt.data.evaluation_gateway_revision,
        evaluationGatewayFingerprint: attempt.data.evaluation_gateway_fingerprint,
      } satisfies DuePracticePersistedAttempt;
      if (!readableEvaluationProvenance(persisted)) return null;
      const independent = attempt.data.passed && attempt.data.assistance_level === "none";
      const eventResult = await client.from("mastery_events")
        .select("id,user_id,user_expression_id,attempt_id,prior_state,new_state,occurred_at")
        .eq("user_id", userId).eq("user_expression_id", task.userExpressionId)
        .eq("attempt_id", attempt.data.id).limit(2);
      if (eventResult.error || !eventResult.data || eventResult.data.length !== 1) return null;
      const event = MasteryEventRowSchema.safeParse(eventResult.data[0]);
      if (
        !event.success || event.data.user_id !== userId ||
        event.data.user_expression_id !== task.userExpressionId ||
        event.data.attempt_id !== attempt.data.id ||
        event.data.prior_state !== review.mastery_state ||
        canonicalInstant(event.data.occurred_at) !== review.completed_at ||
        !legalHistoricalTransition(event.data.prior_state, event.data.new_state, independent) ||
        MASTERY_RANK[review.expression_mastery_state] < MASTERY_RANK[event.data.new_state]
      ) return null;
      return {
        status: "completed",
        task,
        attempt: persisted,
      };
    },
    async resolveActiveGatewayPin(userId) {
      const result = await client.rpc("resolve_active_user_model_gateway_pin", { p_user_id: userId });
      if (result.error) throw result.error;
      const row = result.data[0];
      if (!row || result.data.length !== 1) return null;
      return { configId: row.config_id, revision: row.revision, fingerprint: row.config_fingerprint };
    },
    async ensureTransferTask(userId, reviewTaskId, now) {
      const requestedAt = canonicalInstant(now);
      const review = await findReviewGraph(userId, reviewTaskId);
      if (!eligiblePendingReview(review, requestedAt)) throw new PracticeError("NOT_FOUND");
      const existing = taskForGraph(await findTaskForReview(userId, reviewTaskId), review);
      if (existing) return existing;
      // Existing legacy questions remain readable. New Review preparation is
      // exclusively handled by the claimed model-backed coordinator.
      throw new PracticeError("NOT_FOUND");
    },
    async completeDuePractice(input) {
      const result=await createPracticeRoundStore(client as never).completeDue(input.userId,{...input,completedAt:canonicalInstant(input.completedAt)}) as {completion:Database["public"]["Functions"]["complete_due_practice"]["Returns"][number];assistanceLevel:"none"|"hint"|"model_answer"};
      const row = result.completion;
      if(!row)throw new Error("due completion failed");
      return {
        reviewTaskId: row.review_task_id, practiceTaskId: row.practice_task_id, attemptId: row.attempt_id,
        masteryEventId: row.mastery_event_id, nextReviewTaskId: row.next_review_task_id,
        priorState: row.prior_state as MasteryState, newState: row.new_state as MasteryState,
        nextDueAt: canonicalInstant(row.next_due_at), intervalDays: row.interval_days, created: row.created,assistanceLevel:result.assistanceLevel,
      };
    },
  };
}

export function createDueTransferHttpHandler(dependencies: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly repository: TransferCreationRepository;
  readonly materialRepository: Pick<PracticeMaterialRepository, "findDueMaterial">;
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
      const material = await dependencies.materialRepository.findDueMaterial(session.userId, reviewTaskId.data);
      if (!material || material.task.kind !== "due_practice" || material.task.id !== task.id) {
        throw new PracticeError("NOT_FOUND");
      }
      return Response.json(success({
        id: task.id, reviewTaskId: task.reviewTaskId, targetExpression: task.targetExpression,
        promptChinese: task.promptChinese, instructionsEnglish: task.instructionsEnglish, goalEnglish: task.goalEnglish,
        material,
      }, requestId), { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return practiceErrorResponse(error, requestId);
    }
  };
}
