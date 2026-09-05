import { z } from "zod";

const StableId = z.string().regex(/^[a-f0-9]{64}$/);
const English = z.string().trim().min(1).max(4_000).refine(
  (value) => !/[\u3400-\u9fff]/.test(value),
  "Expected English output",
);

export const YOUTUBE_OVERVIEW_PROMPT_VERSION = "youtube-overview-v2";
const MAX_ROWS_PER_BLOCK = 24;
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
  readonly segmentIndex: number;
  readonly originalChinese: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
};

export type OverviewPromptBlock = {
  readonly blockIndex: number;
  readonly segmentIndexes: readonly number[];
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly originalChinese: string;
};

export function groupOverviewPromptBlocks(
  segments: readonly OverviewPromptSegment[],
): OverviewPromptBlock[] {
  const blocks: OverviewPromptBlock[] = [];
  for (let offset = 0; offset < segments.length; offset += MAX_ROWS_PER_BLOCK) {
    const rows = segments.slice(offset, offset + MAX_ROWS_PER_BLOCK);
    const first = rows[0];
    const last = rows.at(-1);
    if (!first || !last) continue;
    blocks.push({
      blockIndex: blocks.length,
      segmentIndexes: rows.map((row) => row.segmentIndex),
      startSeconds: first.startSeconds,
      endSeconds: last.endSeconds,
      originalChinese: rows.map((row) => row.originalChinese).join("\n"),
    });
  }
  return blocks;
}

function compactTime(seconds: number): string {
  return Number.isInteger(seconds) ? String(seconds) : String(Number(seconds.toFixed(3)));
}

export function buildOverviewPrompt(title: string, blocks: readonly OverviewPromptBlock[]): string {
  const evidence = blocks.map((block) =>
    `#${block.blockIndex} ${compactTime(block.startSeconds)}-${compactTime(block.endSeconds)}\n${block.originalChinese}`,
  ).join("\n\n");
  return `Create a complete, content-focused English overview for an English-speaking Mandarin learner. Preserve the original Simplified Chinese in key quotes. Cover the whole video with timestamp-grounded chapters and 3-5 key quotes. Each chapter and key quote must return exactly one sourceBlockIndex, referring only to the request-local # block that supports it. Return strict JSON only with sourceBlockIndex.\nTitle: ${title}\nNative transcript blocks:\n${evidence}`;
}

export type OverviewContent = z.infer<typeof OverviewContentSchema>;
