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
import { buildHighlightExpressionsPrompt, createHighlightExpressionsFixtureGateway, normalizeHighlightExpressionsWire, type AnalysisLine } from "../src/server/ai/prompts/highlight-expressions.v1";
import { buildAnalyzeMarkedExpressionsPrompt, createAnalyzeMarkedExpressionsFixtureGateway, normalizeLearningCard, normalizeMarkedAnalysisWire } from "../src/server/ai/prompts/analyze-saved-item.v3";
import { createStructuredJsonGatewayResolver, type StructuredJsonGateway } from "../src/server/ai/structured-json-gateway";
import { createSupabaseModelGatewayRuntimeResolver } from "../src/server/model-gateway/runtime-resolver";
import { groundSuggestedHighlights } from "../src/server/domain/saved-item-target";
import { assertLocalSupabaseUrl } from "./seed-demo";
import type { Database } from "../src/types/database.generated";

export const PROMPT_VERSIONS = ["highlight-expressions-v1", "analyze-saved-item-v3"] as const;
export type PromptVersion = typeof PROMPT_VERSIONS[number];
export type GoldenCase = {
  id: string;
  input: { task: string; lines: readonly AnalysisLine[]; highlights?: readonly { id: string; text: string; line: number }[] };
  expect: Record<string, unknown>;
};
export function goldenCases(version: PromptVersion): GoldenCase[] {
  return (version === "highlight-expressions-v1" ? highlightCases : analysisCases) as GoldenCase[];
}
export function parsePromptArguments(args: readonly string[]) {
  const values = args[0] === "--" ? args.slice(1) : args;
  const version = z.enum(PROMPT_VERSIONS).parse(values[0]);
  let real = false, userId = "", caseId: string | undefined;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === "--real" && !real) real = true;
    else if (values[i] === "--user" && !userId) userId = z.string().uuid().parse(values[++i]);
    else if (values[i] === "--case" && caseId === undefined) caseId = z.string().min(1).parse(values[++i]);
    else throw new Error("Invalid arguments");
  }
  if (!real || !userId) throw new Error("Real gateway trials require --real --user <owner UUID>");
  const selected = goldenCases(version).filter(sample => !caseId || sample.id === caseId);
  if (selected.length === 0) throw new Error("Unknown golden case");
  return { version, userId, selected };
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
      const targets = sample.input.lines.filter(line => line.role === "TARGET");
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
  } else {
    const decoded = normalizeMarkedAnalysisWire(output);
    check("valid cards envelope", decoded.success);
    if (decoded.success) {
      const cards = decoded.data.cards;
      const highlights = sample.input.highlights ?? [];
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
  }
  return { checks, manualReview: [...strings(wanted.manualReview), "A human must assess naturalness, intended meaning, reusable boundaries and genuinely different situations; passing these checks is not semantic acceptance."] };
}
export async function runGoldenTrial(version: PromptVersion, sample: GoldenCase, gateway: StructuredJsonGateway) {
  const isHighlight = version === "highlight-expressions-v1";
  const prompt = isHighlight ? buildHighlightExpressionsPrompt(sample.input)
    : buildAnalyzeMarkedExpressionsPrompt({ lines: sample.input.lines, highlights: sample.input.highlights ?? [] });
  // One trial per chosen case. Do not hide an initial bad output behind format retries.
  const output = await gateway.complete<Record<string, unknown>>(version, prompt.userPrompt, {
    systemPrompt: prompt.systemPrompt, timeoutMs: isHighlight ? 20_000 : 30_000,
    maxTokens: isHighlight ? 350 : 450 * (sample.input.highlights?.length ?? 0) + 150,
    normalize: value => ({ success: true, data: value }),
  });
  return { output, comparison: compareGolden(version, sample, output) };
}
export function renderTrial(sample: GoldenCase, result: Awaited<ReturnType<typeof runGoldenTrial>> | null): string {
  const json = (value: unknown) => JSON.stringify(value, null, 2).slice(0, 24_000).replace(/`/g, "\\u0060");
  return `\n## ${sample.id}\n\nInput:\n\n\`\`\`json\n${json(sample.input)}\n\`\`\`\n\nExpect:\n\n\`\`\`json\n${json(sample.expect)}\n\`\`\`\n\n${result ? `Output and expectation comparisons (mechanical checks only):\n\n\`\`\`json\n${json(result)}\n\`\`\`` : "Trial failed. Provider details are deliberately omitted."}\n`;
}
export function derivePromptTrialEnvironment(environment: Record<string, string | undefined>) {
  const proxy = environment.POPCORN_PROXY_URL;
  const validated = optionalProxyUrl(proxy === undefined ? "" : `POPCORN_PROXY_URL=${proxy}`);
  return deriveChildServiceEnvironment(environment, validated);
}
async function main() {
  const { version, userId, selected } = parsePromptArguments(process.argv.slice(2));
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
    fixture: version === "highlight-expressions-v1" ? createHighlightExpressionsFixtureGateway() : createAnalyzeMarkedExpressionsFixtureGateway(),
    createRuntimeResolver: () => createSupabaseModelGatewayRuntimeResolver(client),
  }).resolve(userId, { configId: pin.config_id, revision: pin.revision, fingerprint: pin.config_fingerprint });
  let report = `\n# ${version} trial — ${new Date().toISOString()}\n\nReal owner gateway, selected golden data only. One request per case; existing transport retry policy applies. Requires human product review. No credentials or account configuration are included.\n`;
  for (const sample of selected) {
    let trial: Awaited<ReturnType<typeof runGoldenTrial>> | null = null;
    try { trial = await runGoldenTrial(version, sample, gateway); } catch { /* Never expose provider errors, which may contain transport data. */ }
    report += renderTrial(sample, trial);
  }
  const directory = resolve("docs/engineering/prompt-runs");
  await mkdir(directory, { recursive: true });
  const output = resolve(directory, `${new Date().toISOString().slice(0, 10)}-${version}.md`);
  await appendFile(output, report, { mode: 0o600 });
  process.stdout.write(`Prompt trial report saved: docs/engineering/prompt-runs/${new Date().toISOString().slice(0, 10)}-${version}.md\n`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write("Prompt trial stopped. Usage: pnpm prompts:try -- <prompt-version> --real --user <owner UUID> [--case <case-id>]. Check local configuration and the owner's active gateway. No provider details are logged.\n");
  process.exitCode = 1;
});
