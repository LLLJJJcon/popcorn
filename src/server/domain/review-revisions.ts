import { z } from "zod";
import { LearningCardFieldsSchema } from "@/contracts/knowledge";
import { PracticeSituationSchema } from "@/contracts/practice";
import { ReviewRevisionInputSchema, type ReviewRevisionInput, type ReviewRevisionResponse } from "@/contracts/review-practice";
import { ModelGatewayError } from "@/server/ai/provider";
import { completeWithFormatRetries, type StructuredJsonGateway, type StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import * as modern from "@/server/ai/prompts/evaluate.v2";
import * as legacy from "@/server/ai/prompts/evaluate.v1";
import { getTargetFunction, getTargetSetting } from "@/server/ai/prompts/learning-intent-constants";
import { MODEL_OUTPUT_TOKENS } from "@/server/ai/output-budgets";
import type { ReviewContext, ReviewPracticeRepository } from "@/server/repositories/review-practice-repository";
import { PracticeError, practiceErrorFromUnknown, resolvePracticeEgress } from "./create-practice-task";

export type ReviewRevisionDependencies = {
  repository: ReviewPracticeRepository;
  gatewayResolver: StructuredJsonGatewayResolver;
  fixtureGateway: StructuredJsonGateway;
  ci: boolean;
  now: () => string;
};
const uuid = z.string().uuid();
const operation = (requestId: string, state: "failed" | "in_progress") => ({ operation: { kind: "revision", requestId, state } });

function requireOfficialContext(context: ReviewContext, reviewTaskId: string, input: ReviewRevisionInput) {
  const prepared = context.prepared, first = prepared?.reviewState.firstAnswer;
  const identity = prepared?.reviewState.identity;
  if (context.status !== "completed" || !prepared || !first ||
      prepared.reviewTaskId !== reviewTaskId || prepared.reviewState.reviewTaskId !== reviewTaskId ||
      prepared.id !== input.taskId || prepared.material.task.id !== input.taskId ||
      prepared.scenarioVersion !== input.scenarioVersion || prepared.scenarioFingerprint !== input.scenarioFingerprint ||
      identity?.taskId !== input.taskId || identity.scenarioVersion !== input.scenarioVersion || identity.scenarioFingerprint !== input.scenarioFingerprint ||
      first.attemptId !== input.attemptId || first.result.attemptId !== input.attemptId ||
      first.result.practiceTaskId !== input.taskId || first.result.reviewTaskId !== reviewTaskId) {
    throw new PracticeError("SCENARIO_CHANGED", false, { ...(prepared ? { current: prepared } : {}) });
  }
  return prepared;
}

/** Learning-only scoring. The repository publishes solely to revisions and their request receipts. */
export function createReviewRevisionService(dependencies: ReviewRevisionDependencies) {
  const { repository } = dependencies;
  return {
    async revise(userId: string, reviewTaskId: string, value: ReviewRevisionInput): Promise<ReviewRevisionResponse> {
      const decoded = ReviewRevisionInputSchema.safeParse(value);
      if (!uuid.safeParse(userId).success || !uuid.safeParse(reviewTaskId).success || !decoded.success) throw new PracticeError("VALIDATION_FAILED");
      const input = decoded.data;
      const context = await repository.read(userId, reviewTaskId);
      if (!context || context.userId !== userId || context.reviewTaskId !== reviewTaskId || context.status === "cancelled") throw new PracticeError("NOT_FOUND");
      const prepared = requireOfficialContext(context, reviewTaskId, input);
      // This pure lookup verifies request signature and replays before any egress work.
      const previous = await repository.lookupRevision(userId, reviewTaskId, input);
      if (previous?.kind === "ready") return previous.response;
      if (previous?.kind === "pending") throw new PracticeError("REQUEST_IN_PROGRESS", true, operation(input.requestId, "in_progress"));
      if (previous?.kind === "failed") throw new PracticeError(previous.code, true, operation(input.requestId, "failed"));
      if (context.removedFromVault) throw new PracticeError("NOT_FOUND");

      const modernCard = prepared.metadataMode === "modern" ? LearningCardFieldsSchema.safeParse(context.card) : null;
      const modernSituation = prepared.metadataMode === "modern" ? PracticeSituationSchema.safeParse(prepared.material.task.situation) : null;
      if (prepared.metadataMode === "modern" && (!modernCard?.success || !modernSituation?.success)) throw new PracticeError("LEGACY_METADATA_REQUIRED");
      const evaluator = prepared.metadataMode === "modern" ? modern : legacy;
      const prompt = modernCard?.success && modernSituation?.success
        ? modern.buildEvaluatePracticePrompt({ targetExpression: context.targetExpression, targetMeaning: modernCard.data.meaningHere, situationZh: modernSituation.data.situationZh, interlocutor: modernSituation.data.interlocutor, targetSetting: getTargetSetting(modernSituation.data.targetSetting), targetFunction: getTargetFunction(modernSituation.data.targetFunction), taskEn: modernSituation.data.taskEn, toneAndWho: modernCard.data.toneAndWho, watchOut: modernCard.data.watchOut, learnerResponse: input.responseChinese })
        : legacy.buildEvaluatePracticePrompt({ targetExpression: context.targetExpression, promptChinese: prepared.promptChinese, learnerResponse: input.responseChinese });
      // A missing/unavailable gateway is a zero-call precondition, not a failed request cycle.
      const egress = await resolvePracticeEgress(userId, dependencies);
      const claim = await repository.claimRevision(userId, reviewTaskId, input, dependencies.now());
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
        return await repository.publishRevision(userId, reviewTaskId, input, claim.token, { evaluation: parsed.evaluation, coaching: allFive ? null : parsed.coaching, model: egress.gateway.model, pin: egress.pin, promptVersion: evaluator.EVALUATE_PRACTICE_PROMPT_VERSION }, dependencies.now());
      } catch (error) {
        const safe = practiceErrorFromUnknown(error);
        let failed = false;
        try { failed = await repository.failRevision(userId, reviewTaskId, input.requestId, claim.token, safe.code, dependencies.now()); }
        catch { /* Unknown persistence outcome keeps the same request identity. */ }
        if (failed) throw new PracticeError(safe.code, safe.retryable, { ...safe.details, ...operation(input.requestId, "failed") });
        // Publication may have committed before its response was lost. Never turn that
        // uncertainty into a fresh-ID instruction or overwrite an already-ready receipt.
        const replay = await repository.lookupRevision(userId, reviewTaskId, input).catch(() => null);
        if (replay?.kind === "ready") return replay.response;
        if (replay?.kind === "pending") throw new PracticeError("REQUEST_IN_PROGRESS", true, operation(input.requestId, "in_progress"));
        if (replay?.kind === "failed") throw new PracticeError(replay.code, true, operation(input.requestId, "failed"));
        throw new PracticeError(safe.code, true, safe.details);
      }
    },
  };
}
