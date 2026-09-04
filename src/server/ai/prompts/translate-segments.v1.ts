import { z } from "zod";

const StableId = z.string().regex(/^[a-f0-9]{64}$/);

export const TRANSLATE_SEGMENTS_PROMPT_VERSION = "translate-segments-v1";
export const TranslationContentSchema = z.strictObject({
  segments: z.array(z.strictObject({
    id: StableId,
    english: z.string().trim().min(1).max(4_000).refine((value) => !/[\u3400-\u9fff]/.test(value), "Expected English translation"),
  })).min(1),
});

export function buildTranslationPrompt(
  segments: readonly {
    readonly segmentIndex: number;
    readonly originalChinese: string;
    readonly startSeconds: number;
    readonly endSeconds: number;
  }[],
): string {
  return `Translate each complete Simplified Chinese segment into natural English for an English-speaking Mandarin learner. Preserve request-local segmentIndex order; never merge, split, omit, or reorder evidence. Return strict JSON only: {"translations":[{"segmentIndex":0,"english":"translation"}]}.\n${JSON.stringify(segments)}`;
}

export type TranslationContent = z.infer<typeof TranslationContentSchema>;
