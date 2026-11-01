/** Output ceilings, excluding input tokens. Call sites choose by task size. */
// Apply 20% headroom once to the final task budget; token counts must be integers.
function withOutputHeadroom(tokens: number): number {
  return Math.ceil(tokens * 1.2);
}

export const MAX_MODEL_OUTPUT_TOKENS = withOutputHeadroom(8_192);

export const MODEL_OUTPUT_TOKENS = {
  highlightExpressions: withOutputHeadroom(512),
  activatePractice: withOutputHeadroom(512),
  evaluatePractice: withOutputHeadroom(1_536),
  // Section8.6 specifies this exact completion budget, without headroom.
  transferScenario: 400,
  explainSelection: withOutputHeadroom(1_024),
  savedItemAnalysis: withOutputHeadroom(2_048),
  youtubeOverview: withOutputHeadroom(4_096),
} as const;

/** Up to five bilingual cards, with per-card room for every field and examples. */
export function learningCardOutputTokens(cardCount: number): number {
  return Math.min(MAX_MODEL_OUTPUT_TOKENS, withOutputHeadroom(512 + 1_536 * cardCount));
}

/** Up to 32 translations; reserve JSON overhead as well as each English line. */
export function translationOutputTokens(lineCount: number): number {
  return Math.min(MAX_MODEL_OUTPUT_TOKENS, withOutputHeadroom(Math.max(1_024, 256 + 240 * lineCount)));
}
