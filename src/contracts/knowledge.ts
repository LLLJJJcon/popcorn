import { z } from "zod";

import {
  EnglishTextSchema,
  NativeLanguageSchema,
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
  sourceId: z.string().uuid(),
  savedItemId: z.string().uuid().nullable(),
  type: GeneratedArtifactTypeSchema,
  nativeLanguage: NativeLanguageSchema,
  targetLanguage: TargetLanguageSchema,
  content: z.record(z.string(), z.unknown()),
  promptVersion: NonblankStringSchema.max(100),
  model: NonblankStringSchema.max(100),
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
]);

export const KnowledgeJobSchema = z.strictObject({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sourceId: z.string().uuid(),
  savedItemId: z.string().uuid().nullable(),
  type: KnowledgeJobTypeSchema,
  status: KnowledgeJobStatusSchema,
  attemptCount: z.number().int().min(0).max(20),
  nextAttemptAt: IsoDateTimeSchema.nullable(),
  leaseExpiresAt: IsoDateTimeSchema.nullable(),
  lastErrorCode: NonblankStringSchema.max(100).nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const CandidateExpressionSchema = z
  .strictObject({
    expression: TargetChineseTextSchema.max(200),
    englishMeaning: EnglishTextSchema.max(500),
    englishExplanation: EnglishTextSchema.max(2_000),
    tone: EnglishTextSchema.max(200),
    communicativeFunction: EnglishTextSchema.max(300),
    register: EnglishTextSchema.max(200),
    evidenceText: TargetChineseTextSchema.max(2_000),
    segmentIds: z.array(StableSegmentIdSchema).min(1).max(32),
    startSeconds: z.number().finite().min(0).max(604_800),
    endSeconds: z.number().finite().min(0).max(604_800),
    confidence: z.number().finite().min(0).max(1),
  })
  .refine((candidate) => candidate.endSeconds >= candidate.startSeconds, {
    path: ["endSeconds"],
    message: "endSeconds must not precede startSeconds",
  });

export const CandidateExpressionListSchema = z.array(CandidateExpressionSchema).min(1).max(3);

export type GeneratedArtifact = z.infer<typeof GeneratedArtifactSchema>;
export type KnowledgeJobStatus = z.infer<typeof KnowledgeJobStatusSchema>;
export type KnowledgeJobType = z.infer<typeof KnowledgeJobTypeSchema>;
export type KnowledgeJob = z.infer<typeof KnowledgeJobSchema>;
export type CandidateExpression = z.infer<typeof CandidateExpressionSchema>;
