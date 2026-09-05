import { z } from "zod";

import { MasteryStateSchema } from "@/contracts/memory";
import {
  EnglishTextSchema,
  NativeLanguageSchema,
  TargetChineseTextSchema,
  TargetLanguageSchema,
} from "@/contracts/source";

const IsoDateTimeSchema = z.string().datetime({ offset: true });

const publicTaskBase = {
  id: z.string().uuid(),
  userExpressionId: z.string().uuid(),
  nativeLanguage: NativeLanguageSchema,
  targetLanguage: TargetLanguageSchema,
  targetExpression: TargetChineseTextSchema.max(200),
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
    evidenceText: TargetChineseTextSchema.max(2_000),
    startSeconds: z.number().finite().min(0).max(604_800),
  }),
  expression: z.strictObject({
    englishMeaning: EnglishTextSchema.max(500),
    englishExplanation: EnglishTextSchema.max(2_000),
    tone: EnglishTextSchema.max(200),
    communicativeFunction: EnglishTextSchema.max(300),
    register: EnglishTextSchema.max(200),
  }),
});

export type PracticeMaterialTask = z.infer<typeof PracticeMaterialTaskSchema>;
export type PracticeMaterialView = z.infer<typeof PracticeMaterialViewSchema>;
