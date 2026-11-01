import { MODEL_OUTPUT_TOKENS, learningCardOutputTokens } from "../src/server/ai/output-budgets";
import { readFile, mkdir, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { deriveChildServiceEnvironment, optionalProxyUrl } from "./popcorn-local.mjs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import highlightCases from "../tests/prompt-golden/highlight-expressions-v1.json";
import analysisCases from "../tests/prompt-golden/analyze-saved-item-v3.json";
import activationCases from "../tests/prompt-golden/activate-practice-v3.json";
import evaluationCases from "../tests/prompt-golden/evaluate-practice-v5.json";
import transferCases from "../tests/prompt-golden/transfer-scenario-v1.json";
import transferReviewCases from "../tests/prompt-golden/transfer-scenario-v1-review.json";
import { buildHighlightExpressionsPrompt, createHighlightExpressionsFixtureGateway, normalizeHighlightExpressionsWire, type AnalysisLine } from "../src/server/ai/prompts/highlight-expressions.v1";
import { buildAnalyzeMarkedExpressionsPrompt, createAnalyzeMarkedExpressionsFixtureGateway, normalizeLearningCard, normalizeMarkedAnalysisWire } from "../src/server/ai/prompts/analyze-saved-item.v3";
import { buildActivatePracticePrompt, createActivationFixtureGateway, createActivationWireNormalizer, normalizeActivationWire, type ActivationInput } from "../src/server/ai/prompts/activate.v2";
import { buildEvaluatePracticePrompt, normalizePracticeEvaluationWire, createEvaluationFixtureGateway, type EvaluationInput } from "../src/server/ai/prompts/evaluate.v2";
import { buildTransferScenarioPrompt, createTransferScenarioFixtureGateway, createTransferScenarioWireNormalizer, normalizeTransferScenarioWire, validateTransferScenarioOutput, TRANSFER_SCENARIO_MAX_TOKENS, TRANSFER_SCENARIO_TIMEOUT_MS, type TransferScenarioInput, type TransferScenarioOutput } from "../src/server/ai/prompts/transfer-scenario.v1";
import { ModelGatewayError } from "../src/server/ai/provider";
import { completeWithFormatRetries, createStructuredJsonGatewayResolver, type StructuredJsonGateway } from "../src/server/ai/structured-json-gateway";
import { createSupabaseModelGatewayRuntimeResolver } from "../src/server/model-gateway/runtime-resolver";
import { groundSuggestedHighlights } from "../src/server/domain/saved-item-target";
import { assertLocalSupabaseUrl } from "./seed-demo";
import type { Database } from "../src/types/database.generated";

export const PROMPT_VERSIONS = ["highlight-expressions-v1", "analyze-saved-item-v3", "activate-practice-v3", "evaluate-practice-v5", "transfer-scenario-v1"] as const;
export type PromptVersion = typeof PROMPT_VERSIONS[number];
export type GoldenCase = {
  id: string;
  input: Record<string, unknown>;
  expect: Record<string, unknown>;
};
export function goldenCases(version: PromptVersion): GoldenCase[] {
  const cases = { "highlight-expressions-v1": highlightCases, "analyze-saved-item-v3": analysisCases, "activate-practice-v3": activationCases, "evaluate-practice-v5": evaluationCases, "transfer-scenario-v1": transferCases };
  return cases[version] as GoldenCase[];
}
export function parsePromptArguments(args: readonly string[]) {
  const values = args[0] === "--" ? args.slice(1) : args;
  const version = z.enum(PROMPT_VERSIONS).parse(values[0]);
  let real = false, reviewSet = false, userId = "", caseId: string | undefined;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === "--real" && !real) real = true;
    else if (values[i] === "--user" && !userId) userId = z.string().uuid().parse(values[++i]);
    else if (values[i] === "--case" && caseId === undefined) caseId = z.string().min(1).parse(values[++i]);
    else if (values[i] === "--review-set" && !reviewSet) reviewSet = true;
    else throw new Error("Invalid arguments");
  }
  if (!real || !userId) throw new Error("Real gateway trials require --real --user <owner UUID>");
  if (reviewSet && (version !== "transfer-scenario-v1" || caseId)) throw new Error("Review set requires transfer-scenario-v1 and all twenty cases");
  const selected = (reviewSet ? transferReviewCases as GoldenCase[] : goldenCases(version)).filter(sample => !caseId || sample.id === caseId);
  if (selected.length === 0) throw new Error("Unknown golden case");
  return { version, userId, selected, reviewSet };
}
const strings = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
export type ExpectComparison = { checks: { label: string; passed: boolean }[]; manualReview: string[] };

/** Mechanical comparisons expose misses; semantics always remain for product review. */
export function compareGolden(version: PromptVersion, sample: GoldenCase, output: Record<string, unknown>): ExpectComparison {
  const checks: ExpectComparison["checks"] = [];
  const check = (label: string, passed: boolean) => checks.push({ label, passed });
  const wanted = sample.expect;
  if (version === "highlight-expressions-v1") {
    const decoded = normalizeHighlightExpressionsWire(output);
    check("valid highlight wire", decoded.success);
    if (decoded.success) {
      const marks = decoded.data.highlights;
      check("at most two marks", marks.length <= 2);
      check("empty result permitted", marks.length > 0 || wanted.allowEmpty === true);
      for (const text of strings(wanted.mustInclude)) check(`includes ${text}`, marks.some(mark => mark.text === text));
      for (const text of strings(wanted.mustNotInclude)) check(`excludes ${text}`, marks.every(mark => !mark.text.includes(text)));
      const targets = (sample.input.lines as readonly AnalysisLine[]).filter(line => line.role === "TARGET");
      try {
        const grounded = groundSuggestedHighlights(marks, targets.map(line => ({ id: String(line.line), text: line.text, startSeconds: 0, endSeconds: 1 })));
        check("all marks survive deduplication, overlap and grounding checks", grounded.length === marks.length);
      } catch { check("all marks survive deduplication, overlap and grounding checks", false); }
      const rawMarks = Array.isArray(output.highlights) ? output.highlights : [];
      check("no ids, offsets, line numbers or timestamps", rawMarks.every(mark =>
        typeof mark === "object" && mark !== null && Object.keys(mark).every(key => ["text", "occurrence", "reasonEn"].includes(key))));
      for (const [i, mark] of marks.entries()) {
        const legal = targets.some(line => {
          if (line.text === mark.text || mark.text.includes("\n")) return false;
          let from = 0;
          for (let count = 1; count <= mark.occurrence; count++) {
            const at = line.text.indexOf(mark.text, from);
            if (at < 0) return false;
            from = at + 1;
          }
          return true;
        });
        check(`mark ${i + 1}: exact single TARGET substring and legal occurrence`, legal);
        check(`mark ${i + 1}: explanation present within 40 words`, typeof mark.reasonEn === "string" && mark.reasonEn.split(/\s+/u).length <= 40);
        check(`mark ${i + 1}: unique text`, marks.filter(other => other.text === mark.text).length === 1);
      }
    }
  } else if (version === "analyze-saved-item-v3") {
    const decoded = normalizeMarkedAnalysisWire(output);
    check("valid cards envelope", decoded.success);
    if (decoded.success) {
      const cards = decoded.data.cards;
      const highlights = (sample.input.highlights ?? []) as readonly { id: string; text: string; line: number }[];
      check("one card per id in exact order", cards.length === highlights.length && cards.every((card, i) => card.id === highlights[i]?.id));
      for (const [i, card] of cards.entries()) {
        check(`card ${i + 1}: required fields and exact-mark examples`, normalizeLearningCard(card, highlights[i]?.text ?? "").success);
        check(`card ${i + 1}: no expression/source fields`, Object.keys(card).every(key => ["id", "meaningHere", "useItWhen", "comparedWith", "howItFits", "toneAndWho", "watchOut", "examples", "functionCategories", "usageSettings", "suitability", "notExpressionReasonEn"].includes(key)));
        if (wanted.suitability) check(`card ${i + 1}: suitability`, card.suitability === wanted.suitability);
        if (wanted.reasonRequired) check(`card ${i + 1}: reason`, typeof card.notExpressionReasonEn === "string" && card.notExpressionReasonEn.length > 0);
        const primary = strings(wanted.primaryFunctionAny);
        if (primary.length) check(`card ${i + 1}: primary intention`, primary.includes(strings(card.functionCategories)[0]));
        const alternatives = strings(wanted.comparedWithAny);
        if (alternatives.length) check(`card ${i + 1}: ordinary alternative (lexical hint; review equivalent wording)`, alternatives.some(text => String(card.comparedWith).includes(text)));
        const tones = strings(wanted.toneAny);
        if (tones.length) check(`card ${i + 1}: informal tone (lexical hint)`, tones.some(text => String(card.toneAndWho).toLowerCase().includes(text)));
        const examples = Array.isArray(card.examples) ? card.examples as { zh?: string }[] : [];
        for (const text of strings(wanted.examplesMustNotContain)) check(`card ${i + 1}: examples exclude ${text}`, examples.every(example => !String(example.zh).includes(text)));
      }
    }
  } else if (version === "activate-practice-v3" || version === "transfer-scenario-v1") {
    const input = sample.input as unknown as ActivationInput & TransferScenarioInput;
    const transfer = version === "transfer-scenario-v1";
    const decoded = transfer ? normalizeTransferScenarioWire(output) : normalizeActivationWire(output);
    check("valid four-field scenario", decoded.success);
    check("no extra model-owned fields", Object.keys(output).every(key => ["situationZh", "situationEn", "interlocutor", "taskEn"].includes(key)));
    if (decoded.success) {
      const grounded = transfer ? createTransferScenarioWireNormalizer({ targetExpression: input.card.expression, previousSituations: input.previousSituations })(output) : createActivationWireNormalizer({ targetExpression: input.card.expression, avoidSituations: input.avoidSituations })(output);
      check("target-free and previously unused scenario", grounded.success);
      for (const target of strings(wanted.mustNotContain)) {
        for (const field of transfer ? ["situationZh", "situationEn", "interlocutor", "taskEn"] as const : ["situationZh", "situationEn", "taskEn"] as const) check(`${field} excludes ${target}`, !decoded.data[field].includes(target));
      }
    }
  } else {
    const decoded = normalizePracticeEvaluationWire(output);
    check("valid evaluation wire", decoded.success);
    check("no model-owned business fields", Object.keys(output).every(key => ["accuracy", "naturalness", "contextualFit", "naturalRevisionChinese"].includes(key)));
    if (decoded.success) {
      for (const [constraint, operator] of [["minScores", "at least"], ["maxScores", "at most"], ["exactScores", "equals"]] as const) {
        const bounds = wanted[constraint];
        if (typeof bounds !== "object" || bounds === null || Array.isArray(bounds)) continue;
        for (const field of ["accuracy", "naturalness", "contextualFit"] as const) {
          const bound = (bounds as Record<string, unknown>)[field];
          if (typeof bound !== "number") continue;
          const score = decoded.data[field].score;
          check(`${field} ${operator} ${bound}`, constraint === "minScores" ? score >= bound : constraint === "maxScores" ? score <= bound : score === bound);
        }
      }
      if (wanted.allowNaturalRevision === false) check("no natural revision requested", output.naturalRevisionChinese === undefined || output.naturalRevisionChinese === null);
      if (typeof output.naturalRevisionChinese === "string") check("optional revision contains target", output.naturalRevisionChinese.includes(String(sample.input.targetExpression)));
    }
  }
  return { checks, manualReview: [...strings(wanted.manualReview), "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."] };
}
export async function runGoldenTrial(version: PromptVersion, sample: GoldenCase, gateway: StructuredJsonGateway) {
  const lines = (sample.input.lines ?? []) as readonly AnalysisLine[];
  const highlights = (sample.input.highlights ?? []) as readonly { id: string; text: string; line: number }[];
  const prompt = version === "highlight-expressions-v1" ? buildHighlightExpressionsPrompt({ lines })
    : version === "analyze-saved-item-v3" ? buildAnalyzeMarkedExpressionsPrompt({ lines, highlights })
      : version === "activate-practice-v3" ? buildActivatePracticePrompt(sample.input as unknown as ActivationInput)
        : version === "transfer-scenario-v1" ? buildTransferScenarioPrompt(sample.input as unknown as TransferScenarioInput)
          : buildEvaluatePracticePrompt(sample.input as unknown as EvaluationInput);
  // One trial per chosen case. Do not hide an initial bad output behind format retries.
  const output = await gateway.complete<Record<string, unknown>>(version, prompt.userPrompt, {
    systemPrompt: prompt.systemPrompt, timeoutMs: version === "highlight-expressions-v1" || version === "activate-practice-v3" || version === "transfer-scenario-v1" ? 20_000 : 30_000,
    maxTokens: version === "highlight-expressions-v1" ? MODEL_OUTPUT_TOKENS.highlightExpressions : version === "analyze-saved-item-v3" ? learningCardOutputTokens(highlights.length) : version === "activate-practice-v3" ? MODEL_OUTPUT_TOKENS.activatePractice : version === "transfer-scenario-v1" ? TRANSFER_SCENARIO_MAX_TOKENS : MODEL_OUTPUT_TOKENS.evaluatePractice,
    normalize: value => ({ success: true, data: value }),
  });
  return { output, comparison: compareGolden(version, sample, output) };
}
export function renderTrial(sample: GoldenCase, result: Awaited<ReturnType<typeof runGoldenTrial>> | null): string {
  const json = (value: unknown) => JSON.stringify(value, null, 2).slice(0, 24_000).replace(/`/g, "\\u0060");
  return `\n## ${sample.id}\n\nInput:\n\n\`\`\`json\n${json(sample.input)}\n\`\`\`\n\nExpect:\n\n\`\`\`json\n${json(sample.expect)}\n\`\`\`\n\n${result ? `Output and expectation comparisons (mechanical checks only):\n\n\`\`\`json\n${json(result)}\n\`\`\`` : "Trial failed. Provider details are deliberately omitted."}\n`;
}
export type TransferReviewAttempt = {
  number: number;
  status: "valid" | "invalid" | "failed";
  output: Record<string, unknown> | null;
  comparison: ExpectComparison | null;
  failureStage?: string;
};
export type TransferReviewSetResult = {
  denominator: 20;
  cases: { id: string; input: TransferScenarioInput; expect: Record<string, unknown>; attempts: TransferReviewAttempt[]; output: TransferScenarioOutput | null }[];
};

/** Explicit real-review mode only. Same four-attempt format budget as production; no semantic retries. */
export async function runTransferReviewSet(gateway: StructuredJsonGateway): Promise<TransferReviewSetResult> {
  const cases: TransferReviewSetResult["cases"] = [];
  const generatedHistory = new Map<string, string[]>();
  for (const fixed of transferReviewCases) {
    const source = fixed.input as TransferScenarioInput;
    const input: TransferScenarioInput = { ...source, previousSituations: [...source.previousSituations, ...generatedHistory.get(source.card.expression) ?? []] };
    const sample: GoldenCase = { ...fixed, input: { ...input } };
    const attempts: TransferReviewAttempt[] = [];
    const prompt = buildTransferScenarioPrompt(input);
    const context = { targetExpression: input.card.expression, previousSituations: input.previousSituations };
    let output: TransferScenarioOutput | null = null;
    try {
      output = await completeWithFormatRetries(async () => {
        let raw: Record<string, unknown>;
        try {
          // Decode the JSON object before task validation so malformed/duplicate objects
          // stay visible in the audit instead of being silently discarded by normalization.
          raw = await gateway.complete("transfer-scenario-v1", prompt.userPrompt, {
            systemPrompt: prompt.systemPrompt, maxTokens: TRANSFER_SCENARIO_MAX_TOKENS, timeoutMs: TRANSFER_SCENARIO_TIMEOUT_MS,
            normalize: value => ({ success: true, data: value }),
          });
        } catch (error) {
          const formatFailure = error instanceof ModelGatewayError && ["json_extract", "wire_schema", "grounding"].includes(error.stage);
          attempts.push({ number: attempts.length + 1, status: formatFailure ? "invalid" : "failed", output: null, comparison: null, ...(error instanceof ModelGatewayError ? { failureStage: error.stage } : {}) });
          throw error;
        }
        const comparison = compareGolden("transfer-scenario-v1", sample, raw);
        try {
          const valid = validateTransferScenarioOutput(raw, context);
          attempts.push({ number: attempts.length + 1, status: "valid", output: raw, comparison });
          return valid;
        } catch (error) {
          attempts.push({ number: attempts.length + 1, status: "invalid", output: raw, comparison, failureStage: "grounding" });
          throw error;
        }
      });
    } catch { /* Failed cases retain their fixed place in the twenty-case denominator. */ }
    if (output) generatedHistory.set(input.card.expression, [...generatedHistory.get(input.card.expression) ?? [], output.situationZh]);
    cases.push({ id: fixed.id, input, expect: fixed.expect, attempts, output });
  }
  return { denominator: 20, cases };
}

export function renderTransferReviewSet(result: TransferReviewSetResult): string {
  const available = result.cases.filter(item => item.output !== null).length;
  const attempts = result.cases.reduce((count, item) => count + item.attempts.length, 0);
  let report = `\n# transfer-scenario-v1 fixed review set — ${new Date().toISOString()}\n\nFixed synthetic card inputs; real generated outputs require human review. Usable structured results: ${available}/20. Total format attempts: ${attempts}. Human approval: pending (required at least 17/20). Failed cases remain in denominator 20; no replacement cases and no semantic retries. Existing transport retries remain unchanged. No account configuration or raw provider errors are included.\n`;
  report += "\n| Case | Expression | Direction | Intention | Setting | Structured result | Human intention/setting | Human naturalness | Approved |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n";
  for (const item of result.cases) report += `| ${item.id} | ${item.input.card.expression} | ${item.input.transferType} | ${item.input.targetFunction.value} | ${item.input.targetSetting.value} | ${item.output ? "available" : "failed"} | pending | pending | pending |\n`;
  const safeJson = (value: unknown) => JSON.stringify(value, null, 2).replace(/`/g, "\\u0060");
  for (const item of result.cases) {
    report += `\n## ${item.id}\n\nInput and expectations:\n\n\`\`\`json\n${safeJson({ input: item.input, expect: item.expect })}\n\`\`\`\n\nAll attempts:\n`;
    for (const attempt of item.attempts) report += `\n\`\`\`json\n${safeJson(attempt)}\n\`\`\`\n`;
    report += `\nSelected result: ${item.output ? "first structurally valid attempt" : "FAILED — no usable result"}.\n\nHuman intention/setting/naturalness: pending.\n`;
  }
  return report;
}
export function derivePromptTrialEnvironment(environment: Record<string, string | undefined>) {
  const proxy = environment.POPCORN_PROXY_URL;
  const validated = optionalProxyUrl(proxy === undefined ? "" : `POPCORN_PROXY_URL=${proxy}`);
  return deriveChildServiceEnvironment(environment, validated);
}
async function main() {
  const { version, userId, selected, reviewSet } = parsePromptArguments(process.argv.slice(2));
  // Same local dotenv syntax as Node; never evaluate a shell file or print its contents.
  for (const file of [".env.local", ".env"]) {
    const content = await readFile(resolve(file), "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return ""; throw error; });
    for (const [key, value] of Object.entries(parseEnv(content))) if (process.env[key] === undefined) process.env[key] = value;
  }
  const environment = derivePromptTrialEnvironment(process.env);
  if (environment.NODE_USE_ENV_PROXY === "1" && process.env.POPCORN_PROMPTS_PROXY_BOOTSTRAPPED !== "1") {
    // Node reads its proxy switch at startup; reuse the launcher's exact validated
    // proxy and loopback bypass in a child before constructing any network client.
    await new Promise<void>((resolveChild, rejectChild) => {
      const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
        env: { ...environment, POPCORN_PROMPTS_PROXY_BOOTSTRAPPED: "1" }, stdio: "inherit",
      });
      child.once("error", rejectChild);
      child.once("exit", code => { process.exitCode = code ?? 1; resolveChild(); });
    });
    return;
  }
  const url = assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const key = z.string().min(1).parse(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await client.rpc("resolve_active_user_model_gateway_pin", { p_user_id: userId });
  if (result.error || result.data.length !== 1) throw new Error("Active owner gateway unavailable");
  const pin = result.data[0];
  const gateway = await createStructuredJsonGatewayResolver({ ci: false,
    fixture: version === "highlight-expressions-v1" ? createHighlightExpressionsFixtureGateway() : version === "analyze-saved-item-v3" ? createAnalyzeMarkedExpressionsFixtureGateway() : version === "activate-practice-v3" ? createActivationFixtureGateway() : version === "transfer-scenario-v1" ? createTransferScenarioFixtureGateway() : createEvaluationFixtureGateway(),
    createRuntimeResolver: () => createSupabaseModelGatewayRuntimeResolver(client),
  }).resolve(userId, { configId: pin.config_id, revision: pin.revision, fingerprint: pin.config_fingerprint });
  let report = reviewSet ? renderTransferReviewSet(await runTransferReviewSet(gateway)) : `\n# ${version} trial — ${new Date().toISOString()}\n\nReal owner gateway, selected golden data only. One request per case; existing transport retry policy applies. Requires human product review. No credentials or account configuration are included.\n`;
  for (const sample of reviewSet ? [] : selected) {
    let trial: Awaited<ReturnType<typeof runGoldenTrial>> | null = null;
    try { trial = await runGoldenTrial(version, sample, gateway); } catch { /* Never expose provider errors, which may contain transport data. */ }
    report += renderTrial(sample, trial);
  }
  const directory = resolve("docs/engineering/prompt-runs");
  await mkdir(directory, { recursive: true });
  const filename = `${new Date().toISOString().slice(0, 10)}-${version}${reviewSet ? "-review-set" : ""}.md`;
  const output = resolve(directory, filename);
  await appendFile(output, report, { mode: 0o600 });
  process.stdout.write(`Prompt trial report saved: docs/engineering/prompt-runs/${filename}\n`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write("Prompt trial stopped. Usage: pnpm prompts:try -- <prompt-version> --real --user <owner UUID> [--case <case-id> | --review-set]. Review-set mode requires transfer-scenario-v1 and all twenty fixed inputs. Check local configuration and the owner's active gateway. No provider details are logged.\n");
  process.exitCode = 1;
});
