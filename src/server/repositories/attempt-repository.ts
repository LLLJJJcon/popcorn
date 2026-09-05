import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  AssistanceLevelSchema,
  AttemptRecordedSchema,
  type AssistanceLevel,
  type AttemptRecorded,
  type PracticeAttemptResponse,
  type PracticeCoaching,
} from "@/contracts/practice";
import { TargetChineseTextSchema } from "@/contracts/source";
import {
  EVALUATE_PRACTICE_PROMPT_VERSION,
  buildEvaluatePracticePrompt,
  createEvaluationFixtureGateway,
  parsePracticeEvaluationOutput,
} from "@/server/ai/prompts/evaluate.v1";
import { createActivationFixtureGateway } from "@/server/ai/prompts/activate.v1";
import {
  createStructuredJsonGatewayResolver,
  type StructuredJsonGateway,
  type StructuredJsonGatewayResolver,
} from "@/server/ai/structured-json-gateway";
import {
  PracticeError,
  createPracticeTaskService,
  practiceErrorResponse,
  practiceTaskView,
  readPracticeMutation,
  resolvePracticeEgress,
  type CandidateArtifactRecord,
  type CandidateSelection,
  type PracticeDraftRecord,
  type PracticeRepository,
} from "@/server/domain/create-practice-task";
import type { Database } from "@/types/database.generated";
import { success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";
import { createSupabaseModelGatewayRuntimeResolver } from "@/server/model-gateway/runtime-resolver";
import {
  createRecordValidAttemptService,
  createSupabasePracticePromotionRepository,
  type PracticePromotionResult,
} from "@/server/domain/record-valid-attempt";

const UserIdSchema = z.string().uuid();
const OriginalAttemptInputSchema = z.strictObject({
  taskId: z.string().uuid(),
  responseChinese: TargetChineseTextSchema.max(5_000),
  assistanceLevel: AssistanceLevelSchema.default("none"),
});
const AttemptIdSchema = z.string().uuid();
const RevisionInputSchema = z.strictObject({
  responseChinese: TargetChineseTextSchema.max(5_000),
  assistanceLevel: AssistanceLevelSchema.default("none"),
});

export type PracticeDraftAttemptRecord = {
  readonly id: string;
  readonly userId: string;
  readonly practiceDraftId: string;
  readonly futureUserExpressionId: string;
  readonly revision: number;
  readonly responseChinese: string;
  readonly passed: boolean;
  readonly accuracyScore: number;
  readonly accuracyFeedbackEnglish: string;
  readonly naturalnessScore: number;
  readonly naturalnessFeedbackEnglish: string;
  readonly contextualFitScore: number;
  readonly contextualFitFeedbackEnglish: string;
  readonly independentUse: boolean;
  readonly assistanceLevel: "none" | "hint" | "model_answer";
  readonly submittedAt: string;
  readonly evaluationPromptVersion: string | null;
  readonly evaluationModel: string | null;
  readonly evaluationGatewayConfigId: string | null;
  readonly evaluationGatewayRevision: number | null;
  readonly evaluationGatewayFingerprint: string | null;
  readonly createdAt: string;
};

export class RevisionConflictError extends Error {
  override readonly name = "RevisionConflictError";
}

type PracticeAttemptRepository = PracticeRepository & {
  findOriginalAttempt(userId: string, taskId: string): Promise<PracticeDraftAttemptRecord | null>;
};

function attemptView(record: PracticeDraftAttemptRecord): AttemptRecorded {
  return AttemptRecordedSchema.parse({
    id: record.id,
    userId: record.userId,
    practiceTaskId: record.practiceDraftId,
    userExpressionId: record.futureUserExpressionId,
    responseChinese: record.responseChinese,
    evaluation: {
      passed: record.passed,
      accuracy: { score: record.accuracyScore, englishFeedback: record.accuracyFeedbackEnglish },
      naturalness: { score: record.naturalnessScore, englishFeedback: record.naturalnessFeedbackEnglish },
      contextualFit: { score: record.contextualFitScore, englishFeedback: record.contextualFitFeedbackEnglish },
      independentUse: record.independentUse,
      assistanceLevel: record.assistanceLevel,
    },
    submittedAt: record.submittedAt,
    createdAt: record.createdAt,
  });
}

export function createPracticeAttemptService(dependencies: {
  readonly repository: PracticeAttemptRepository;
  readonly gatewayResolver: StructuredJsonGatewayResolver;
  readonly fixtureGateway: StructuredJsonGateway;
  readonly ci: boolean;
  readonly now: () => string;
  readonly attemptId: () => string;
  readonly promoteValidAttempt: (
    userId: string,
    draft: PracticeDraftRecord,
    attempt: PracticeDraftAttemptRecord,
  ) => Promise<PracticePromotionResult>;
}) {
  async function evaluateAndPersist(
    userId: string,
    draft: PracticeDraftRecord,
    responseChinese: string,
    revision: number,
    assistanceLevel: AssistanceLevel,
  ): Promise<{ readonly record: PracticeDraftAttemptRecord; readonly coaching: PracticeCoaching | null }> {
    const resolved = await resolvePracticeEgress(userId, dependencies);
    let parsed: ReturnType<typeof parsePracticeEvaluationOutput>;
    try {
      parsed = parsePracticeEvaluationOutput(
        await resolved.gateway.complete(
          EVALUATE_PRACTICE_PROMPT_VERSION,
          buildEvaluatePracticePrompt(practiceTaskView(draft), responseChinese, assistanceLevel),
          {
            systemPrompt: `Popcorn learning artifact task ${EVALUATE_PRACTICE_PROMPT_VERSION}. Return only the requested JSON object.`,
            timeoutMs: 30_000,
            maxTokens: 700,
            normalize(value) {
              try {
                parsePracticeEvaluationOutput(value, draft.targetExpression, assistanceLevel);
                return { success: true, data: value };
              } catch {
                return { success: false, fieldPath: "evaluation" };
              }
            },
          },
        ),
        draft.targetExpression,
        assistanceLevel,
      );
    } catch (error) {
      if (error instanceof PracticeError) throw error;
      throw new PracticeError("PROVIDER_FAILED", true);
    }
    const evaluation = parsed.evaluation;
    const now = dependencies.now();
    const record: PracticeDraftAttemptRecord = {
      id: dependencies.attemptId(),
      userId,
      practiceDraftId: draft.id,
      futureUserExpressionId: draft.futureUserExpressionId,
      revision,
      responseChinese,
      passed: evaluation.passed,
      accuracyScore: evaluation.accuracy.score,
      accuracyFeedbackEnglish: evaluation.accuracy.englishFeedback,
      naturalnessScore: evaluation.naturalness.score,
      naturalnessFeedbackEnglish: evaluation.naturalness.englishFeedback,
      contextualFitScore: evaluation.contextualFit.score,
      contextualFitFeedbackEnglish: evaluation.contextualFit.englishFeedback,
      independentUse: assistanceLevel === "none",
      assistanceLevel,
      submittedAt: now,
      evaluationPromptVersion: resolved.pin ? EVALUATE_PRACTICE_PROMPT_VERSION : null,
      evaluationModel: resolved.pin ? resolved.gateway.model : null,
      evaluationGatewayConfigId: resolved.pin?.configId ?? null,
      evaluationGatewayRevision: resolved.pin?.revision ?? null,
      evaluationGatewayFingerprint: resolved.pin?.fingerprint ?? null,
      createdAt: now,
    };
    try {
      return {
        record: await dependencies.repository.insertAttempt(record),
        coaching: parsed.coaching,
      };
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        throw new PracticeError("REVISION_CONFLICT");
      }
      throw new PracticeError("INTERNAL_ERROR", true);
    }
  }

  async function promoteIfEligible(
    userId: string,
    draft: PracticeDraftRecord,
    record: PracticeDraftAttemptRecord,
  ): Promise<void> {
    if (
      record.revision !== 1 || !record.passed ||
      !record.independentUse || record.assistanceLevel !== "none"
    ) return;
    try {
      await dependencies.promoteValidAttempt(userId, draft, record);
    } catch {
      throw new PracticeError("INTERNAL_ERROR", true);
    }
  }

  async function recoverOriginal(
    userId: string,
    draft: PracticeDraftRecord,
    responseChinese: string,
    assistanceLevel: AssistanceLevel,
  ): Promise<PracticeAttemptResponse | null> {
    const existing = await dependencies.repository.findOriginalAttempt(userId, draft.id);
    if (!existing) return null;
    if (
      existing.responseChinese !== responseChinese ||
      existing.assistanceLevel !== assistanceLevel
    ) throw new PracticeError("REVISION_CONFLICT");
    await promoteIfEligible(userId, draft, existing);
    return { attempt: attemptView(existing), coaching: null };
  }

  return {
    async submitOriginal(userIdValue: string, inputValue: z.input<typeof OriginalAttemptInputSchema>) {
      const userId = UserIdSchema.safeParse(userIdValue);
      const input = OriginalAttemptInputSchema.safeParse(inputValue);
      if (!userId.success || !input.success) throw new PracticeError("VALIDATION_FAILED");
      const draft = await dependencies.repository.findDraft(userId.data, input.data.taskId);
      if (!draft || draft.userId !== userId.data || draft.status === "abandoned") {
        throw new PracticeError("NOT_FOUND");
      }
      const recovered = await recoverOriginal(
        userId.data, draft, input.data.responseChinese, input.data.assistanceLevel,
      );
      if (recovered) return recovered;
      if (draft.status !== "active") throw new PracticeError("NOT_FOUND");
      const revision = await dependencies.repository.nextRevision(userId.data, draft.id);
      if (revision !== 1) throw new PracticeError("REVISION_CONFLICT");
      try {
        const result = await evaluateAndPersist(
          userId.data, draft, input.data.responseChinese, 1, input.data.assistanceLevel,
        );
        await promoteIfEligible(userId.data, draft, result.record);
        return { attempt: attemptView(result.record), coaching: result.coaching };
      } catch (error) {
        if (error instanceof PracticeError && error.code === "REVISION_CONFLICT") {
          const raced = await recoverOriginal(
            userId.data, draft, input.data.responseChinese, input.data.assistanceLevel,
          );
          if (raced) return raced;
        }
        throw error;
      }
    },

    async submitRevision(
      userIdValue: string,
      attemptIdValue: string,
      responseChineseValue: string,
      assistanceLevelValue: AssistanceLevel = "none",
    ) {
      const userId = UserIdSchema.safeParse(userIdValue);
      const attemptId = AttemptIdSchema.safeParse(attemptIdValue);
      const responseChinese = TargetChineseTextSchema.max(5_000).safeParse(responseChineseValue);
      const assistanceLevel = AssistanceLevelSchema.safeParse(assistanceLevelValue);
      if (!userId.success || !attemptId.success || !responseChinese.success || !assistanceLevel.success) {
        throw new PracticeError("VALIDATION_FAILED");
      }
      const original = await dependencies.repository.findAttempt(userId.data, attemptId.data);
      if (!original || original.userId !== userId.data) throw new PracticeError("NOT_FOUND");
      const draft = await dependencies.repository.findDraft(userId.data, original.practiceDraftId);
      if (!draft || draft.userId !== userId.data || draft.status === "abandoned") {
        throw new PracticeError("NOT_FOUND");
      }
      const revision = await dependencies.repository.nextRevision(userId.data, draft.id);
      const result = await evaluateAndPersist(
        userId.data, draft, responseChinese.data, revision, assistanceLevel.data,
      );
      return { attempt: attemptView(result.record), coaching: result.coaching };
    },
  };
}

export function createPracticeAttemptHttpHandlers(dependencies: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly submitOriginal: (userId: string, input: z.infer<typeof OriginalAttemptInputSchema>) => Promise<unknown>;
  readonly submitRevision: (
    userId: string, attemptId: string, responseChinese: string, assistanceLevel: AssistanceLevel,
  ) => Promise<unknown>;
  readonly appUrl: string;
  readonly requestId: () => string;
}) {
  async function mutation(request: Request) {
    const requestId = dependencies.requestId();
    const result = await readPracticeMutation(request, { ...dependencies, requestId });
    return { requestId, result };
  }

  return {
    async original(request: Request): Promise<Response> {
      const { requestId, result } = await mutation(request);
      if (!result.ok) return result.response;
      const input = OriginalAttemptInputSchema.safeParse(result.body);
      if (!input.success) return practiceErrorResponse(new PracticeError("VALIDATION_FAILED"), requestId);
      try {
        return Response.json(success(await dependencies.submitOriginal(result.userId, input.data), requestId), {
          status: 201,
          headers: { "Cache-Control": "no-store" },
        });
      } catch (error) {
        return practiceErrorResponse(error, requestId);
      }
    },

    async revision(
      request: Request,
      context: { readonly params: Promise<{ readonly attemptId?: string }> },
    ): Promise<Response> {
      const { requestId, result } = await mutation(request);
      if (!result.ok) return result.response;
      const attemptId = AttemptIdSchema.safeParse((await context.params).attemptId);
      const input = RevisionInputSchema.safeParse(result.body);
      if (!attemptId.success || !input.success) {
        return practiceErrorResponse(new PracticeError("VALIDATION_FAILED"), requestId);
      }
      try {
        return Response.json(success(
          await dependencies.submitRevision(
            result.userId, attemptId.data, input.data.responseChinese, input.data.assistanceLevel,
          ),
          requestId,
        ), { status: 201, headers: { "Cache-Control": "no-store" } });
      } catch (error) {
        return practiceErrorResponse(error, requestId);
      }
    },
  };
}

type DraftRow = Database["public"]["Tables"]["practice_drafts"]["Row"];
type AttemptRow = Database["public"]["Tables"]["practice_draft_attempts"]["Row"];
type ArtifactRow = Database["public"]["Tables"]["generated_artifacts"]["Row"];

function draftRecord(row: DraftRow): PracticeDraftRecord {
  return {
    id: row.id,
    userId: row.user_id,
    videoSourceId: row.video_source_id,
    savedItemId: row.saved_item_id,
    candidateArtifactId: row.candidate_artifact_id,
    candidateIndex: row.candidate_index,
    futureUserExpressionId: row.future_user_expression_id,
    nativeLanguage: "en",
    targetLanguage: "zh-CN",
    targetExpression: row.target_expression,
    promptChinese: row.prompt_chinese,
    instructionsEnglish: row.instructions_english,
    goalEnglish: row.goal_english,
    status: row.status as PracticeDraftRecord["status"],
    activationPromptVersion: row.activation_prompt_version,
    activationModel: row.activation_model,
    activationGatewayConfigId: row.activation_gateway_config_id,
    activationGatewayRevision: row.activation_gateway_revision,
    activationGatewayFingerprint: row.activation_gateway_fingerprint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function attemptRecord(row: AttemptRow): PracticeDraftAttemptRecord {
  return {
    id: row.id,
    userId: row.user_id,
    practiceDraftId: row.practice_draft_id,
    futureUserExpressionId: row.future_user_expression_id,
    revision: row.revision,
    responseChinese: row.response_chinese,
    passed: row.passed,
    accuracyScore: row.accuracy_score,
    accuracyFeedbackEnglish: row.accuracy_feedback_english,
    naturalnessScore: row.naturalness_score,
    naturalnessFeedbackEnglish: row.naturalness_feedback_english,
    contextualFitScore: row.contextual_fit_score,
    contextualFitFeedbackEnglish: row.contextual_fit_feedback_english,
    independentUse: row.independent_use,
    assistanceLevel: row.assistance_level as PracticeDraftAttemptRecord["assistanceLevel"],
    submittedAt: row.submitted_at,
    evaluationPromptVersion: row.evaluation_prompt_version,
    evaluationModel: row.evaluation_model,
    evaluationGatewayConfigId: row.evaluation_gateway_config_id,
    evaluationGatewayRevision: row.evaluation_gateway_revision,
    evaluationGatewayFingerprint: row.evaluation_gateway_fingerprint,
    createdAt: row.created_at,
  };
}

const draftColumns = "id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,activation_prompt_version,activation_model,activation_gateway_config_id,activation_gateway_revision,activation_gateway_fingerprint,created_at,updated_at";
const attemptColumns = "id,user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,passed,accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at,evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,evaluation_gateway_revision,evaluation_gateway_fingerprint,created_at";

function databaseCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : null;
}

export function createSupabasePracticeRepository(client: SupabaseClient<Database>): PracticeAttemptRepository {
  async function findDraft(userId: string, taskId: string): Promise<PracticeDraftRecord | null> {
    const result = await client.from("practice_drafts").select(draftColumns)
      .eq("user_id", userId).eq("id", taskId).maybeSingle();
    if (result.error) throw result.error;
    return result.data ? draftRecord(result.data as DraftRow) : null;
  }

  return {
    async findCandidate(userId: string, selection: CandidateSelection) {
      const result = await client.from("generated_artifacts")
        .select("id,user_id,video_source_id,saved_item_id,artifact_type,content")
        .eq("user_id", userId)
        .eq("id", selection.candidateArtifactId)
        .eq("saved_item_id", selection.savedItemId)
        .eq("artifact_type", "saved_item_analysis")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return null;
      const row = result.data as Pick<ArtifactRow, "id" | "user_id" | "video_source_id" | "saved_item_id" | "artifact_type" | "content">;
      if (!row.saved_item_id || row.user_id !== userId) return null;
      return {
        id: row.id,
        userId: row.user_id,
        videoSourceId: row.video_source_id,
        savedItemId: row.saved_item_id,
        artifactType: row.artifact_type,
        content: row.content,
      } satisfies CandidateArtifactRecord;
    },

    async findDraftBySelection(userId, selection) {
      const result = await client.from("practice_drafts").select(draftColumns)
        .eq("user_id", userId)
        .eq("saved_item_id", selection.savedItemId)
        .eq("candidate_artifact_id", selection.candidateArtifactId)
        .eq("candidate_index", selection.candidateIndex)
        .eq("status", "active")
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (result.error) throw result.error;
      return result.data ? draftRecord(result.data as DraftRow) : null;
    },

    findDraft,

    async insertDraft(input) {
      const result = await client.from("practice_drafts").insert({
        id: input.id,
        user_id: input.userId,
        video_source_id: input.videoSourceId,
        saved_item_id: input.savedItemId,
        candidate_artifact_id: input.candidateArtifactId,
        candidate_artifact_type: "saved_item_analysis",
        candidate_index: input.candidateIndex,
        future_user_expression_id: input.futureUserExpressionId,
        native_language: input.nativeLanguage,
        target_language: input.targetLanguage,
        target_expression: input.targetExpression,
        prompt_chinese: input.promptChinese,
        instructions_english: input.instructionsEnglish,
        goal_english: input.goalEnglish,
        status: input.status,
        activation_prompt_version: input.activationPromptVersion,
        activation_model: input.activationModel,
        activation_gateway_config_id: input.activationGatewayConfigId,
        activation_gateway_revision: input.activationGatewayRevision,
        activation_gateway_fingerprint: input.activationGatewayFingerprint,
        created_at: input.createdAt,
        updated_at: input.updatedAt,
      }).select(draftColumns).single();
      if (!result.error && result.data) return draftRecord(result.data as DraftRow);
      if (databaseCode(result.error) === "23505") {
        const existing = await findDraft(input.userId, input.id);
        if (existing) return existing;
      }
      throw result.error ?? new Error("practice draft persistence failed");
    },

    async resolveActiveGatewayPin(userId) {
      const result = await client.rpc("resolve_active_user_model_gateway_pin", { p_user_id: userId });
      if (result.error) throw result.error;
      const row = result.data[0];
      if (!row || result.data.length !== 1) return null;
      return { configId: row.config_id, revision: row.revision, fingerprint: row.config_fingerprint };
    },

    async findAttempt(userId, attemptId) {
      const result = await client.from("practice_draft_attempts").select(attemptColumns)
        .eq("user_id", userId).eq("id", attemptId).maybeSingle();
      if (result.error) throw result.error;
      return result.data ? attemptRecord(result.data as AttemptRow) : null;
    },

    async findOriginalAttempt(userId, taskId) {
      const result = await client.from("practice_draft_attempts").select(attemptColumns)
        .eq("user_id", userId).eq("practice_draft_id", taskId).eq("revision", 1).maybeSingle();
      if (result.error) throw result.error;
      return result.data ? attemptRecord(result.data as AttemptRow) : null;
    },

    async nextRevision(userId, taskId) {
      const result = await client.from("practice_draft_attempts").select("revision")
        .eq("user_id", userId).eq("practice_draft_id", taskId)
        .order("revision", { ascending: false }).limit(1).maybeSingle();
      if (result.error) throw result.error;
      return (result.data?.revision ?? 0) + 1;
    },

    async insertAttempt(input) {
      const result = await client.from("practice_draft_attempts").insert({
        id: input.id,
        user_id: input.userId,
        practice_draft_id: input.practiceDraftId,
        future_user_expression_id: input.futureUserExpressionId,
        revision: input.revision,
        response_chinese: input.responseChinese,
        passed: input.passed,
        accuracy_score: input.accuracyScore,
        accuracy_feedback_english: input.accuracyFeedbackEnglish,
        naturalness_score: input.naturalnessScore,
        naturalness_feedback_english: input.naturalnessFeedbackEnglish,
        contextual_fit_score: input.contextualFitScore,
        contextual_fit_feedback_english: input.contextualFitFeedbackEnglish,
        independent_use: input.independentUse,
        assistance_level: input.assistanceLevel,
        submitted_at: input.submittedAt,
        evaluation_prompt_version: input.evaluationPromptVersion,
        evaluation_model: input.evaluationModel,
        evaluation_gateway_config_id: input.evaluationGatewayConfigId,
        evaluation_gateway_revision: input.evaluationGatewayRevision,
        evaluation_gateway_fingerprint: input.evaluationGatewayFingerprint,
        created_at: input.createdAt,
      }).select(attemptColumns).single();
      if (databaseCode(result.error) === "23505") throw new RevisionConflictError();
      if (result.error || !result.data) throw result.error ?? new Error("practice attempt persistence failed");
      return attemptRecord(result.data as AttemptRow);
    },
  };
}

export function createPracticeServerServices(client: SupabaseClient<Database>, ci: boolean) {
  const repository = createSupabasePracticeRepository(client);
  const activationFixture = createActivationFixtureGateway();
  const evaluationFixture = createEvaluationFixtureGateway();
  const resolver = (fixtureGateway: StructuredJsonGateway) => createStructuredJsonGatewayResolver({
    ci,
    fixture: fixtureGateway,
    createRuntimeResolver: () => createSupabaseModelGatewayRuntimeResolver(client),
  });
  const common = { repository, ci, now: () => new Date().toISOString(), attemptId: randomUUID };
  const promotion = createRecordValidAttemptService({
    repository: createSupabasePracticePromotionRepository(client),
  });
  return {
    repository,
    taskService: createPracticeTaskService({
      ...common,
      fixtureGateway: activationFixture,
      gatewayResolver: resolver(activationFixture),
    }),
    attemptService: createPracticeAttemptService({
      ...common,
      fixtureGateway: evaluationFixture,
      gatewayResolver: resolver(evaluationFixture),
      promoteValidAttempt: promotion.promote,
    }),
  };
}
