import { z } from "zod";

const English = z.string().trim().min(1).max(2_000).refine(
  (value) => !/[\u3400-\u9fff]/.test(value),
  "Expected English explanation",
);

export const EXPLAIN_SELECTION_PROMPT_VERSION = "explain-selection-v1";
export const ExplanationContentSchema = z.strictObject({
  selectedChinese: z.string().trim().min(1).max(2_000),
  meaning: English,
  tone: English.max(500),
  communicativeFunction: English.max(1_000),
  contextualFit: English,
});

export function buildExplanationPrompt(input: {
  readonly selectedChinese: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly context: string;
}): string {
  return `Explain the exact selected Simplified Chinese in English. Cover meaning, tone, communicative function, and why it fits this context. Do not replace or rewrite the original Chinese evidence. Return strict JSON only.\nEvidence:\n${JSON.stringify(input)}`;
}

export type ExplanationContent = z.infer<typeof ExplanationContentSchema>;
