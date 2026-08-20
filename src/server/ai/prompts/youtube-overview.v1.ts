import { z } from "zod";

const StableId = z.string().regex(/^[a-f0-9]{64}$/);
const English = z.string().trim().min(1).max(4_000).refine(
  (value) => !/[\u3400-\u9fff]/.test(value),
  "Expected English output",
);

export const YOUTUBE_OVERVIEW_PROMPT_VERSION = "youtube-overview-v1";
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

export function buildOverviewPrompt(
  title: string,
  segments: readonly {
    readonly segmentIndex: number;
    readonly originalChinese: string;
    readonly startSeconds: number;
    readonly endSeconds: number;
  }[],
): string {
  return `Create a complete, content-focused English overview for an English-speaking Mandarin learner. Preserve the original Simplified Chinese in key quotes. Cover the whole video with timestamp-grounded chapters and 3-5 key quotes. Refer to evidence only by its request-local segmentIndex. Return strict JSON only with sourceSegmentIndexes arrays.\nTitle: ${title}\nNative transcript evidence:\n${JSON.stringify(segments)}`;
}

export type OverviewContent = z.infer<typeof OverviewContentSchema>;
