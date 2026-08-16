import { z } from "zod";

import {
  EnglishTextSchema,
  NativeLanguageSchema,
  TargetChineseTextSchema,
  TargetLanguageSchema,
} from "./source";

const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const PracticeTaskKindSchema = z.enum(["use_it_now", "due_practice"]);

export const PracticeTaskSchema = z.strictObject({
  id: z.string().uuid(),
  userExpressionId: z.string().uuid(),
  kind: PracticeTaskKindSchema,
  nativeLanguage: NativeLanguageSchema,
  targetLanguage: TargetLanguageSchema,
  targetExpression: TargetChineseTextSchema.max(200),
  promptChinese: TargetChineseTextSchema.max(2_000),
  instructionsEnglish: EnglishTextSchema.max(1_000),
  goalEnglish: EnglishTextSchema.max(1_000),
  createdAt: IsoDateTimeSchema,
  dueAt: IsoDateTimeSchema.nullable(),
});

export const AssistanceLevelSchema = z.enum(["none", "hint", "model_answer"]);

const EvaluationDimensionSchema = z.strictObject({
  score: z.number().int().min(1).max(5),
  englishFeedback: EnglishTextSchema.max(2_000),
});

export const EvaluationResultSchema = z.strictObject({
  passed: z.boolean(),
  accuracy: EvaluationDimensionSchema,
  naturalness: EvaluationDimensionSchema,
  contextualFit: EvaluationDimensionSchema,
  independentUse: z.boolean(),
  assistanceLevel: AssistanceLevelSchema,
});

export const AttemptRecordedSchema = z.strictObject({
  id: z.string().uuid(),
  practiceTaskId: z.string().uuid(),
  userExpressionId: z.string().uuid(),
  responseChinese: TargetChineseTextSchema.max(5_000),
  evaluation: EvaluationResultSchema,
  submittedAt: IsoDateTimeSchema,
});

export type PracticeTaskKind = z.infer<typeof PracticeTaskKindSchema>;
export type PracticeTask = z.infer<typeof PracticeTaskSchema>;
export type AssistanceLevel = z.infer<typeof AssistanceLevelSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export type AttemptRecorded = z.infer<typeof AttemptRecordedSchema>;
