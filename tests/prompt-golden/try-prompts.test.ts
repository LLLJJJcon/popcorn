import { describe, expect, it, vi } from "vitest";
import { MODEL_OUTPUT_TOKENS, learningCardOutputTokens } from "../../src/server/ai/output-budgets";
import { compareGolden, derivePromptTrialEnvironment, goldenCases, parsePromptArguments, renderTrial, runGoldenTrial } from "../../scripts/try-prompts";
import { createHighlightExpressionsFixtureGateway } from "../../src/server/ai/prompts/highlight-expressions.v1";
import { createAnalyzeMarkedExpressionsFixtureGateway } from "../../src/server/ai/prompts/analyze-saved-item.v3";

describe("opt-in golden trial tooling", () => {
  it.each([
    ["highlight-expressions-v1", MODEL_OUTPUT_TOKENS.highlightExpressions],
    ["analyze-saved-item-v3", learningCardOutputTokens(1)],
    ["activate-practice-v3", MODEL_OUTPUT_TOKENS.activatePractice],
    ["evaluate-practice-v5", MODEL_OUTPUT_TOKENS.evaluatePractice],
  ] as const)("uses the current shared %s output budget with exactly one selected trial call", async (version, maxTokens) => {
    const complete = vi.fn(async () => ({}));
    await runGoldenTrial(version, goldenCases(version)[0], { model: "fixture/budget-boundary", complete } as never);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(version, expect.any(String), expect.objectContaining({ maxTokens }));
  });
  it("requires an explicit real-call flag and exact owner before any configuration/network work", () => {
    expect(() => parsePromptArguments(["highlight-expressions-v1"])).toThrow();
    expect(() => parsePromptArguments(["highlight-expressions-v1", "--real"])).toThrow();
    expect(() => parsePromptArguments(["highlight-expressions-v1", "--real", "--user", "email@example.com"])).toThrow();
    expect(() => parsePromptArguments(["unsupported", "--real", "--user", "10000000-0000-4000-8000-000000000001"])).toThrow();
    const parsed = parsePromptArguments(["--", "highlight-expressions-v1", "--real", "--user", "10000000-0000-4000-8000-000000000001", "--case", "highlight-3"]);
    expect(parsed.selected.map(sample => sample.id)).toEqual(["highlight-3"]);
  });
  it("reuses launcher proxy validation and preserves local database bypass", () => {
    expect(derivePromptTrialEnvironment({ PATH: "bin" })).toEqual({ PATH: "bin" });
    expect(derivePromptTrialEnvironment({ POPCORN_PROXY_URL: "http://127.0.0.1:7890", NO_PROXY: "example.com" })).toMatchObject({
      HTTP_PROXY: "http://127.0.0.1:7890", HTTPS_PROXY: "http://127.0.0.1:7890", NODE_USE_ENV_PROXY: "1",
      NO_PROXY: "example.com, 127.0.0.1, localhost, ::1",
    });
    for (const proxy of ["http://user:secret@proxy.test", "http://proxy.test/path", "http://proxy.test?key=secret", "socks5://proxy.test", "http://proxy.test secret"]) {
      expect(() => derivePromptTrialEnvironment({ POPCORN_PROXY_URL: proxy })).toThrow("exact HTTP(S) proxy origin");
    }
  });
  it("reports semantic expectation misses instead of pretending fixtures prove model quality", async () => {
    const sample = goldenCases("highlight-expressions-v1")[0];
    const result = await runGoldenTrial("highlight-expressions-v1", sample, createHighlightExpressionsFixtureGateway());
    expect(result.comparison.checks.find(check => check.label === "includes 高得要命")?.passed).toBe(false);
    expect(result.comparison.manualReview.join(" ")).toContain("not semantic acceptance");
    const basic = goldenCases("analyze-saved-item-v3")[2];
    const cards = await runGoldenTrial("analyze-saved-item-v3", basic, createAnalyzeMarkedExpressionsFixtureGateway());
    expect(cards.comparison.checks.find(check => check.label === "card 1: suitability")?.passed).toBe(false);
  });
  it("rejects wrong occurrences, context-only marks and reordered/missing cards in comparisons", () => {
    const sample = goldenCases("highlight-expressions-v1")[5];
    const result = compareGolden("highlight-expressions-v1", sample, { highlights: [{ text: "话虽如此", occurrence: 1, reasonEn: "Context only." }] });
    expect(result.checks.filter(check => !check.passed).length).toBeGreaterThan(0);
    const batch = goldenCases("analyze-saved-item-v3")[5];
    expect(compareGolden("analyze-saved-item-v3", batch, { cards: [{ id: "h2" }] }).checks[1].passed).toBe(false);
  });
  it("writes only selected sample data and a bounded result, without error details", () => {
    const sample = goldenCases("highlight-expressions-v1")[0];
    const failed = renderTrial(sample, null);
    expect(failed).toContain("Provider details are deliberately omitted");
    expect(failed).toContain("高得要命");
    expect(failed).not.toContain("userId");
  });
});
