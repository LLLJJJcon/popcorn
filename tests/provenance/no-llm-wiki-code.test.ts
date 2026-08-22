import { existsSync, readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const readRequired = (file: string) => {
  expect(existsSync(file), `${file} must exist`).toBe(true);
  return readFileSync(file, "utf8");
};

const section = (markdown: string, heading: string) => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(
      `^## ${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`,
      "m",
    ),
  );
  expect(match, `missing policy section: ${heading}`).not.toBeNull();
  return match?.[1] ?? "";
};

describe("frozen upstream provenance", () => {
  test("limits LLM Wiki to documented methods and excludes GPLv3 expression", () => {
    const policy = readRequired("docs/engineering/upstream-reuse-policy.md");
    const llmWiki = section(policy, "LLM Wiki: method only");

    expect(llmWiki).toContain("nashsu/llm_wiki");
    expect(llmWiki).toContain("v0.6.9");
    expect(llmWiki).toContain("723e259309aea5e3850265b631f80224f66dd9f6");
    expect(llmWiki).toContain("GPLv3");
    expect(llmWiki).toContain("MUST NOT copy GPLv3 implementation code");

    for (const adoptedMethod of [
      "immutable raw sources followed by generated structured knowledge",
      "schema-governed knowledge organization",
      "two-stage analysis and knowledge update",
      "source traceability",
      "content hashing and incremental work avoidance",
      "durable processing queues",
      "asynchronous human review for ambiguous decisions",
      "index, operation log, and staged retrieval concepts",
    ]) {
      expect(llmWiki).toContain(adoptedMethod);
    }

    for (const forbiddenArtifact of [
      "code",
      "tests",
      "prompts",
      "components",
      "assets",
    ]) {
      expect(llmWiki).toMatch(
        new RegExp(`(?:forbid|must not|never)[^\\n]*\\b${forbiddenArtifact}\\b`, "i"),
      );
    }

    for (const forbiddenRuntimeOrProductArea of [
      "desktop runtime",
      "Markdown/Obsidian filesystem",
      "LanceDB/vector",
      "graphs/community",
      "agent chat",
      "Deep Research",
      "web clipper",
      "MCP implementation",
    ]) {
      expect(llmWiki).toContain(forbiddenRuntimeOrProductArea);
    }

    expect(llmWiki).toContain(
      "independently implemented in Popcorn relational/domain code",
    );
    expect(llmWiki).toContain("Batch B two-stage/traceability/async confirmation");
    expect(llmWiki).toContain("Batch C relational staged retrieval");
  });

  test("makes the pinned YouTube Digest reuse record reviewable per extension task", () => {
    const policy = readRequired("docs/engineering/upstream-reuse-policy.md");
    const youtubeDigest = section(policy, "YouTube Digest: code reuse");

    expect(youtubeDigest).toContain("zarazhangrui/youtube-digest");
    expect(youtubeDigest).toContain(
      "d03e1f61e017b032159ffd1821cac6e7693ce0c7",
    );
    expect(youtubeDigest).toContain("MIT");
    expect(youtubeDigest).toMatch(/preserve[^\n]*(?:copyright|license)/i);

    for (const requiredRecord of [
      "source repository",
      "immutable pin",
      "source file and function",
      "target file",
      "adaptation",
      "license action",
      "reused test",
    ]) {
      expect(youtubeDigest).toContain(requiredRecord);
    }

    expect(youtubeDigest).toContain("extension/tests/release.test.js");
    expect(youtubeDigest).toContain("third_party/youtube-digest/LICENSE");
    expect(youtubeDigest).toContain("THIRD_PARTY_NOTICES.md");
  });
});

describe("parallel agent ownership", () => {
  test("reserves shared surfaces and defines the review-to-integration protocol", () => {
    const policy = readRequired("docs/engineering/agent-boundaries.md");
    const controllerOwned = section(policy, "Controller-owned surfaces");
    const concurrency = section(policy, "Parallel execution rules");
    const review = section(policy, "Task review and integration");

    for (const reserved of [
      "src/contracts/**",
      "supabase/migrations/**",
      "src/types/database.generated.ts",
      "root configuration",
      "lockfile",
      "scripts/vendor-youtube-digest.sh",
      "THIRD_PARTY_NOTICES.md",
      "shared error codes",
      "docs/engineering/execution-ledger.md",
      "docs/engineering/checkpoints/**",
      "final integration",
    ]) {
      expect(controllerOwned).toContain(reserved);
    }

    expect(concurrency).toMatch(/at most three child Agents/i);
    expect(concurrency).toMatch(/distinct Git worktree/i);
    expect(concurrency).toMatch(/must not[^\n]*overlap[^\n]*active file ownership/i);

    const orderedSteps = [
      "implementation Agent",
      "fresh read-only review Agent",
      "fix Agent",
      "re-review",
      "controller integration",
    ];
    let lastIndex = -1;
    for (const step of orderedSteps) {
      const nextIndex = review.indexOf(step);
      expect(nextIndex, `${step} must be in the review protocol`).toBeGreaterThan(
        lastIndex,
      );
      lastIndex = nextIndex;
    }
  });
});

describe("scheduled recovery migration", () => {
  test("stores an every-minute Vault-backed pg_net command without a credential", () => {
    const migration = readRequired(
      "supabase/migrations/202608160003_cron.sql",
    );

    expect(migration).toMatch(
      /create extension if not exists pg_cron(?:\s+with schema\s+\w+)?\s*;/i,
    );
    expect(migration).toMatch(
      /create extension if not exists pg_net(?:\s+with schema\s+\w+)?\s*;/i,
    );

    const scheduled = migration.match(
      /cron\.schedule\(\s*'popcorn-process-knowledge-jobs'\s*,\s*'\* \* \* \* \*'\s*,\s*\$popcorn_cron\$([\s\S]*?)\$popcorn_cron\$\s*\)/i,
    );
    expect(scheduled, "expected a stable literal Cron command").not.toBeNull();
    const command = scheduled?.[1] ?? "";

    // Vault is queried by the stored command each time it runs. The migration must
    // not query a decrypted value and interpolate it into cron.schedule.
    expect(command).toContain("vault.decrypted_secrets");
    expect(command).toContain("popcorn_internal_job_url");
    expect(command).toContain("popcorn_internal_job_secret");
    expect(migration.slice(0, scheduled?.index ?? 0)).not.toContain(
      "vault.decrypted_secrets",
    );
    expect(migration).not.toMatch(/cron\.schedule\([\s\S]*?format\s*\(/i);

    expect(command).toMatch(/net\.http_post\s*\(/i);
    expect(command).toMatch(/url\s*:=\s*internal_url/i);
    expect(command).toMatch(/'Content-Type'\s*,\s*'application\/json'/i);
    expect(command).toMatch(
      /'Authorization'\s*,\s*'Bearer '\s*\|\|\s*internal_secret/i,
    );
    expect(command).toMatch(/jsonb_build_object\(\s*'source'\s*,\s*'supabase_cron'\s*\)/i);

    expect(command).toMatch(/btrim\(internal_url\)\s*<>\s*''/i);
    expect(command).toMatch(/btrim\(internal_secret\)\s*<>\s*''/i);
    expect(command).toContain(
      "^https://[^/?#]+/api/internal/jobs/process$",
    );

    expect(migration).not.toContain("INTERNAL_JOB_SECRET");
    expect(migration).not.toMatch(/https:\/\/[a-z0-9]/i);
    expect(migration).not.toMatch(/Bearer\s+(?:eyJ|sk-|[A-Za-z0-9_-]{24})/);
    expect(command).not.toMatch(/\b(?:insert|update)\b/i);
  });
});

describe("fixture-only CI freeze gate", () => {
  test("runs the revised one-job fixture gate and always tears down local Supabase", () => {
    const workflow = readRequired(".github/workflows/ci.yml");
    const jobs = workflow.slice(workflow.indexOf("\njobs:\n") + 1);
    const jobNames = [...jobs.matchAll(/^  ([a-zA-Z0-9_-]+):\s*$/gm)]
      .map((match) => match[1]);
    const permissions = workflow.match(/^permissions:\s*\n([\s\S]*?)^jobs:/m);

    expect(jobNames).toEqual(["verify"]);
    expect(permissions?.[1].trim()).toBe("contents: read");
    expect(workflow).toMatch(/timeout-minutes:\s*\d+/);
    expect(workflow).toContain("actions/checkout@v4");
    expect(workflow).toMatch(/fetch-depth:\s*0/);
    expect(workflow).toContain("actions/setup-node@v4");
    expect(workflow).toMatch(/node-version:\s*["']?20["']?/);
    expect(workflow).toContain("pnpm/action-setup@v4");
    expect(workflow).toMatch(/version:\s*["']?11\.19\.0["']?/);
    expect(workflow.indexOf("pnpm/action-setup@v4")).toBeLessThan(
      workflow.indexOf("actions/setup-node@v4"),
    );

    const orderedCommands = [
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
      'git diff --check "$PATCH_BASE...$GITHUB_SHA"',
      "node_modules/.bin/supabase stop --no-backup",
    ];
    let previousCommand = -1;
    for (const command of orderedCommands) {
      const commandIndex = workflow.indexOf(command);
      expect(commandIndex, `${command} must follow the preceding gate`).toBeGreaterThan(previousCommand);
      previousCommand = commandIndex;
    }
    expect(workflow).toContain('git diff-tree --check --root "$GITHUB_SHA"');
    expect(workflow).toMatch(/github\.event\.pull_request\.base\.sha/);
    expect(workflow).toMatch(/github\.event\.before/);
    expect(workflow).toContain("0000000000000000000000000000000000000000");

    for (const retiredPushGate of [
      "tests/contract/model-gateway-concurrency.sh",
      "tests/contract/model-gateway-artifact-concurrency.sh",
      "tests/contract/practice-promotion-concurrency.sh",
      "bash -n scripts/vendor-youtube-digest.sh",
    ]) {
      expect(workflow).not.toContain(retiredPushGate);
    }

    expect(workflow).toMatch(
      /if:\s*\$\{\{\s*always\(\)\s*\}\}[\s\S]*node_modules\/\.bin\/supabase stop --no-backup/,
    );
    expect(workflow).toMatch(/POPCORN_PROVIDER_MODE:\s*fixtures/);
    expect(workflow.match(/INTERNAL_JOB_SECRET/g)).toHaveLength(1);
    expect(workflow.match(/SUPABASE_SERVICE_ROLE_KEY/g)).toHaveLength(1);
    expect(workflow).not.toMatch(/\$\{\{\s*secrets(?:\s*\.|\s*\[)/);
    expect(workflow).not.toMatch(
      /(?:SUPADATA_API_KEY|OPENAI_API_KEY|OPENAI_MODEL|MODEL_GATEWAY_API_KEY|USER_GATEWAY_API_KEY)/,
    );
    expect(workflow).not.toMatch(/(?:sk-[A-Za-z0-9_-]{16,}|Bearer\s+eyJ)/);
  });

  test("reuses the pinned extension release test without dependency drift", () => {
    const packageJson = JSON.parse(readRequired("package.json")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const extensionTestPackage = JSON.parse(
      readRequired("extension/tests/package.json"),
    ) as Record<string, unknown>;

    expect(packageJson.scripts["test:extension"]).toBe(
      "node --test --test-name-pattern='^(?:notes filters preserve selected contrast and expose pressed state|runtime has no source-file credential dependency or retired model|retired Remix and reader files are absent|published prompt files contain runtime sections)$' extension/tests/release.test.js",
    );
    expect(extensionTestPackage).toEqual({ type: "commonjs" });
    expect(packageJson.dependencies).toEqual({
      "@supabase/ssr": "^0.9.0",
      "@supabase/supabase-js": "^2.112.3",
      "@tanstack/react-query": "^5.101.4",
      next: "16.3.1",
      openai: "^6.49.0",
      react: "19.2.8",
      "react-dom": "19.2.8",
      zod: "^4.4.3",
    });
    expect(packageJson.devDependencies).toEqual({
      "@playwright/test": "^1.62.1",
      "@tailwindcss/postcss": "^4",
      "@testing-library/jest-dom": "^6.9.1",
      "@testing-library/react": "^16.3.2",
      "@testing-library/user-event": "^14.6.4",
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "@vitejs/plugin-react": "^5.2.0",
      eslint: "^9",
      "eslint-config-next": "16.3.1",
      jsdom: "^28.1.0",
      supabase: "^2.114.0",
      tailwindcss: "^4",
      tsx: "4.23.12",
      typescript: "^5",
      vitest: "^4.1.10",
    });
  });
});
