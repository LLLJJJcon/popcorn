import { z } from "zod";
import { LearningCardFieldsSchema } from "@/contracts/knowledge";
import { PracticeSituationSchema } from "@/contracts/practice";
import { DueReviewStateSchema, ReviewCompletionInputSchema, type DueReviewState, type ReviewCompletionInput } from "@/contracts/review-practice";
import { ModelGatewayError } from "@/server/ai/provider";
import { completeWithFormatRetries, type StructuredJsonGateway, type StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import * as modern from "@/server/ai/prompts/evaluate.v2";
import * as legacy from "@/server/ai/prompts/evaluate.v1";
import { getTargetFunction, getTargetSetting } from "@/server/ai/prompts/learning-intent-constants";
import { MODEL_OUTPUT_TOKENS } from "@/server/ai/output-budgets";
import type { ReviewContext, ReviewPracticeRepository, OfficialReviewCompletion } from "@/server/repositories/review-practice-repository";
import { PracticeError, practiceErrorFromUnknown, resolvePracticeEgress } from "./create-practice-task";

export type ReviewCompletionDependencies = {
  repository: ReviewPracticeRepository;
  gatewayResolver: StructuredJsonGatewayResolver;
  fixtureGateway: StructuredJsonGateway;
  ci: boolean;
  now: () => string;
};
const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const operation = (requestId: string, state: "failed" | "in_progress") => ({ operation: { kind: "complete", requestId, state } });

function sameIdentity(identity: DueReviewState["identity"], input: ReviewCompletionInput) {
  return identity.taskId === input.taskId && identity.scenarioVersion === input.scenarioVersion && identity.scenarioFingerprint === input.scenarioFingerprint;
}
function restoreOfficial(stateValue: DueReviewState, reviewTaskId: string, input: ReviewCompletionInput): OfficialReviewCompletion {
  const decoded = DueReviewStateSchema.safeParse(stateValue);
  if (!decoded.success || decoded.data.reviewTaskId !== reviewTaskId || !decoded.data.firstAnswer) throw new PracticeError("NOT_FOUND");
  const state = decoded.data, first = decoded.data.firstAnswer!;
  if (!sameIdentity(state.identity, input)) throw new PracticeError("SCENARIO_CHANGED", false, { reviewState: state });
  if (first.result.reviewTaskId !== reviewTaskId || first.result.practiceTaskId !== input.taskId || first.result.attemptId !== first.attemptId) throw new PracticeError("NOT_FOUND");
  if (first.responseChinese !== input.responseChinese) throw new PracticeError("REVISION_CONFLICT", false, { reviewState: state });
  return { ...first.result, created: false, evaluation: first.evaluation, coaching: first.coaching, reviewState: state };
}
function requirePending(context: ReviewContext | null, userId: string, reviewTaskId: string, input: ReviewCompletionInput) {
  if (!context || context.userId !== userId || context.reviewTaskId !== reviewTaskId || context.status !== "pending" || !context.prepared) throw new PracticeError("NOT_FOUND");
  const prepared = context.prepared, material = prepared.material.task;
  if (prepared.reviewTaskId !== reviewTaskId || prepared.reviewState.reviewTaskId !== reviewTaskId || prepared.reviewState.firstAnswer ||
      prepared.id !== input.taskId || prepared.scenarioVersion !== input.scenarioVersion || prepared.scenarioFingerprint !== input.scenarioFingerprint ||
      !sameIdentity(prepared.reviewState.identity, input) || material.kind !== "due_practice" || material.id !== input.taskId ||
      prepared.targetExpression !== context.targetExpression || material.targetExpression !== context.targetExpression ||
      prepared.promptChinese !== material.promptChinese || prepared.instructionsEnglish !== material.instructionsEnglish || prepared.goalEnglish !== material.goalEnglish ||
      (material.situation && material.situation.situationZh !== prepared.promptChinese)) {
    throw new PracticeError("SCENARIO_CHANGED", false, { current: prepared });
  }
  return { context, prepared };
}

/** Claims each model scoring cycle; official state changes stay in the original atomic SQL path. */
export function createReviewCompletionService(dependencies: ReviewCompletionDependencies) {
  const { repository } = dependencies;
  return {
    async complete(userId: string, reviewTaskId: string, value: ReviewCompletionInput): Promise<OfficialReviewCompletion> {
      const decoded = ReviewCompletionInputSchema.safeParse(value);
      if (!uuid.safeParse(userId).success || !uuid.safeParse(reviewTaskId).success || !decoded.success) throw new PracticeError("VALIDATION_FAILED");
      const input = decoded.data;
      // Signature-checked replay precedes all material/source and gateway work.
      const prior = await repository.lookupCompletion(userId, reviewTaskId, input);
      if (prior?.kind === "ready") return prior.response;
      if (prior?.kind === "pending") throw new PracticeError("REQUEST_IN_PROGRESS", true, operation(input.requestId, "in_progress"));
      if (prior?.kind === "failed") throw new PracticeError(prior.code, true, operation(input.requestId, "failed"));
      const official = await repository.completionState(userId, reviewTaskId);
      if (official) return restoreOfficial(official, reviewTaskId, input);

      const { context, prepared } = requirePending(await repository.read(userId, reviewTaskId), userId, reviewTaskId, input);
      const clock = dependencies.now();
      if (!instant.safeParse(clock).success || !Number.isFinite(Date.parse(clock))) throw new PracticeError("INTERNAL_ERROR", true);
      const submittedAt = new Date(clock).toISOString();
      if (!Number.isFinite(Date.parse(context.dueAt)) || Date.parse(context.dueAt) > Date.parse(submittedAt)) throw new PracticeError("NOT_FOUND");
      const modernCard = prepared.metadataMode === "modern" ? LearningCardFieldsSchema.safeParse(context.card) : null;
      const modernSituation = prepared.metadataMode === "modern" ? PracticeSituationSchema.safeParse(prepared.material.task.situation) : null;
      if (prepared.metadataMode === "modern" && (!modernCard?.success || !modernSituation?.success)) throw new PracticeError("LEGACY_METADATA_REQUIRED");
      const evaluator = prepared.metadataMode === "modern" ? modern : legacy;
      const prompt = modernCard?.success && modernSituation?.success
        ? modern.buildEvaluatePracticePrompt({ targetExpression: context.targetExpression, targetMeaning: modernCard.data.meaningHere, situationZh: modernSituation.data.situationZh, interlocutor: modernSituation.data.interlocutor, targetSetting: getTargetSetting(modernSituation.data.targetSetting), targetFunction: getTargetFunction(modernSituation.data.targetFunction), taskEn: modernSituation.data.taskEn, toneAndWho: modernCard.data.toneAndWho, watchOut: modernCard.data.watchOut, learnerResponse: input.responseChinese })
        : legacy.buildEvaluatePracticePrompt({ targetExpression: context.targetExpression, promptChinese: prepared.promptChinese, learnerResponse: input.responseChinese });
      // Configuration failures must not create terminal request receipts.
      const egress = await resolvePracticeEgress(userId, dependencies);
      const claim = await repository.claimCompletion(userId, reviewTaskId, input, dependencies.now());
      if (claim.kind === "ready") return claim.response;
      if (claim.kind === "pending") throw new PracticeError("REQUEST_IN_PROGRESS", true, operation(input.requestId, "in_progress"));
      try {
        const wire = await completeWithFormatRetries(
          () => egress.gateway.complete(evaluator.EVALUATE_PRACTICE_PROMPT_VERSION, prompt.userPrompt, { systemPrompt: prompt.systemPrompt, timeoutMs: 30_000, maxTokens: MODEL_OUTPUT_TOKENS.evaluatePractice, normalize: evaluator.normalizePracticeEvaluationWire }),
          value => {
            const result = evaluator.normalizePracticeEvaluationWire(value as unknown as Record<string, unknown>);
            if (!result.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema", result.fieldPath);
            return result.data;
          },
        );
        const parsed = evaluator.parsePracticeEvaluationOutput(wire, context.targetExpression, prepared.reviewState.examplesOpenedAt ? "model_answer" : "none");
        const allFive = [parsed.evaluation.accuracy, parsed.evaluation.naturalness, parsed.evaluation.contextualFit].every(dimension => dimension.score === 5);
        return await repository.publishCompletion(userId, reviewTaskId, input, claim.token, { evaluation: parsed.evaluation, coaching: allFive ? null : parsed.coaching, model: egress.gateway.model, pin: egress.pin, promptVersion: evaluator.EVALUATE_PRACTICE_PROMPT_VERSION, submittedAt }, dependencies.now());
      } catch (error) {
        const safe = practiceErrorFromUnknown(error);
        // Publication can have committed before a transport response was lost.
        // Recover its authoritative result before attempting any failure write.
        const published = await repository.lookupCompletion(userId, reviewTaskId, input).catch(() => null);
        if (published?.kind === "ready") return published.response;
        if (published?.kind === "failed") throw new PracticeError(published.code, true, operation(input.requestId, "failed"));
        let failed = false;
        try { failed = await repository.failCompletion(userId, reviewTaskId, input.requestId, claim.token, safe.code, dependencies.now()); }
        catch { /* An unknown failure write cannot authorize a fresh request ID. */ }
        if (failed) throw new PracticeError(safe.code, safe.retryable, { ...safe.details, ...operation(input.requestId, "failed") });
        const recovered = await repository.lookupCompletion(userId, reviewTaskId, input).catch(() => null);
        if (recovered?.kind === "ready") return recovered.response;
        if (recovered?.kind === "pending") throw new PracticeError("REQUEST_IN_PROGRESS", true, operation(input.requestId, "in_progress"));
        if (recovered?.kind === "failed") throw new PracticeError(recovered.code, true, operation(input.requestId, "failed"));
        throw new PracticeError(safe.code, true, safe.details);
      }
    },
  };
}
