import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

async function source(relativePath: string) {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function expectInOrder(haystack: string, needles: readonly string[]) {
  let cursor = -1;
  for (const needle of needles) {
    const next = haystack.indexOf(needle, cursor + 1);
    expect(next, `expected ${JSON.stringify(needle)} after offset ${cursor}`)
      .toBeGreaterThan(cursor);
    cursor = next;
  }
}

function workflowJobNames(workflow: string) {
  const lines = workflow.split(/\r?\n/);
  const jobsAt = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsAt < 0) return [];
  return lines.slice(jobsAt + 1).flatMap((line) => {
    const match = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    return match ? [match[1]] : [];
  });
}

describe("fixture acceptance entry", () => {
  test("composes only the three accepted scenarios instead of copying their fixtures", async () => {
    const acceptance = await source("tests/e2e/demo-acceptance.spec.ts");
    const imports = [...acceptance.matchAll(/^import\s+["'](.+)["'];\s*$/gm)]
      .map((match) => match[1])
      .sort();

    expect(imports).toEqual([
      "./extension/acquisition-save.spec",
      "./returning-learner.spec",
      "./saved-learning-loop.spec",
    ]);
    expect(acceptance).not.toMatch(
      /\b(?:test|describe)\s*\(|String\.raw|createClient|delete from|insert into|fixture-access-token/i,
    );
  });

  test("keeps each imported web scenario in its own named lifecycle scope", async () => {
    const saved = await source("tests/e2e/saved-learning-loop.spec.ts");
    const returning = await source("tests/e2e/returning-learner.spec.ts");

    expect(saved).toContain('test.describe("saved learning loop", () => {');
    expect(returning).toContain('test.describe("returning learner", () => {');
  });

  test("includes one learned-expression Vault search assertion in the Saved path", async () => {
    const saved = await source("tests/e2e/saved-learning-loop.spec.ts");

    expect(saved).toContain('getByLabel("Search expressions").fill(EXPRESSION)');
    expect(saved).toContain('getByRole("list", { name: "Vault search results" })');
  });

  test("loads the generated extension and derives the closed fixture origins from runtime config", async () => {
    const fixture = await source("tests/e2e/extension/fixtures.ts");

    expect(fixture).toContain("dist/popcorn-extension");
    expect(fixture).toContain("runtime-config.js");
    expect(fixture).not.toMatch(/path\.resolve\(process\.cwd\(\),\s*["']extension["']\)/);
    expect(fixture).not.toContain("https://app.popcorn.local/**");
    expect(fixture).not.toContain("https://project.supabase.co/**");
    expect(fixture).toMatch(/unapprovedEgress/);
    expect(fixture).toMatch(/www\.youtube\.com/);
    expect(fixture).toContain(
      'await context.route(/^https?:\\/\\//, (route) => route.abort("blockedbyclient"));',
    );
  });
});

describe("slim fixture CI", () => {
  test("uses the Node 24 built-in environment proxy runtime required by local self-hosting", async () => {
    const workflow = await source(".github/workflows/ci.yml");
    const packageManifest = JSON.parse(await source("package.json"));

    expect(packageManifest.engines).toMatchObject({ node: ">=24.5.0" });
    expect(workflow).toMatch(/node-version:\s*["']?24\.5\.0["']?/);
  });

  test("runs one ordered fixture-only release job with the complete acceptance entry", async () => {
    const workflow = await source(".github/workflows/ci.yml");

    expect(workflowJobNames(workflow)).toHaveLength(1);
    expect(workflow).toMatch(/POPCORN_PROVIDER_MODE:\s*["']?fixtures["']?/);
    expectInOrder(workflow, [
      "pnpm install --frozen-lockfile",
      "pnpm exec supabase start",
      "pnpm exec supabase status -o env > /tmp/popcorn-supabase.env",
      "source /tmp/popcorn-supabase.env",
      'echo "APP_URL=http://127.0.0.1:3000"',
      'echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"',
      'echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"',
      'echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"',
      'echo "POPCORN_E2E_DATABASE_URL=$DB_URL"',
      'echo "INTERNAL_JOB_SECRET=fixture-job-secret"',
      "pnpm verify",
      "pnpm test:extension",
      "pnpm db:reset",
      "pnpm db:test",
      "pnpm exec playwright install --with-deps chromium",
      "pnpm extension:package",
      "bash scripts/check-extension-release.sh dist/popcorn-extension.zip",
      "pnpm playwright test tests/e2e/demo-acceptance.spec.ts --project=chromium-extension",
      "git diff --check",
      "node_modules/.bin/supabase stop --no-backup",
    ]);
  });

  test("keeps live credentials and previously accepted concurrency scripts off every push", async () => {
    const workflow = await source(".github/workflows/ci.yml");

    expect(workflow).not.toMatch(/\$\{\{\s*secrets\./);
    expect(workflow).not.toMatch(
      /SUPADATA_API_KEY|OPENAI_API_KEY|OPENAI_MODEL|MODEL_GATEWAY_API_KEY|USER_GATEWAY_API_KEY/,
    );
    for (const script of [
      "tests/contract/model-gateway-concurrency.sh",
      "tests/contract/model-gateway-artifact-concurrency.sh",
      "tests/contract/practice-promotion-concurrency.sh",
    ]) {
      expect(workflow).not.toContain(script);
    }
  });

  test("checks whitespace across the event patch with a single-commit fallback", async () => {
    const workflow = await source(".github/workflows/ci.yml");

    expect(workflow).toMatch(/fetch-depth:\s*0/);
    expect(workflow).toMatch(/github\.event\.pull_request\.base\.sha/);
    expect(workflow).toMatch(/github\.event\.before/);
    expect(workflow).toContain("GITHUB_SHA");
    expect(workflow).toContain('git diff --check "$PATCH_BASE...$GITHUB_SHA"');
    expect(workflow).toContain('git diff-tree --check --root "$GITHUB_SHA"');
    expect(workflow).toMatch(/0{40}/);
  });

  test("routes the top-level entry through the persistent extension project", async () => {
    const config = await source("playwright.config.ts");
    const extensionProject = config.match(
      /name:\s*["']chromium-extension["'][\s\S]*?(?=\n\s*\},\s*\n\s*\{|\n\s*\],)/,
    )?.[0] ?? "";

    expect(extensionProject).toContain("demo-acceptance");
    expect(extensionProject).not.toMatch(/browserName:\s*["'](?:firefox|webkit)["']/);
  });
});

test("the professor checklist separates deterministic automation from Task 5 live smoke", async () => {
  const checklist = compact(await source("docs/operations/demo-checklist.md"));

  for (const topic of [
    "account",
    "dist/popcorn-extension",
    "known Mandarin YouTube fixture",
    "Chinese",
    "English",
    "bilingual",
    "background save",
    "Saved",
    "Use It Now",
    "Vault",
    "search",
    "Due Practice",
    "Progress",
    "worker",
    "recovery",
  ]) {
    expect(checklist, `missing checklist topic: ${topic}`).toMatch(new RegExp(topic, "i"));
  }
  expect(checklist).toMatch(/automated.{0,180}fixture|fixture.{0,180}automated/i);
  expect(checklist).toMatch(/Task 5.{0,220}manual.{0,180}real|manual.{0,180}Task 5.{0,220}real/i);
  expect(checklist).toMatch(/Supadata/i);
  expect(checklist).toMatch(/user-configured.{0,100}(?:model )?gateway/i);
  expect(checklist).toMatch(/never.{0,120}(?:record|print|show).{0,120}secret|secret values?.{0,120}never/i);
});
