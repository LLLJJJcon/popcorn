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

function normalizeMarkdownWhitespace(markdown: string) {
  return markdown.replace(/\s+/g, " ").trim();
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
  test("links to a Chinese daily-use guide with local and signed-in gateway boundaries", async () => {
    const readme = await text("README.md");
    const guidePath = "docs/operations/user-guide.zh-CN.md";
    const guide = await text(guidePath);
    const localConfigurationStart = guide.indexOf("| `.env.local` 字段");
    const localConfigurationEnd = guide.indexOf("### 4.", localConfigurationStart);
    const gatewayStart = guide.indexOf("### 5.");
    const gatewayEnd = guide.indexOf("### 6.", gatewayStart);
    const localConfiguration = guide.slice(localConfigurationStart, localConfigurationEnd);
    const gatewaySection = guide.slice(gatewayStart, gatewayEnd);

    expect(readme).toMatch(/\[[^\]]*中文[^\]]*\]\(docs\/operations\/user-guide\.zh-CN\.md\)/);
    expect(guide, "the README-linked Chinese guide must resolve").not.toBe("");

    for (const field of [
      "APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPADATA_API_KEY",
      "INTERNAL_JOB_SECRET",
    ]) {
      expect(guide, `missing local runtime field: ${field}`).toContain(field);
    }

    expect(localConfigurationStart, "missing .env.local configuration table").toBeGreaterThanOrEqual(0);
    expect(gatewayStart, "missing Web gateway section").toBeGreaterThanOrEqual(0);
    expect(gatewayEnd, "missing end of Web gateway section").toBeGreaterThan(gatewayStart);

    for (const input of ["显示名称", "HTTPS API 根地址", "模型 ID", "API 密钥"]) {
      expect(gatewaySection, `missing Web-only gateway row: ${input}`).toMatch(
        new RegExp(`^\\| ${input} \\|`, "m"),
      );
      expect(localConfiguration, `gateway input must not be an .env.local row: ${input}`).not.toMatch(
        new RegExp(`^\\| ${input} \\|`, "m"),
      );
    }

    expect(gatewaySection, "gateway API key must stay out of local files, shells, Chrome, Git, and chat").toMatch(
      /API 密钥[\s\S]{0,180}\.env\.local[\s\S]{0,180}终端[\s\S]{0,180}Chrome[\s\S]{0,180}Git[\s\S]{0,180}聊天/,
    );

    for (const entryPoint of [
      "pnpm popcorn:start",
      "pnpm popcorn:stop",
      "Start Popcorn.command",
      "Stop Popcorn.command",
    ]) {
      expect(guide, `missing daily entry point: ${entryPoint}`).toContain(entryPoint);
    }
  });

  test("separates one-time setup from the daily one-click launcher and preserves manual fallback commands", async () => {
    const readme = await text("README.md");
    const guide = await text("docs/operations/local-self-host.md");
    const documents = `${readme}\n${guide}`;
    for (const command of ["pnpm popcorn:start", "pnpm popcorn:stop", "Start Popcorn.command", "Stop Popcorn.command"]) {
      expect(documents, `missing one-click command: ${command}`).toContain(command);
    }
    expect(normalizeMarkdownWhitespace(guide)).toMatch(/one-time setup.{0,400}daily/i);
    expect(normalizeMarkdownWhitespace(guide)).toMatch(/manual.{0,180}(?:fallback|troubleshoot)|(?:fallback|troubleshoot).{0,180}manual/i);
  });

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
    const prose = normalizeMarkdownWhitespace(guide);
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
    expect(prose).toMatch(/(?:separate|another|second).{0,80}terminal/i);
    expect(prose).toMatch(/Web.{0,80}terminal|terminal.{0,80}Web/i);
    expect(prose).toMatch(/worker.{0,80}terminal|terminal.{0,80}worker/i);
  });

  test("pins the actual local prerequisites, endpoints, and account path", async () => {
    const guide = await text("docs/operations/local-self-host.md");
    const prose = normalizeMarkdownWhitespace(guide);
    for (const prerequisite of ["Node.js 24.5", "pnpm 11.19.0", "Docker", "Chrome 116+"]) {
      expect(guide).toContain(prerequisite);
    }
    expect(prose).toMatch(/(?:project-local|project dependency|project's dependency).{0,100}Supabase CLI|Supabase CLI.{0,100}(?:project-local|project dependency|project's dependency)/i);
    expect(guide).toContain("http://127.0.0.1:54321");
    expect(guide).toContain("http://127.0.0.1:54323");
    expect(guide).toContain("http://127.0.0.1:54324");
    expect(guide).toMatch(/enable_confirmations\s*=\s*false/);
    expect(prose).toMatch(/Create account/);
    expect(prose).toMatch(/Sign in/);
    expect(prose).toMatch(/Mailpit.{0,220}(?:if|when).{0,120}confirmation/i);
    expect(prose).toMatch(/Create account.{0,220}(?:automatically|automatic).{0,160}(?:default|fixed).{0,80}en\s*(?:→|->|to)\s*zh-CN.{0,220}(?:before|then).{0,160}(?:gateway|model)/i);
  });

  test("distinguishes six runtime fields while keeping the user gateway key out of env", async () => {
    const environment = await text(".env.example");
    const localGuide = await text("docs/operations/local-self-host.md");
    const prose = normalizeMarkdownWhitespace(localGuide);
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
    expect(prose).toMatch(/\.env\.example.{0,100}\.env\.local|\.env\.local.{0,100}\.env\.example/i);
    expect(prose).toMatch(/never commit.*\.env\.local|\.env\.local.*never commit/i);
    expect(prose).toMatch(/anon.{0,100}(?:public|browser-safe)|(?:public|browser-safe).{0,100}anon/i);
    expect(prose).toMatch(/service-role.{0,180}server-only|server-only.{0,180}service-role/i);
    expect(prose).toMatch(/Supadata.{0,180}server-only|server-only.{0,180}Supadata/i);
    expect(prose).toMatch(/job secret.{0,180}server-only|server-only.{0,180}job secret/i);
  });

  test("documents an optional HTTP proxy value without placing model credentials in local configuration", async () => {
    const environment = await text(".env.example");
    const localGuide = await text("docs/operations/local-self-host.md");
    const ChineseGuide = await text("docs/operations/user-guide.zh-CN.md");
    const allGuidance = `${environment}\n${localGuide}\n${ChineseGuide}`;

    expect(environment).toMatch(/^POPCORN_PROXY_URL=$/m);
    expect(environment).not.toMatch(/^\s*(?:OPENAI_API_KEY|OPENAI_MODEL|MODEL_GATEWAY_API_KEY|USER_GATEWAY_API_KEY)\s*=/m);
    expect(localGuide).toMatch(/direct access.{0,180}leave (?:it )?blank/i);
    expect(localGuide).toMatch(/(?:TUN|global).{0,180}leave (?:it )?blank/i);
    expect(localGuide).toMatch(/(?:browser|system).{0,80}proxy.{0,180}HTTP\/Mixed/i);
    expect(localGuide).toMatch(/find.{0,160}HTTP\/Mixed.{0,120}port/i);
    expect(localGuide).toMatch(/wrong|unavailable/i);
    expect(ChineseGuide).toMatch(/直连[\s\S]{0,180}留空/);
    expect(ChineseGuide).toMatch(/(?:TUN|全局)[\s\S]{0,180}留空/);
    expect(ChineseGuide).toMatch(/(?:浏览器|系统)[\s\S]{0,120}HTTP\/Mixed/);
    expect(ChineseGuide).toMatch(/HTTP\/Mixed[\s\S]{0,120}端口/);
    expect(allGuidance).not.toContain("7897");
  });

  test("puts gateway identity, endpoint, model, key, and consent only in signed-in Web settings", async () => {
    const guide = await text("docs/operations/local-self-host.md");
    const prose = normalizeMarkdownWhitespace(guide);
    expect(guide).toContain("/settings/model-gateway");
    expect(prose).toMatch(/after (?:you )?sign in|signed-in/i);
    expect(prose).toMatch(/gateway (?:display )?name/i);
    expect(prose).toMatch(/(?:base URL|gateway URL)/i);
    expect(prose).toMatch(/model/i);
    expect(prose).toMatch(/API key/i);
    expect(prose).toMatch(/exact[- ]destination consent|consent.{0,100}exact destination/i);
    expect(prose).toMatch(/API key.{0,180}(?:only|solely).{0,120}(?:Web|settings)|(?:Web|settings).{0,180}(?:only|solely).{0,120}API key/i);
    expect(prose).toMatch(/OpenAI-compatible HTTPS/i);
  });

  test("documents unpacked extension generation and bounded queue recovery", async () => {
    const localGuide = await text("docs/operations/local-self-host.md");
    const recovery = await text("docs/operations/job-recovery.md");
    const localProse = normalizeMarkdownWhitespace(localGuide);
    const recoveryProse = normalizeMarkdownWhitespace(recovery);
    expect(localGuide).toContain("dist/popcorn-extension");
    expect(localGuide).toContain("chrome://extensions");
    expect(localProse).toMatch(/Load\s+unpacked/i);
    expect(recoveryProse).toMatch(/restart.{0,100}(?:Web|worker)|(?:Web|worker).{0,100}restart/i);
    expect(recoveryProse).toMatch(/pending (?:save )?queue|extension.{0,120}pending/i);
    expect(recoveryProse).toMatch(/preserv|remain|keep/i);
    expect(recoveryProse).toMatch(/retry|reload/i);
    expect(recoveryProse).toMatch(/empty|processed|failed/i);
    expect(recoveryProse).toMatch(/Supadata/i);
    expect(recoveryProse).toMatch(/gateway.{0,160}consent|consent.{0,160}gateway/i);
  });

  test("limits reset and removal to the local Supabase instance", async () => {
    const localGuide = await text("docs/operations/local-self-host.md");
    const account = await text("docs/operations/account-reset.md");
    const localProse = normalizeMarkdownWhitespace(localGuide);
    const accountProse = normalizeMarkdownWhitespace(account);
    const resetOffset = localGuide.indexOf("pnpm db:reset");
    expect(resetOffset).toBeGreaterThanOrEqual(0);
    expect(normalizeMarkdownWhitespace(localGuide.slice(Math.max(0, resetOffset - 220), resetOffset + 220))).toMatch(/destructive.{0,160}local (?:Popcorn )?database|local (?:Popcorn )?database.{0,160}destructive/i);
    expect(accountProse).toMatch(/Supabase Studio/i);
    expect(accountProse).toMatch(/(?:direct|per-account|individual).{0,100}(?:deletion|delete).{0,160}(?:unsupported|not supported).{0,180}(?:Popcorn data|learning data)/i);
    expect(accountProse).toMatch(/no account-deletion UI|does not (?:have|include|provide).{0,100}account-deletion UI/i);
    expect(account).toContain("pnpm db:reset");
    expect(accountProse).toMatch(/(?:only supported|supported).{0,180}(?:removal|reset).{0,180}pnpm db:reset|pnpm db:reset.{0,180}(?:only supported|supported)/i);
    expect(accountProse).toMatch(/pnpm db:reset.{0,180}(?:all|every).{0,100}local accounts.{0,100}(?:all|every).{0,100}(?:learning )?data/i);
    expect(accountProse).toMatch(/local\s+(?:Popcorn\s+)?database/i);
    expect(accountProse).toMatch(/(?:sign out|disable the extension).{0,240}(?:leave|keep|preserve).{0,120}(?:data|stored data)/i);
    expect(accountProse).not.toMatch(/select (?:the |one |a )?(?:local )?(?:Auth )?user.{0,80}delete (?:it|the user)|Authentication\s*\/\s*Users.{0,180}select.{0,120}delete/i);
    expect(localProse).toMatch(/pnpm db:reset/);
  });

  test("covers local shutdown and troubleshooting without commercial operations scope", async () => {
    const documents = normalizeMarkdownWhitespace([
      await text("README.md"),
      await text("docs/operations/local-self-host.md"),
      await text("docs/operations/job-recovery.md"),
      await text("docs/operations/account-reset.md"),
    ].join("\n"));
    expect(documents).toMatch(/Ctrl-C|SIGINT/i);
    expect(documents).toContain("pnpm exec supabase stop");
    for (const topic of ["Web", "worker", "extension", "pending", "Supadata", "consent"]) {
      expect(documents, `missing troubleshooting topic: ${topic}`).toMatch(new RegExp(topic, "i"));
    }
    expect(documents).not.toMatch(/\bVercel\b|production hardening|\bWAF\b|firewall|\bSLOs?\b|quota|load test|operator dashboard|status API|backup drill|multi-tenant|commercial deployment/i);
  });
});
