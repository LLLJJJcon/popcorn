import { z } from "zod";
import { FunctionCategorySchema, UsageSettingSchema } from "./knowledge";

import {
  EnglishTextSchema,
  NativeLanguageSchema,
  TargetChineseTextSchema,
  TargetLanguageSchema,
} from "./source";

const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const PracticeSituationSchema = z.strictObject({
  situationZh: TargetChineseTextSchema.refine(text => [...text].length <= 120),
  situationEn: z.string().trim().min(1).refine(text => text.split(/\s+/u).length <= 60),
  interlocutor: z.string().trim().min(1).refine(text => [...text].length <= 10),
  taskEn: z.string().trim().min(1).refine(text => text.split(/\s+/u).length <= 30),
  targetFunction: FunctionCategorySchema,
  targetSetting: UsageSettingSchema,
});

export const PracticeTaskKindSchema = z.enum(["use_it_now", "due_practice"]);

const practiceTaskBase = {
  id: z.string().uuid(),
  userId: z.string().uuid(),
  userExpressionId: z.string().uuid(),
  nativeLanguage: NativeLanguageSchema,
  targetLanguage: TargetLanguageSchema,
  targetExpression: TargetChineseTextSchema.max(10_000),
  promptChinese: TargetChineseTextSchema.max(2_000),
  instructionsEnglish: EnglishTextSchema.max(1_000),
  goalEnglish: EnglishTextSchema.max(1_000),
  createdAt: IsoDateTimeSchema,
  situation: PracticeSituationSchema.nullable().optional(),
};

export const PracticeTaskSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...practiceTaskBase,
    kind: z.literal("use_it_now"),
    dueAt: z.null(),
  }),
  z.strictObject({
    ...practiceTaskBase,
    kind: z.literal("due_practice"),
    dueAt: IsoDateTimeSchema,
  }),
]);

export const AssistanceLevelSchema = z.enum(["none", "hint", "model_answer"]);

export const PracticeFeedbackTextSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => value.trim().length > 0, "Expected nonblank English feedback")
  .refine((value) => /[A-Za-z]/u.test(value), "Expected feedback containing English prose");

const EvaluationDimensionSchema = z.strictObject({
  score: z.number().int().min(1).max(5),
  englishFeedback: PracticeFeedbackTextSchema,
});

export const EvaluationResultSchema = z
  .strictObject({
    passed: z.boolean(),
    accuracy: EvaluationDimensionSchema,
    naturalness: EvaluationDimensionSchema,
    contextualFit: EvaluationDimensionSchema,
    independentUse: z.boolean(),
    assistanceLevel: AssistanceLevelSchema,
  })
  .refine((evaluation) => !evaluation.independentUse || evaluation.assistanceLevel === "none", {
    path: ["independentUse"],
    message: "Independent use requires assistanceLevel none",
  });

export const AttemptRecordedSchema = z.strictObject({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  practiceTaskId: z.string().uuid(),
  userExpressionId: z.string().uuid(),
  responseChinese: TargetChineseTextSchema.max(10_000),
  evaluation: EvaluationResultSchema,
  submittedAt: IsoDateTimeSchema,
  createdAt: IsoDateTimeSchema,
});

export const PracticeCoachingSchema = z.strictObject({
  naturalRevisionChinese: TargetChineseTextSchema.max(10_000),
});

export const PracticeAttemptResponseSchema = z.strictObject({
  attempt: AttemptRecordedSchema,
  coaching: PracticeCoachingSchema.nullable(),
  roundState: z.lazy(() => PracticeRoundStateSchema).optional(),
});

export const PracticeRoundStatusSchema = z.enum(["open", "retry_scheduled", "promoted", "superseded", "removed"]);
export const PracticeRoundAnswerSchema = z.strictObject({
  attemptId: z.string().uuid(), revision: z.number().int().positive(),
  text: TargetChineseTextSchema.max(10_000), evaluation: EvaluationResultSchema,
  naturalVersion: TargetChineseTextSchema.max(10_000).nullable(),
});
export const PracticeRoundStateSchema = z.strictObject({
  roundNumber: z.number().int().positive(), status: PracticeRoundStatusSchema,
  firstAnswer: PracticeRoundAnswerSchema.nullable(), latestRevision: PracticeRoundAnswerSchema.nullable(),
  examplesOpened: z.boolean(),
  promotion: z.strictObject({userExpressionId:z.string().uuid(),nextDueAt:IsoDateTimeSchema,removedFromVault:z.boolean().optional()}).nullable(),
  retryDueAt: IsoDateTimeSchema.nullable(),
});
export const PracticeActivationResponseSchema = z.union([
  PracticeTaskSchema,
  z.strictObject({redirect:z.string().regex(/^\/vault\/[0-9a-f-]{36}$/iu)}),
]);
export const PracticeNewRoundResponseSchema = z.strictObject({taskId:z.string().uuid(),roundNumber:z.number().int().positive()});
export const PracticeRemoveResponseSchema = z.strictObject({roundState:PracticeRoundStateSchema,undoUntil:IsoDateTimeSchema});
export const PracticeRestoreResponseSchema = z.strictObject({roundState:PracticeRoundStateSchema});
export const PracticeExamplesOpenedResponseSchema = z.strictObject({examplesOpened:z.literal(true)});
const conflictBase = {message:z.string().min(1),retryable:z.literal(false)};
export const PracticeConflictResponseSchema = z.union([
  z.strictObject({ok:z.literal(false),requestId:z.string().min(1),error:z.strictObject({
    ...conflictBase,code:z.literal("FIRST_ANSWER_EXISTS"),details:z.strictObject({roundState:PracticeRoundStateSchema}),
  })}),
  z.strictObject({ok:z.literal(false),requestId:z.string().min(1),error:z.strictObject({
    ...conflictBase,code:z.literal("ALREADY_PROMOTED"),details:z.strictObject({userExpressionId:z.string().uuid()}),
  })}),
]);

export type PracticeSituation = z.infer<typeof PracticeSituationSchema>;
export type PracticeRoundStatus = z.infer<typeof PracticeRoundStatusSchema>;
export type PracticeRoundAnswer = z.infer<typeof PracticeRoundAnswerSchema>;
export type PracticeRoundState = z.infer<typeof PracticeRoundStateSchema>;
export type PracticeActivationResponse = z.infer<typeof PracticeActivationResponseSchema>;

export type PracticeTaskKind = z.infer<typeof PracticeTaskKindSchema>;
export type PracticeTask = z.infer<typeof PracticeTaskSchema>;
export type AssistanceLevel = z.infer<typeof AssistanceLevelSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export type AttemptRecorded = z.infer<typeof AttemptRecordedSchema>;
export type PracticeCoaching = z.infer<typeof PracticeCoachingSchema>;
export type PracticeAttemptResponse = z.infer<typeof PracticeAttemptResponseSchema>;
