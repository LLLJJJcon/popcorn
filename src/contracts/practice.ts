import { z } from "zod";

import {
  NativeLanguageSchema,
  TargetChineseTextSchema,
  TargetLanguageSchema,
} from "./source";

const IsoDateTimeSchema = z.string().datetime({ offset: true });
const EnglishTextSchema = z
  .string()
  .min(1)
  .max(5_000)
  .refine((value) => value.trim().length > 0, "Expected nonblank English text")
  .refine(
    (value) => /[A-Za-z]/.test(value) && !/\p{Script=Han}/u.test(value),
    "Expected English text",
  );

export const PracticeTaskKindSchema = z.enum(["use_it_now", "due_practice"]);

export const PracticeTaskSchema = z.strictObject({
  id: z.string().uuid(),
  userExpressionId: z.string().uuid(),
  kind: PracticeTaskKindSchema,
  nativeLanguage: NativeLanguageSchema,
  targetLanguage: TargetLanguageSchema,
  targetExpression: TargetChineseTextSchema.max(200),
  promptEnglish: EnglishTextSchema.max(1_000),
  contextEnglish: EnglishTextSchema.max(2_000),
  createdAt: IsoDateTimeSchema,
  dueAt: IsoDateTimeSchema.nullable(),
});

export const AssistanceLevelSchema = z.enum(["none", "hint", "model_answer"]);

export const EvaluationResultSchema = z.strictObject({
  passed: z.boolean(),
  score: z.number().finite().min(0).max(1),
  englishFeedback: EnglishTextSchema.max(2_000),
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
