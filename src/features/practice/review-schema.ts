import { z } from "zod";
import { MasteryStateSchema } from "@/contracts/memory";
import { EvaluationResultSchema, PracticeCoachingSchema } from "@/contracts/practice";
import { EnglishTextSchema, TargetChineseTextSchema } from "@/contracts/source";
import { PracticeMaterialViewSchema } from "./material-schema";
const UuidSchema = z.string().uuid();
const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const DueTransferSchema = z.strictObject({
  id: UuidSchema,
  reviewTaskId: UuidSchema,
  targetExpression: TargetChineseTextSchema.max(10000),
  promptChinese: TargetChineseTextSchema.max(2000),
  instructionsEnglish: EnglishTextSchema.max(1000),
  goalEnglish: EnglishTextSchema.max(1000),
  material: PracticeMaterialViewSchema,
});
const TransitionSchema = z.strictObject({ from: MasteryStateSchema, to: MasteryStateSchema });
export const DueCompletionSchema = z.strictObject({
  reviewTaskId: UuidSchema,
  practiceTaskId: UuidSchema,
  attemptId: UuidSchema,
  masteryEventId: UuidSchema,
  nextReviewTaskId: UuidSchema,
  priorState: MasteryStateSchema,
  newState: MasteryStateSchema,
  nextDueAt: IsoDateTimeSchema,
  intervalDays: z.number().int().min(1).max(365),
  created: z.boolean(),
  transition: TransitionSchema.nullable(),
  evaluation: EvaluationResultSchema,
  coaching: PracticeCoachingSchema.nullable(),
}).superRefine((result, context) => {
  const changed = result.priorState !== result.newState;
  if (changed !== (result.transition !== null)) {
    context.addIssue({ code: "custom", path: ["transition"], message: "Transition must describe a mastery change" });
  }
  if (result.transition && (result.transition.from !== result.priorState || result.transition.to !== result.newState)) {
    context.addIssue({ code: "custom", path: ["transition"], message: "Transition must match mastery states" });
  }
});
export type Completion = z.infer<typeof DueCompletionSchema>;
