import { z } from "zod";

const StableId = z.string().regex(/^[a-f0-9]{64}$/);
const English = z.string().trim().min(1).max(4_000).refine(
  (value) => !/[\u3400-\u9fff]/.test(value),
  "Expected English output",
);

export const YOUTUBE_OVERVIEW_PROMPT_VERSION = "youtube-overview-v3";
export const OverviewContentSchema = z.strictObject({
  overview: English,
  chapters: z.array(z.strictObject({
    title: English.max(200),
    summary: English.max(1_000),
    timestampSeconds: z.number().finite().min(0).max(604_800),
    sourceSegmentIds: z.array(StableId).min(1).max(32),
  })).min(1).max(100),
  keyQuotes: z.array(z.strictObject({
    quote: z.string().trim().min(1).max(2_000).refine((value) => /[\u3400-\u9fff]/.test(value), "Expected native Chinese quote"),
    englishMeaning: English.max(1_000),
    timestampSeconds: z.number().finite().min(0).max(604_800),
    sourceSegmentIds: z.array(StableId).min(1).max(32),
  })).min(3).max(5),
});

type OverviewPromptSegment = {
  readonly originalChinese: string;
};

export function buildOverviewPrompt(
  title: string,
  segments: readonly OverviewPromptSegment[],
): string {
  const evidence = segments
    .map((segment, sourceLineIndex) => `${sourceLineIndex} ${segment.originalChinese}`)
    .join("\n");
  return `Create a concise, content-focused English overview for an English-speaking Mandarin learner. Cover the whole video with 1-8 chapters appropriate to the material and exactly 3-5 key quotes. Preserve the original Simplified Chinese in each key quote, and make every quote an exact substring of its anchored transcript line. Each chapter and key quote must return exactly one sourceLineIndex referring to the supporting global transcript line. Return strict JSON only; do not return timestamps, block indexes, IDs, or metadata.\nTitle: ${title}\nNative transcript lines:\n${evidence}`;
}

export type OverviewContent = z.infer<typeof OverviewContentSchema>;
