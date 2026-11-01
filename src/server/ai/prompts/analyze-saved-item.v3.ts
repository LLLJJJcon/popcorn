import { z } from "zod";
import { ANALYZE_BATCH_SIZE } from "@/server/domain/learning-config";
import { framePrompt, readFixturePromptData } from "./instruction-framing";
import { ModelGatewayError } from "@/server/ai/provider";
import type { StructuredJsonGateway } from "@/server/ai/structured-json-gateway";
import { FunctionCategorySchema, UsageSettingSchema, LearningCardFieldsSchema, type LearningCardFields } from "@/contracts/knowledge";
import type { WireDecodeResult } from "@/server/ai/model-output";
import type { AnalysisLine } from "./highlight-expressions.v1";

export const ANALYZE_MARKED_EXPRESSIONS_PROMPT_VERSION = "analyze-saved-item-v3";
export type MarkedAnalysisWire = { readonly cards: readonly Record<string, unknown>[] };
export function normalizeMarkedAnalysisWire(value: Record<string, unknown>): WireDecodeResult<MarkedAnalysisWire> {
  if (!Array.isArray(value.cards) || value.cards.length > ANALYZE_BATCH_SIZE || value.cards.some((card) => typeof card !== "object" || card === null || Array.isArray(card))) return { success: false, fieldPath: "cards" };
  return { success: true, data: { cards: value.cards as Record<string, unknown>[] } };
}

function validEnums<T extends z.ZodType<string>>(value: unknown, schema: T, limit: number): z.infer<T>[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((entry) => { const parsed = schema.safeParse(entry); return parsed.success ? [parsed.data] : []; }))].slice(0, limit) as z.infer<T>[];
}
export function normalizeLearningCard(value: unknown, expression: string, allowMissingExamples = false):
  | { readonly success: true; readonly data: LearningCardFields }
  | { readonly success: false; readonly examplesOnly?: boolean } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { success: false };
  const record = value as Record<string, unknown>;
  const categories = validEnums(record.functionCategories, FunctionCategorySchema, 2);
  const fields = {
    meaningHere: record.meaningHere, useItWhen: record.useItWhen, comparedWith: record.comparedWith,
    howItFits: record.howItFits, toneAndWho: record.toneAndWho, watchOut: record.watchOut ?? null,
    examples: record.examples,
    functionCategories: categories.length > 0 ? categories : ["other"],
    usageSettings: validEnums(record.usageSettings, UsageSettingSchema, 3),
    suitability: record.suitability, notExpressionReasonEn: record.notExpressionReasonEn ?? null,
  };
  const withoutExamples = LearningCardFieldsSchema.safeParse({ ...fields, examples: null });
  if (!withoutExamples.success) return { success: false };
  const parsed = LearningCardFieldsSchema.safeParse(fields);
  const validExamples = parsed.success && parsed.data.examples !== null &&
    parsed.data.examples.every((example) => example.zh.includes(expression)) &&
    parsed.data.examples[0].zh !== parsed.data.examples[1].zh;
  if (!validExamples) return allowMissingExamples ? { success: true, data: withoutExamples.data } : { success: false, examplesOnly: true };
  return { success: true, data: parsed.data };
}
export const ANALYZE_MARKED_EXPRESSIONS_TASK_INSTRUCTION = `[Learning cards] You write learning cards for an intermediate learner of Mandarin Chinese whose helper language is English. The learner has already chosen which expressions to learn by marking them. Never choose, replace, shorten or extend them. Write one card for every marked expression in "highlights", using its short id.

"lines" is the subtitle window around the saved moment. Lines with role "TARGET" contain the marked expressions; "context" lines only help you understand the meaning in this video.

Each card must help the learner use the expression naturally in new situations. Write every text field in clear, concise English that a learner can read quickly; embed Chinese only where it helps. Each text field is at most 40 words.

Fields:
- meaningHere: what the expression means in this specific line, not a general dictionary list. If it has several meanings, give only the one used here.
- useItWhen: the communicative situation and intention in which a speaker would choose it. Describe the intention ("when you want to ..."), not grammar.
- comparedWith: name one plain, common alternative in Chinese that a learner would most likely say instead, and state the difference in meaning, tone or strength.
- howItFits: how this exact form fits into a sentence: what usually comes before or after it, its position, and anything it must attach to. Explain only this form; do not turn it into a general pattern with placeholders.
- toneAndWho: the tone (e.g. casual, exaggerated, polite, sarcastic) and who or where it is natural with; say clearly if it is too strong or too casual for some situations.
- watchOut: one common mistake or misunderstanding learners make with it; null if there is no real pitfall. Do not invent one.
- examples: exactly two. Each has "zh" (natural Simplified Chinese, at most 30 characters, containing the marked expression exactly as given) and "en" (a natural English translation, at most 40 words). Use two different everyday situations, both different from the topic of these subtitle lines and from each other. Match the tone and usage settings you give.
- functionCategories: 1 or 2 communicative intentions it serves in this line, primary first, from: emphasize, complain, praise, react, explain_sum_up, concede_contrast, suggest, connect_ideas, describe, other. Add a second value only if the line clearly serves both.
- usageSettings: 1 to 3 settings where saying it is natural, from: casual_chat (friends, family, private messages), daily_errands (shops, restaurants, taxis, services), work_school (colleagues, managers, teachers, classmates, meetings), formal_writing (formal emails, reports, speeches, notices), online_social (posts, comments, group chats, bullet comments). List only settings where a native speaker would comfortably say it.
- suitability: "expression" if it is reusable language worth practising; "not_expression" if it is a name of a person, place, brand or work, a number, a basic word an intermediate learner already knows, or content only meaningful in this video. When not_expression, still fill every field honestly and give notExpressionReasonEn: one sentence of at most 40 words telling the learner why. Otherwise notExpressionReasonEn is null.

Output exactly one JSON object {"cards":[...]} with one card per supplied id, in the same order. Each card has: id, meaningHere, useItWhen, comparedWith, howItFits, toneAndWho, watchOut, examples, functionCategories, usageSettings, suitability, notExpressionReasonEn. Do not output the expression text, other IDs, source lines or timestamps.`;
export function buildAnalyzeMarkedExpressionsPrompt(input: {
  readonly lines: readonly AnalysisLine[];
  readonly highlights: readonly { readonly id: string; readonly text: string; readonly line?: number }[];
}) {
  const highlights = input.highlights.map(highlight => ({
    id: highlight.id, text: highlight.text,
    line: highlight.line ?? input.lines.find(line => line.role === "TARGET" && line.text.includes(highlight.text.split("\n")[0]!))?.line,
  }));
  return framePrompt(ANALYZE_MARKED_EXPRESSIONS_TASK_INSTRUCTION, { task: "learning_cards", lines: input.lines, highlights });
}
export function createAnalyzeMarkedExpressionsFixtureGateway(): StructuredJsonGateway {
  return {
    model: "fixture/analyze-saved-item-v3",
    async complete(_version, userPrompt, options) {
      const input = readFixturePromptData(userPrompt);
      const highlights = input.highlights as { id: string; text: string }[] | undefined;
      const output = { cards: (highlights ?? []).map(highlight => ({
        id: highlight.id,
        meaningHere: "The speaker uses this expression to make a point in this particular conversation.",
        useItWhen: "When you want to express your point in an everyday conversation.",
        comparedWith: "A plain description states the facts; this expression adds the speaker's personal attitude.",
        howItFits: "Keep the selected words together in the same order within your sentence.",
        toneAndWho: "Conversational; use it with friends or people you know well.",
        watchOut: null,
        examples: [{ zh: `${highlight.text}，真的。`, en: "Really, that is how it is." }, { zh: `今天也${highlight.text}。`, en: "Today it is like this too." }],
        functionCategories: ["other"], usageSettings: ["casual_chat"], suitability: "expression", notExpressionReasonEn: null,
      })) };
      const decoded = options.normalize(output);
      if (!decoded.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema", decoded.fieldPath);
      return decoded.data;
    },
  };
}
