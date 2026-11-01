import { z } from "zod";

import {
  EnglishTextSchema,
  NativeLanguageSchema,
  Sha256HashSchema,
  StableSegmentIdSchema,
  TargetChineseTextSchema,
  TargetLanguageSchema,
} from "./source";

const IsoDateTimeSchema = z.string().datetime({ offset: true });
const NonblankStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, "Expected a nonblank string");

export const GeneratedArtifactTypeSchema = z.enum([
  "overview",
  "chapters",
  "key_quotes",
  "segment_translation",
  "selection_explanation",
  "saved_item_analysis",
]);

export const GeneratedArtifactSchema = z.strictObject({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sourceId: z.string().uuid(),
  savedItemId: z.string().uuid().nullable(),
  type: GeneratedArtifactTypeSchema,
  nativeLanguage: NativeLanguageSchema,
  targetLanguage: TargetLanguageSchema,
  content: z.record(z.string(), z.unknown()),
  promptVersion: NonblankStringSchema.max(100),
  model: NonblankStringSchema.max(100),
  resultKey: Sha256HashSchema,
  createdAt: IsoDateTimeSchema,
});

export const KnowledgeJobStatusSchema = z.enum([
  "pending",
  "leased",
  "succeeded",
  "retryable_failed",
  "terminal_failed",
]);

export const KnowledgeJobTypeSchema = z.enum([
  "resolve_snapshot",
  "generate_overview",
  "translate_segments",
  "explain_selection",
  "analyze_saved_item",
  "highlight_saved_item",
]);

const knowledgeJobBase = {
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sourceId: z.string().uuid(),
  savedItemId: z.string().uuid().nullable(),
  type: KnowledgeJobTypeSchema,
  dedupeKey: Sha256HashSchema,
  attemptCount: z.number().int().min(0).max(20),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
};

export const KnowledgeJobSchema = z.discriminatedUnion("status", [
  z.strictObject({
    ...knowledgeJobBase,
    status: z.literal("pending"),
    nextAttemptAt: z.null(),
    leaseExpiresAt: z.null(),
    lastErrorCode: z.null(),
  }),
  z.strictObject({
    ...knowledgeJobBase,
    status: z.literal("leased"),
    nextAttemptAt: z.null(),
    leaseExpiresAt: IsoDateTimeSchema,
    lastErrorCode: z.null(),
  }),
  z.strictObject({
    ...knowledgeJobBase,
    status: z.literal("retryable_failed"),
    nextAttemptAt: IsoDateTimeSchema,
    leaseExpiresAt: z.null(),
    lastErrorCode: NonblankStringSchema.max(100),
  }),
  z.strictObject({
    ...knowledgeJobBase,
    status: z.literal("succeeded"),
    nextAttemptAt: z.null(),
    leaseExpiresAt: z.null(),
    lastErrorCode: z.null(),
  }),
  z.strictObject({
    ...knowledgeJobBase,
    status: z.literal("terminal_failed"),
    nextAttemptAt: z.null(),
    leaseExpiresAt: z.null(),
    lastErrorCode: NonblankStringSchema.max(100),
  }),
]);

export const FunctionCategorySchema = z.enum([
  "emphasize", "complain", "praise", "react", "explain_sum_up", "concede_contrast",
  "suggest", "connect_ideas", "describe", "other",
]);
export const UsageSettingSchema = z.enum([
  "casual_chat", "daily_errands", "work_school", "formal_writing", "online_social",
]);

/** English explanations may quote the Chinese form being explained. */
export const LearningCardTextSchema = z.string().trim().min(1).max(2_000)
  .refine((text) => /[A-Za-z]/u.test(text), "Expected English explanation")
  .refine((text) => text.split(/\s+/u).length <= 40, "At most 40 words");
export const LearningCardExampleSchema = z.strictObject({
  zh: TargetChineseTextSchema.refine((text) => [...text].length <= 30, "At most 30 characters"),
  en: LearningCardTextSchema,
});
export const LearningCardFieldsSchema = z.strictObject({
  meaningHere: LearningCardTextSchema,
  useItWhen: LearningCardTextSchema,
  comparedWith: LearningCardTextSchema,
  howItFits: LearningCardTextSchema,
  toneAndWho: LearningCardTextSchema,
  watchOut: LearningCardTextSchema.nullable(),
  examples: z.tuple([LearningCardExampleSchema, LearningCardExampleSchema]).nullable(),
  functionCategories: z.array(FunctionCategorySchema).min(1).max(2),
  usageSettings: z.array(UsageSettingSchema).max(3),
  suitability: z.enum(["expression", "not_expression"]),
  notExpressionReasonEn: LearningCardTextSchema.nullable().optional(),
}).refine((card) => card.suitability !== "not_expression" || Boolean(card.notExpressionReasonEn), {
  path: ["notExpressionReasonEn"], message: "Explain why this is not a reusable expression",
});

const CompatTextSchema = z.string().min(1).max(2_000).refine((text) => text.trim().length > 0);
export const CandidateExpressionSchema = z.strictObject({
  expression: TargetChineseTextSchema.max(10_000),
  englishMeaning: CompatTextSchema,
  englishExplanation: CompatTextSchema,
  tone: CompatTextSchema,
  communicativeFunction: CompatTextSchema,
  register: CompatTextSchema,
  evidenceText: TargetChineseTextSchema.max(10_000),
  segmentIds: z.array(StableSegmentIdSchema).min(1).max(32),
  startSeconds: z.number().finite().min(0).max(604_800),
  endSeconds: z.number().finite().min(0).max(604_800),
  confidence: z.number().finite().min(0).max(1),
  highlightId: z.string().uuid().optional(),
  highlightKey: z.string().min(1).max(30_000).optional(),
  meaningHere: LearningCardTextSchema.optional(),
  useItWhen: LearningCardTextSchema.optional(),
  comparedWith: LearningCardTextSchema.optional(),
  howItFits: LearningCardTextSchema.optional(),
  toneAndWho: LearningCardTextSchema.optional(),
  watchOut: LearningCardTextSchema.nullable().optional(),
  examples: z.tuple([LearningCardExampleSchema, LearningCardExampleSchema]).nullable().optional(),
  functionCategories: z.array(FunctionCategorySchema).min(1).max(2).optional(),
  usageSettings: z.array(UsageSettingSchema).max(3).optional(),
  suitability: z.enum(["expression", "not_expression"]).optional(),
  notExpressionReasonEn: LearningCardTextSchema.nullable().optional(),
}).superRefine((candidate, context) => {
  if (candidate.endSeconds < candidate.startSeconds) context.addIssue({ code: "custom", path: ["endSeconds"], message: "endSeconds must not precede startSeconds" });
  if (candidate.meaningHere !== undefined) {
    if (!LearningCardFieldsSchema.safeParse({
      meaningHere: candidate.meaningHere, useItWhen: candidate.useItWhen,
      comparedWith: candidate.comparedWith, howItFits: candidate.howItFits,
      toneAndWho: candidate.toneAndWho, watchOut: candidate.watchOut, examples: candidate.examples,
      functionCategories: candidate.functionCategories, usageSettings: candidate.usageSettings,
      suitability: candidate.suitability, notExpressionReasonEn: candidate.notExpressionReasonEn,
    }).success) context.addIssue({ code: "custom", path: ["meaningHere"], message: "Invalid learning card" });
  } else {
    if (candidate.evidenceText.length > 2_000) context.addIssue({ code: "custom", path: ["evidenceText"], message: "Legacy evidence exceeds 2000 characters" });
    if (candidate.expression.length > 200) context.addIssue({ code: "custom", path: ["expression"], message: "Legacy expression exceeds 200 characters" });
    for (const [key, limit] of [["englishMeaning", 500], ["englishExplanation", 2_000], ["tone", 200], ["communicativeFunction", 300], ["register", 200]] as const) {
      if (!EnglishTextSchema.max(limit).safeParse(candidate[key]).success) context.addIssue({ code: "custom", path: [key], message: "Invalid legacy English field" });
    }
  }
});

// A saved moment can have any number of user marks; all-failed analyses are still readable.
export const CandidateExpressionListSchema = z.array(CandidateExpressionSchema)
  .refine((candidates) => candidates.length <= 3 || candidates.some((candidate) => candidate.meaningHere !== undefined), "Legacy analyses contain at most three candidates");
export const HighlightAnalysisStateSchema = z.strictObject({
  highlightId: z.string().uuid(), text: z.string(), status: z.enum(["pending", "ready", "failed"]),
});
export type LearningCardFields = z.infer<typeof LearningCardFieldsSchema>;
export type HighlightAnalysisState = z.infer<typeof HighlightAnalysisStateSchema>;

export type GeneratedArtifact = z.infer<typeof GeneratedArtifactSchema>;
export type KnowledgeJobStatus = z.infer<typeof KnowledgeJobStatusSchema>;
export type KnowledgeJobType = z.infer<typeof KnowledgeJobTypeSchema>;
export type KnowledgeJob = z.infer<typeof KnowledgeJobSchema>;
export type CandidateExpression = z.infer<typeof CandidateExpressionSchema>;
