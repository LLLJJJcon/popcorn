import { framePrompt } from './instruction-framing';
import { HIGHLIGHT_EXPRESSIONS_TASK_INSTRUCTION as V1_TASK_INSTRUCTION, type AnalysisLine } from './highlight-expressions.v1';

export { normalizeHighlightExpressionsWire, type AnalysisLine } from './highlight-expressions.v1';

export const HIGHLIGHT_EXPRESSIONS_PROMPT_VERSION = 'highlight-expressions-v2';

export const HIGHLIGHT_EXPRESSIONS_TASK_INSTRUCTION = `${V1_TASK_INSTRUCTION}

Hard source constraints, checked before returning any highlight:
- Every text must be an exact contiguous substring of ONE TARGET line, copied character for character with its original spelling and script.
- Never delete intervening words, names, brands, particles, spaces or punctuation to join separated parts into an expression. Never paraphrase, complete an idiom, or convert traditional/simplified characters.
- Example: in "走Nike的回頭路", "走回頭路" is INVALID because it removes "Nike的". "回頭路" is a valid literal span if it is worth learning on its own. Do not include the brand just to make a longer span.
- If the full reusable expression is interrupted by sentence-specific material, select a shorter contiguous span only if that span remains meaningful for active use. Otherwise omit it.
- Check that the exact text can be found in the TARGET line before emitting it. Context lines and examples in these instructions are never eligible source text.
- If no valid worthwhile span survives these checks, return {"highlights":[]}. Do not invent a span to avoid an empty list.`;

export function buildHighlightExpressionsPrompt(input: { readonly lines: readonly AnalysisLine[] }) {
  return framePrompt(HIGHLIGHT_EXPRESSIONS_TASK_INSTRUCTION, { task: 'highlight', lines: input.lines });
}
