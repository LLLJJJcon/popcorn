import { z } from "zod";
import { framePrompt, readFixturePromptData } from "./instruction-framing";
import { ModelGatewayError } from "@/server/ai/provider";
import type { StructuredJsonGateway } from "@/server/ai/structured-json-gateway";
import type { WireDecodeResult } from "@/server/ai/model-output";

export const HIGHLIGHT_EXPRESSIONS_PROMPT_VERSION = "highlight-expressions-v1";
export type AnalysisLine = { readonly line: number; readonly role: "TARGET" | "context"; readonly text: string };
export type HighlightExpressionsWire = { readonly highlights: readonly { readonly text: string; readonly occurrence: number; readonly reasonEn?: string }[] };
const HighlightWireSchema = z.object({
  text: z.string().min(1).max(10_000), occurrence: z.number().int().positive().default(1),
  reasonEn: z.string().trim().min(1).refine((text) => text.split(/\s+/u).length <= 40).optional(),
});
export function normalizeHighlightExpressionsWire(value: Record<string, unknown>): WireDecodeResult<HighlightExpressionsWire> {
  const parsed = z.object({ highlights: z.array(HighlightWireSchema) }).safeParse(value);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, fieldPath: "highlights" };
}
export const HIGHLIGHT_EXPRESSIONS_TASK_INSTRUCTION = `[Highlight] You help an intermediate learner of Mandarin Chinese whose helper language is English. The learner saved a line from a Chinese video because it seemed worth learning. Their goal is to actively use natural, authentic expressions in new situations of their own.

Input: "lines" is a short window of subtitle lines. Lines with role "TARGET" are what the learner saved. Lines with role "context" only help you understand the meaning; never pick from them.

Task: pick 0 to 2 spans from the TARGET line(s) that are most worth learning for active use.

Prefer, in this order:
1. Colloquial or idiomatic phrases whose meaning or tone is not obvious from the individual words (e.g. 高得要命, 说白了, 有两把刷子).
2. Fixed collocations or chunks a learner can reuse as a unit (e.g. 打交道, 说到底).
3. Degree, attitude or stance markers (e.g. 简直, 难怪, 偏偏).
4. Discourse markers that organise speech (e.g. 话虽如此, 怎么说呢).

Do not pick:
- names of people, places, brands, works or organisations; numbers, dates or prices;
- basic words an intermediate learner already knows (e.g. 我们, 很, 喜欢, 今天);
- terms that are only meaningful inside this video's topic;
- a whole line, or a whole clause that is just a plain statement;
- a span that crosses two lines.

Span boundaries: copy the span exactly as it appears in one TARGET line. Include what is needed for it to be reusable (高得要命, not 要命 alone), but leave out sentence-specific words around it (not 房价高得要命).

Return an empty list when nothing in the TARGET line is worth learning. Returning nothing is better than returning a weak span.

For each span give reasonEn: one plain English sentence of at most 25 words telling the learner why it is worth learning. Write for the learner, not for a linguist.

occurrence: if the same text appears more than once in that TARGET line, the 1-based occurrence you mean; otherwise 1.

Output exactly: {"highlights":[{"text":"高得要命","occurrence":1,"reasonEn":"A casual way to complain that something is far too much."}]}
Do not output IDs, offsets, line numbers or timestamps.`;
export function buildHighlightExpressionsPrompt(input: { readonly lines: readonly AnalysisLine[] }) {
  return framePrompt(HIGHLIGHT_EXPRESSIONS_TASK_INSTRUCTION, { task: "highlight", lines: input.lines });
}
export function createHighlightExpressionsFixtureGateway(): StructuredJsonGateway {
  return {
    model: "fixture/highlight-expressions-v1",
    async complete(_version, userPrompt, options) {
      const input = readFixturePromptData(userPrompt);
      const lines = input.lines as AnalysisLine[] | undefined;
      const characters = [...(lines?.find(line => line.role === "TARGET")?.text ?? "")];
      const output = { highlights: characters.length >= 6
        ? [{ text: characters.slice(2, 6).join(""), occurrence: 1, reasonEn: "Fixture highlight." }]
        : [] };
      const decoded = options.normalize(output);
      if (!decoded.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema", decoded.fieldPath);
      return decoded.data;
    },
  };
}
