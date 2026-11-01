import { MODEL_OUTPUT_TOKENS } from "../../src/server/ai/output-budgets";
import { describe, expect, it } from "vitest";
import activationCases from "./activate-practice-v3.json";
import evaluationCases from "./evaluate-practice-v5.json";
import { buildActivatePracticePrompt, createActivationFixtureGateway, createActivationWireNormalizer, type ActivationInput } from "../../src/server/ai/prompts/activate.v2";
import { buildEvaluatePracticePrompt, createEvaluationFixtureGateway, normalizePracticeEvaluationWire, type EvaluationInput } from "../../src/server/ai/prompts/evaluate.v2";
import { goldenCases, parsePromptArguments, compareGolden, runGoldenTrial } from "../../scripts/try-prompts";

describe("group 2 golden datasets and opt-in trial tooling", () => {
  it("ships the five prescribed activation cases and six scoring cases", () => {
    expect(activationCases).toHaveLength(5);
    expect(evaluationCases).toHaveLength(6);
    expect(activationCases[0].input.card.expression).toBe("高得要命");
    expect(activationCases[1].input.card.expression).toBe("说白了");
    expect(activationCases[2].input.card.expression).toBe("话虽如此");
    expect(activationCases[3].input.avoidSituations).toHaveLength(1);
    expect(activationCases[4].input.card.expression).toBe("有两把刷子");
    expect(evaluationCases[2].expect.exactScores?.accuracy).toBe(1);
    expect(evaluationCases[3].expect.exactScores?.accuracy).toBe(1);
    expect(evaluationCases[5].expect.allowNaturalRevision).toBe(false);
  });
  for (const sample of activationCases) it(`${sample.id}: isolates the exact four-field card and validates synthetic fixture shape only`, async () => {
    const prompt = buildActivatePracticePrompt(sample.input as ActivationInput);
    expect(JSON.parse(prompt.userPrompt.split("\n")[0])).toEqual(sample.input);
    expect(prompt.userPrompt).not.toContain('"examples"');
    expect(sample.expect.mustNotContain).toContain(sample.input.card.expression);
    expect(sample.expect.manualReview.length).toBeGreaterThan(0);
    const normalize = createActivationWireNormalizer({ targetExpression: sample.input.card.expression, avoidSituations: sample.input.avoidSituations });
    const output = await createActivationFixtureGateway().complete("activate-practice-v3", prompt.userPrompt, { systemPrompt: prompt.systemPrompt, timeoutMs: 20000, maxTokens: MODEL_OUTPUT_TOKENS.activatePractice, normalize });
    expect(normalize(output).success).toBe(true);
    // Generic synthetic CI data does not establish the required intention or sense.
  });
  for (const sample of evaluationCases) it(`${sample.id}: builds enriched scoring and valid deterministic fixture output`, async () => {
    const prompt = buildEvaluatePracticePrompt(sample.input as EvaluationInput);
    expect(JSON.parse(prompt.userPrompt.split("\n")[0])).toEqual(sample.input);
    const output = await createEvaluationFixtureGateway().complete("evaluate-practice-v5", prompt.userPrompt, { systemPrompt: prompt.systemPrompt, timeoutMs: 30000, maxTokens: MODEL_OUTPUT_TOKENS.evaluatePractice, normalize: normalizePracticeEvaluationWire });
    expect(normalizePracticeEvaluationWire(output).success).toBe(true);
    // Fixtures exercise shape only. They must not pretend to satisfy semantic scoring expectations.
    expect(sample.expect.manualReview.length).toBeGreaterThan(0);
  });
  it("keeps real trials explicitly opt-in and accepts the two new version names", () => {
    expect(() => parsePromptArguments(["activate-practice-v3"])).toThrow();
    expect(parsePromptArguments(["evaluate-practice-v5", "--real", "--user", "10000000-0000-4000-8000-000000000001"]).selected).toHaveLength(6);
    expect(goldenCases("activate-practice-v3")).toHaveLength(5);
  });
  it("reports scenario leakage, repeated situations and extra model-owned fields", () => {
    const sample = goldenCases("activate-practice-v3")[3];
    const result = compareGolden("activate-practice-v3", sample, { situationZh: activationCases[3].input.avoidSituations[0], situationEn: "高得要命 is the answer.", interlocutor: "朋友", taskEn: "Reply to your friend.", passed: true });
    expect(result.checks.filter(check => !check.passed).length).toBeGreaterThan(1);
  });
  it("exposes score-expectation misses instead of interpreting fixture scores as model quality", async () => {
    const sample = goldenCases("evaluate-practice-v5")[2];
    const result = await runGoldenTrial("evaluate-practice-v5", sample, createEvaluationFixtureGateway());
    expect(result.comparison.checks.find(check => check.label === "accuracy equals 1")?.passed).toBe(false);
    expect(result.comparison.manualReview.join(" ")).toContain("not semantic acceptance");
  });
  it("checks the raw all-five rewrite violation even though the parser would suppress it", () => {
    const sample = goldenCases("evaluate-practice-v5")[5];
    const output = { accuracy: { score: 5, englishFeedback: "Correct meaning." }, naturalness: { score: 5, englishFeedback: "Natural wording." }, contextualFit: { score: 5, englishFeedback: "Correct act." }, naturalRevisionChinese: "这个价格高得要命。" };
    expect(compareGolden("evaluate-practice-v5", sample, output).checks.find(check => check.label === "no natural revision requested")?.passed).toBe(false);
  });
});
