import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

async function text(relativePath: string) {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function expectInOrder(haystack: string, needles: string[]) {
  let cursor = -1;
  for (const needle of needles) {
    const next = haystack.indexOf(needle, cursor + 1);
    expect(next, `expected ${JSON.stringify(needle)} after offset ${cursor}`).toBeGreaterThan(cursor);
    cursor = next;
  }
}

describe("fresh-clone personal self-host documentation", () => {
  test("creates the root entry point and all focused operations guides", async () => {
    const readme = await text("README.md");
    expect(readme).toMatch(/Popcorn/i);
    expect(readme).toMatch(/docs\/operations\/local-self-host\.md/);
    expect(readme).toMatch(/docs\/operations\/job-recovery\.md/);
    expect(readme).toMatch(/docs\/operations\/account-reset\.md/);
    expect(readme).toMatch(/docs\/operations\/extension-install\.md/);

    for (const guide of [
      "docs/operations/local-self-host.md",
      "docs/operations/job-recovery.md",
      "docs/operations/account-reset.md",
    ]) {
      expect(await text(guide), `${guide} must not be empty`).not.toBe("");
    }
  });

  test("documents one ordered local startup path and separate Web and worker terminals", async () => {
    const guide = await text("docs/operations/local-self-host.md");
    for (const command of [
      "pnpm install --frozen-lockfile",
      "pnpm exec supabase start",
      "pnpm db:reset",
      "pnpm dev",
      "pnpm worker:local",
      "pnpm extension:local",
      "pnpm demo:seed -- --user",
    ]) {
      expect(guide, `missing exact command: ${command}`).toContain(command);
    }
    expectInOrder(guide, [
      "pnpm install --frozen-lockfile",
      "pnpm exec supabase start",
      "pnpm db:reset",
      "pnpm dev",
      "pnpm worker:local",
      "pnpm extension:local",
    ]);
    expect(guide).toMatch(/(?:separate|another|second)[^\n]{0,80}terminal/i);
    expect(guide).toMatch(/Web[^\n]{0,80}terminal|terminal[^\n]{0,80}Web/i);
    expect(guide).toMatch(/worker[^\n]{0,80}terminal|terminal[^\n]{0,80}worker/i);
  });

  test("pins the actual local prerequisites, endpoints, and account path", async () => {
    const guide = await text("docs/operations/local-self-host.md");
    for (const prerequisite of ["Node.js 20", "pnpm 11.19.0", "Docker", "Chrome 116+"]) {
      expect(guide).toContain(prerequisite);
    }
    expect(guide).toMatch(/(?:project-local|project dependency|project's dependency)[^\n]{0,100}Supabase CLI|Supabase CLI[^\n]{0,100}(?:project-local|project dependency|project's dependency)/i);
    expect(guide).toContain("http://127.0.0.1:54321");
    expect(guide).toContain("http://127.0.0.1:54323");
    expect(guide).toContain("http://127.0.0.1:54324");
    expect(guide).toMatch(/enable_confirmations\s*=\s*false/);
    expect(guide).toMatch(/Create account/);
    expect(guide).toMatch(/Sign in/);
    expect(guide).toMatch(/Mailpit[\s\S]{0,220}(?:if|when)[\s\S]{0,120}confirmation/i);
  });

  test("distinguishes six runtime fields while keeping the user gateway key out of env", async () => {
    const environment = await text(".env.example");
    const localGuide = await text("docs/operations/local-self-host.md");
    const fields = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPADATA_API_KEY",
      "APP_URL",
      "INTERNAL_JOB_SECRET",
    ];
    for (const field of fields) {
      expect(environment).toMatch(new RegExp(`^${field}=`, "m"));
      expect(localGuide).toContain(field);
    }
    expect(environment).toMatch(/public|browser-safe/i);
    expect(environment).toMatch(/server-only/i);
    expect(environment).not.toMatch(/^\s*(?:OPENAI_API_KEY|OPENAI_MODEL|MODEL_GATEWAY_API_KEY|USER_GATEWAY_API_KEY)\s*=/m);
    expect(localGuide).toMatch(/\.env\.example[^\n]{0,100}\.env\.local|\.env\.local[^\n]{0,100}\.env\.example/i);
    expect(localGuide).toMatch(/never commit[^\n]*\.env\.local|\.env\.local[^\n]*never commit/i);
    expect(localGuide).toMatch(/anon[^\n]{0,100}(?:public|browser-safe)|(?:public|browser-safe)[^\n]{0,100}anon/i);
    expect(localGuide).toMatch(/service-role[\s\S]{0,180}server-only|server-only[\s\S]{0,180}service-role/i);
    expect(localGuide).toMatch(/Supadata[\s\S]{0,180}server-only|server-only[\s\S]{0,180}Supadata/i);
    expect(localGuide).toMatch(/job secret[\s\S]{0,180}server-only|server-only[\s\S]{0,180}job secret/i);
  });

  test("puts gateway identity, endpoint, model, key, and consent only in signed-in Web settings", async () => {
    const guide = await text("docs/operations/local-self-host.md");
    expect(guide).toContain("/settings/model-gateway");
    expect(guide).toMatch(/after (?:you )?sign in|signed-in/i);
    expect(guide).toMatch(/gateway (?:display )?name/i);
    expect(guide).toMatch(/(?:base URL|gateway URL)/i);
    expect(guide).toMatch(/model/i);
    expect(guide).toMatch(/API key/i);
    expect(guide).toMatch(/exact[- ]destination consent|consent[^\n]{0,100}exact destination/i);
    expect(guide).toMatch(/API key[^\n]{0,180}(?:only|solely)[^\n]{0,120}(?:Web|settings)|(?:Web|settings)[^\n]{0,180}(?:only|solely)[^\n]{0,120}API key/i);
    expect(guide).toMatch(/OpenAI-compatible HTTPS/i);
  });

  test("documents unpacked extension generation and bounded queue recovery", async () => {
    const localGuide = await text("docs/operations/local-self-host.md");
    const recovery = await text("docs/operations/job-recovery.md");
    expect(localGuide).toContain("dist/popcorn-extension");
    expect(localGuide).toContain("chrome://extensions");
    expect(localGuide).toMatch(/Load\s+unpacked/i);
    expect(recovery).toMatch(/restart[^\n]{0,100}(?:Web|worker)|(?:Web|worker)[^\n]{0,100}restart/i);
    expect(recovery).toMatch(/pending (?:save )?queue|extension[^\n]{0,120}pending/i);
    expect(recovery).toMatch(/preserv|remain|keep/i);
    expect(recovery).toMatch(/retry|reload/i);
    expect(recovery).toMatch(/empty|processed|failed/i);
    expect(recovery).toMatch(/Supadata/i);
    expect(recovery).toMatch(/gateway[\s\S]{0,160}consent|consent[\s\S]{0,160}gateway/i);
  });

  test("limits reset and removal to the local Supabase instance", async () => {
    const localGuide = await text("docs/operations/local-self-host.md");
    const account = await text("docs/operations/account-reset.md");
    const resetOffset = localGuide.indexOf("pnpm db:reset");
    expect(resetOffset).toBeGreaterThanOrEqual(0);
    expect(localGuide.slice(Math.max(0, resetOffset - 220), resetOffset + 220)).toMatch(/destructive[^\n]{0,160}local (?:Popcorn )?database|local (?:Popcorn )?database[^\n]{0,160}destructive/i);
    expect(account).toMatch(/Supabase Studio/i);
    expect(account).toMatch(/Authentication[^\n/]*[/]Users|Authentication[^\n]{0,80}Users/i);
    expect(account).toMatch(/no account-deletion UI|does not (?:have|include|provide)[^\n]{0,100}account-deletion UI/i);
    expect(account).toContain("pnpm db:reset");
    expect(account).toMatch(/local\s+(?:Popcorn\s+)?database/i);
  });

  test("covers local shutdown and troubleshooting without commercial operations scope", async () => {
    const documents = [
      await text("README.md"),
      await text("docs/operations/local-self-host.md"),
      await text("docs/operations/job-recovery.md"),
      await text("docs/operations/account-reset.md"),
    ].join("\n");
    expect(documents).toMatch(/Ctrl-C|SIGINT/i);
    expect(documents).toContain("pnpm exec supabase stop");
    for (const topic of ["Web", "worker", "extension", "pending", "Supadata", "consent"]) {
      expect(documents, `missing troubleshooting topic: ${topic}`).toMatch(new RegExp(topic, "i"));
    }
    expect(documents).not.toMatch(/\bVercel\b|production hardening|\bWAF\b|firewall|\bSLOs?\b|quota|load test|operator dashboard|status API|backup drill|multi-tenant|commercial deployment/i);
  });
});
