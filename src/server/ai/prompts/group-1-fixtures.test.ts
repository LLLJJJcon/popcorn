import { expect, test } from "vitest";
import * as highlight from "./highlight-expressions.v1";
import * as analyze from "./analyze-saved-item.v3";
import type { StructuredJsonGateway } from "../structured-json-gateway";

test("highlight fixture takes characters three through six only from the first target line", async () => {
  expect(highlight).toHaveProperty("createHighlightExpressionsFixtureGateway");
  const factory = (highlight as unknown as { createHighlightExpressionsFixtureGateway: () => StructuredJsonGateway }).createHighlightExpressionsFixtureGateway;
  const gateway = factory();
  const prompt = highlight.buildHighlightExpressionsPrompt({ lines: [{ line: 1, role: "context", text: "高得要命" }, { line: 2, role: "TARGET", text: "今天气温高得要命" }] });
  const result = await gateway.complete(highlight.HIGHLIGHT_EXPRESSIONS_PROMPT_VERSION, prompt.userPrompt, { systemPrompt: prompt.systemPrompt, timeoutMs: 20000, maxTokens: 350, normalize: highlight.normalizeHighlightExpressionsWire });
  expect(result).toEqual({ highlights: [{ text: "气温高得", occurrence: 1, reasonEn: "Fixture highlight." }] });
  expect(JSON.parse(prompt.userPrompt.split("\n")[0]!).task).toBe("highlight");
});

test("learning card fixture preserves supplied IDs and the prescribed examples", async () => {
  expect(analyze).toHaveProperty("createAnalyzeMarkedExpressionsFixtureGateway");
  const factory = (analyze as unknown as { createAnalyzeMarkedExpressionsFixtureGateway: () => StructuredJsonGateway }).createAnalyzeMarkedExpressionsFixtureGateway;
  const prompt = analyze.buildAnalyzeMarkedExpressionsPrompt({ lines: [{ line: 1, role: "TARGET", text: "说白了，就是没钱" }], highlights: [{ id: "h1", text: "说白了" }] });
  const result = await factory().complete(analyze.ANALYZE_MARKED_EXPRESSIONS_PROMPT_VERSION, prompt.userPrompt, { systemPrompt: prompt.systemPrompt, timeoutMs: 30000, maxTokens: 600, normalize: analyze.normalizeMarkedAnalysisWire });
  expect(result.cards[0]).toMatchObject({ id: "h1", examples: [{ zh: "说白了，真的。" }, { zh: "今天也说白了。" }], functionCategories: ["other"], usageSettings: ["casual_chat"], suitability: "expression" });
  expect(analyze.normalizeLearningCard(result.cards[0], "说白了").success).toBe(true);
});
