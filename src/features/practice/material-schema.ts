import { z } from "zod";

import { MasteryStateSchema } from "@/contracts/memory";
import {
  EnglishTextSchema,
  NativeLanguageSchema,
  TargetChineseTextSchema,
  TargetLanguageSchema,
} from "@/contracts/source";

const IsoDateTimeSchema = z.string().datetime({ offset: true });
// Learning-card explanations are English prose that can quote Chinese words.
const LearningExplanationSchema = z.string().trim().min(1).max(2_000)
  .refine((value) => /[A-Za-z]/u.test(value), "Expected English learning prose");

const publicTaskBase = {
  id: z.string().uuid(),
  userExpressionId: z.string().uuid(),
  nativeLanguage: NativeLanguageSchema,
  targetLanguage: TargetLanguageSchema,
  targetExpression: TargetChineseTextSchema.max(10_000),
  promptChinese: TargetChineseTextSchema.max(2_000),
  instructionsEnglish: EnglishTextSchema.max(1_000),
  goalEnglish: EnglishTextSchema.max(1_000),
  createdAt: IsoDateTimeSchema,
};

export const PracticeMaterialTaskSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...publicTaskBase, kind: z.literal("use_it_now"), dueAt: z.null() }),
  z.strictObject({ ...publicTaskBase, kind: z.literal("due_practice"), dueAt: IsoDateTimeSchema }),
]);

export const PracticeMaterialViewSchema = z.strictObject({
  task: PracticeMaterialTaskSchema,
  masteryState: MasteryStateSchema,
  source: z.strictObject({
    videoTitle: z.string().min(1).max(300),
    youtubeUrl: z.string().url().max(240),
    evidenceText: TargetChineseTextSchema.max(10_000),
    startSeconds: z.number().finite().min(0).max(604_800),
  }),
  expression: z.strictObject({
    englishMeaning: LearningExplanationSchema,
    englishExplanation: LearningExplanationSchema,
    tone: LearningExplanationSchema,
    communicativeFunction: LearningExplanationSchema,
    register: LearningExplanationSchema,
  }),
});

export type PracticeMaterialTask = z.infer<typeof PracticeMaterialTaskSchema>;
export type PracticeMaterialView = z.infer<typeof PracticeMaterialViewSchema>;
