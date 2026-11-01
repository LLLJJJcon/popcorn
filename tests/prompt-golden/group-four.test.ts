import { describe, expect, it } from "vitest";
import cases from "./transfer-scenario-v1.json";
import reviewCases from "./transfer-scenario-v1-review.json";
import { buildTransferScenarioPrompt, createTransferScenarioFixtureGateway, createTransferScenarioWireNormalizer, type TransferScenarioInput } from "../../src/server/ai/prompts/transfer-scenario.v1";
import { compareGolden, goldenCases, parsePromptArguments, runGoldenTrial, runTransferReviewSet, renderTransferReviewSet } from "../../scripts/try-prompts";
import { ModelGatewayError } from "../../src/server/ai/provider";
import type { StructuredJsonGateway } from "../../src/server/ai/structured-json-gateway";

const legal = { situationZh: "同事说这个项目有不少优点，问你是否还有别的考虑。", situationEn: "A coworker says this project has many strengths and asks if you have any other concerns.", interlocutor: "同事", taskEn: "Acknowledge the strengths and offer a different consideration." };
describe("review golden data and explicit review-set tool", () => {
  it("ships the six prescribed golden cases and fixed twenty independent synthetic inputs", () => {
    expect(cases).toHaveLength(6);
    expect(reviewCases).toHaveLength(20);
    expect(goldenCases("transfer-scenario-v1")).toHaveLength(6);
    for (const expression of ["高得要命", "说白了", "话虽如此"]) expect(reviewCases.filter(sample => sample.input.card.expression === expression)).toHaveLength(3);
    expect(new Set(reviewCases.map(sample => sample.id)).size).toBe(20);
    expect(new Set(reviewCases.map(sample => sample.input.targetFunction.value)).size).toBe(10);
    expect(new Set(reviewCases.map(sample => sample.input.targetSetting.value)).size).toBe(5);
  });
  for (const sample of cases) it(`${sample.id}: framing omits original/example data and synthetic output meets structure only`, async () => {
    const input = sample.input as TransferScenarioInput;
    const prompt = buildTransferScenarioPrompt(input);
    expect(JSON.parse(prompt.userPrompt.split("\n")[0])).toEqual(sample.input);
    const normalize = createTransferScenarioWireNormalizer({ targetExpression: input.card.expression, previousSituations: input.previousSituations });
    const result = await createTransferScenarioFixtureGateway().complete("transfer-scenario-v1", prompt.userPrompt, { systemPrompt: prompt.systemPrompt, timeoutMs: 20000, maxTokens: 400, normalize });
    expect(normalize(result).success).toBe(true);
    expect(sample.expect.manualReview.length).toBeGreaterThan(0);
  });
  it("requires opt-in review-set selection and rejects partial review denominators", () => {
    const args = ["transfer-scenario-v1", "--real", "--user", "10000000-0000-4000-8000-000000000001", "--review-set"];
    expect(parsePromptArguments(args)).toMatchObject({ reviewSet: true, selected: expect.any(Array) });
    expect(parsePromptArguments(args).selected).toHaveLength(20);
    expect(() => parsePromptArguments([...args, "--case", "review-01"])).toThrow();
    expect(() => parsePromptArguments(["activate-practice-v3", ...args.slice(1)])).toThrow();
  });
  it("exposes all target leakage and normalized history repeats in mechanical comparisons", () => {
    const sample = goldenCases("transfer-scenario-v1")[0];
    const result = compareGolden("transfer-scenario-v1", sample, { ...legal, interlocutor: "高得要命" });
    expect(result.checks.some(check => !check.passed)).toBe(true);
    expect(result.manualReview.join(" ")).toContain("not semantic acceptance");
  });
  it("keeps an ordinary selected case as one raw trial even when its output is invalid", async () => {
    let calls = 0;
    const gateway: StructuredJsonGateway = { model: "fixture/raw-trial", async complete() { calls++; return { ...legal, passed: true } as never; } };
    const result = await runGoldenTrial("transfer-scenario-v1", goldenCases("transfer-scenario-v1")[0], gateway);
    expect(calls).toBe(1);
    expect(result.comparison.checks.some(check => !check.passed)).toBe(true);
  });
  it("records all four malformed attempts, preserves denominator twenty and never adds a replacement case", async () => {
    let calls = 0;
    const gateway: StructuredJsonGateway = { model: "fixture/failing", async complete() { calls++; throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema"); } };
    const result = await runTransferReviewSet(gateway);
    expect(calls).toBe(80);
    expect(result.denominator).toBe(20);
    expect(result.cases).toHaveLength(20);
    expect(result.cases.every(item => item.output === null && item.attempts.length === 4)).toBe(true);
    expect(renderTransferReviewSet(result)).toContain("0/20");
  });
  it("stops after valid structure, without retrying semantic quality, and appends actual same-expression history", async () => {
    const recorded: Record<string, unknown>[] = [];
    const budgets: { maxTokens: number; timeoutMs: number }[] = [];
    const fixture = createTransferScenarioFixtureGateway();
    const gateway: StructuredJsonGateway = { model: fixture.model, async complete(version, prompt, options) { recorded.push(JSON.parse(prompt.split("\n")[0])); budgets.push({ maxTokens: options.maxTokens, timeoutMs: options.timeoutMs }); return fixture.complete(version, prompt, options); } };
    const result = await runTransferReviewSet(gateway);
    expect(recorded).toHaveLength(20);
    expect(budgets).toEqual(Array.from({ length: 20 }, () => ({ maxTokens: 400, timeoutMs: 20000 })));
    expect(result.cases.every(item => item.attempts.length === 1)).toBe(true);
    const first = result.cases[0].output!;
    expect(recorded[1].previousSituations).toContain(first.situationZh);
    expect(result.cases[1].input.previousSituations).toContain(first.situationZh);
    expect(renderTransferReviewSet(result)).toContain("Human approval: pending");
  });
  it("retries duplicate and malformed outputs but records them before the first valid output", async () => {
    const fixture = createTransferScenarioFixtureGateway();
    let calls = 0;
    const gateway: StructuredJsonGateway = { model: fixture.model, async complete(version, prompt, options) {
      calls++;
      if (calls === 1) return { ...legal, situationZh: "朋友问：“这杯咖啡六十元，你怎么看？”" } as never;
      if (calls === 2) return { ...legal, passed: true } as never;
      return fixture.complete(version, prompt, options);
    } };
    const result = await runTransferReviewSet(gateway);
    expect(result.cases[0].attempts.map(attempt => attempt.status)).toEqual(["invalid", "invalid", "valid"]);
    expect(result.cases[0].attempts[0].output).not.toBeNull();
    expect(result.cases[0].attempts[0].comparison?.checks.some(check => !check.passed)).toBe(true);
  });
  it("does not spend format retries on transport failure and omits raw provider errors", async () => {
    let calls = 0;
    const gateway: StructuredJsonGateway = { model: "fixture/network", async complete() { calls++; throw new Error("secret transport payload"); } };
    const result = await runTransferReviewSet(gateway);
    expect(calls).toBe(20);
    expect(result.cases.every(item => item.attempts.length === 1 && item.attempts[0].status === "failed")).toBe(true);
    expect(renderTransferReviewSet(result)).not.toContain("secret transport payload");
  });
});
