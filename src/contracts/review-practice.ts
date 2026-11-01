import { z } from "zod";

import { MasteryStateSchema } from "./memory";
import { FunctionCategorySchema, UsageSettingSchema } from "./knowledge";
import { EvaluationResultSchema, PracticeCoachingSchema } from "./practice";
import { EnglishTextSchema, TargetChineseTextSchema } from "./source";
import { PracticeMaterialViewSchema } from "@/features/practice/material-schema";

const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const DueScenarioIdentitySchema = z.strictObject({
  taskId: uuid, scenarioVersion: z.number().int().positive(), scenarioFingerprint: hash,
});
export const ReviewMutationInputSchema = DueScenarioIdentitySchema.extend({ requestId: uuid });
export const ReviewCompletionInputSchema = ReviewMutationInputSchema.extend({
  responseChinese: TargetChineseTextSchema.max(10_000),
});
export const ReviewRevisionInputSchema = ReviewCompletionInputSchema.extend({ attemptId: uuid });

const transition = z.strictObject({ from: MasteryStateSchema, to: MasteryStateSchema });
/** Original official result fields remain compatible with group3 callbacks. */
export const DueCompletionReceiptSchema = z.strictObject({
  reviewTaskId: uuid, practiceTaskId: uuid, attemptId: uuid, masteryEventId: uuid,
  nextReviewTaskId: uuid, priorState: MasteryStateSchema, newState: MasteryStateSchema,
  nextDueAt: instant, intervalDays: z.number().int().min(1).max(365), created: z.boolean(),
  transition: transition.nullable(),
}).superRefine((result, context) => {
  const changed = result.priorState !== result.newState;
  if (changed !== (result.transition !== null) || (result.transition &&
    (result.transition.from !== result.priorState || result.transition.to !== result.newState))) {
    context.addIssue({ code: "custom", path: ["transition"], message: "Transition must match the official mastery states" });
  }
});

export const DueReviewAnswerSchema = z.strictObject({
  attemptId: uuid, responseChinese: TargetChineseTextSchema.max(10_000),
  evaluation: EvaluationResultSchema, coaching: PracticeCoachingSchema.nullable(),
  naturalVersion: TargetChineseTextSchema.max(10_000).nullable(), submittedAt: instant,
  result: DueCompletionReceiptSchema,
});
export const ReviewRevisionSchema = z.strictObject({
  id: uuid, requestId: uuid, attemptId: uuid, taskId: uuid,
  scenarioVersion: z.number().int().positive(), scenarioFingerprint: hash,
  responseChinese: TargetChineseTextSchema.max(10_000), evaluation: EvaluationResultSchema,
  coaching: PracticeCoachingSchema.nullable(), naturalVersion: TargetChineseTextSchema.max(10_000).nullable(),
  createdAt: instant,
});
export const DueReviewStateSchema = z.strictObject({
  reviewTaskId: uuid, identity: DueScenarioIdentitySchema,
  regenerated: z.boolean(), canRegenerate: z.boolean(), canRevise: z.boolean().optional(),
  expressionRevealedAt: instant.nullable(), examplesOpenedAt: instant.nullable(),
  firstAnswer: DueReviewAnswerSchema.nullable(), latestRevision: ReviewRevisionSchema.nullable(),
});

export const DueTransferSchema = z.strictObject({
  status: z.literal("ready"), id: uuid, reviewTaskId: uuid,
  targetExpression: TargetChineseTextSchema.max(10_000),
  promptChinese: TargetChineseTextSchema.max(2_000),
  instructionsEnglish: EnglishTextSchema.max(1_000), goalEnglish: EnglishTextSchema.max(1_000),
  material: PracticeMaterialViewSchema,
  scenarioVersion: z.number().int().positive(), scenarioFingerprint: hash,
  situationEn: z.string().nullable(), interlocutor: z.string().nullable(), taskEn: z.string(),
  targetFunction: FunctionCategorySchema.nullable(), targetSetting: UsageSettingSchema.nullable(),
  transferType: z.enum(["near", "far"]).nullable(),
  metadataMode: z.enum(["modern", "legacy"]), scenarioSource: z.enum(["model", "legacy"]),
  canRegenerate: z.boolean(), expressionRevealed: z.boolean(), reviewState: DueReviewStateSchema,
});
export const DuePreparationPendingSchema = z.strictObject({
  status: z.literal("preparing"), reviewTaskId: uuid, requestId: uuid,
  retryAfterMs: z.number().int().positive().max(10_000),
});
export const DueReviewGetResponseSchema = z.discriminatedUnion("status", [DueTransferSchema, DuePreparationPendingSchema]);
// Actual new server completions include reviewState. Optionality keeps the
// accepted original callback DTO and historical v4 result readers compatible.
export const DueCompletionSchema = DueCompletionReceiptSchema.extend({
  evaluation: EvaluationResultSchema, coaching: PracticeCoachingSchema.nullable(),
  reviewState: DueReviewStateSchema.optional(),
});
export const ReviewMarkerResponseSchema = z.strictObject({ reviewState: DueReviewStateSchema });
export const ReviewRevisionResponseSchema = z.strictObject({ revision: ReviewRevisionSchema, reviewState: DueReviewStateSchema });
export const ReviewOperationFailureDetailsSchema = z.object({
  operation: z.strictObject({
    kind: z.enum(["prepare", "regenerate", "complete", "revision"]), requestId: uuid,
    state: z.enum(["failed", "in_progress"]),
  }).optional(),
  current: DueTransferSchema.optional(), reviewState: DueReviewStateSchema.optional(),
});

export type DueScenarioIdentity = z.infer<typeof DueScenarioIdentitySchema>;
export type ReviewMutationInput = z.infer<typeof ReviewMutationInputSchema>;
export type ReviewCompletionInput = z.infer<typeof ReviewCompletionInputSchema>;
export type ReviewRevisionInput = z.infer<typeof ReviewRevisionInputSchema>;
export type DueCompletionReceipt = z.infer<typeof DueCompletionReceiptSchema>;
export type DueReviewAnswer = z.infer<typeof DueReviewAnswerSchema>;
export type ReviewRevision = z.infer<typeof ReviewRevisionSchema>;
export type DueReviewState = z.infer<typeof DueReviewStateSchema>;
export type DueTransfer = z.infer<typeof DueTransferSchema>;
export type DuePreparationPending = z.infer<typeof DuePreparationPendingSchema>;
export type DueReviewGetResponse = z.infer<typeof DueReviewGetResponseSchema>;
export type Completion = z.infer<typeof DueCompletionSchema>;
export type ReviewMarkerResponse = z.infer<typeof ReviewMarkerResponseSchema>;
export type ReviewRevisionResponse = z.infer<typeof ReviewRevisionResponseSchema>;
export type ReviewOperationFailureDetails = z.infer<typeof ReviewOperationFailureDetailsSchema>;
