# Popcorn Delivery and Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Complete screenshot and URL flows, export/deletion, production deployment, seeded demo data, cached demo AI results, and final end-to-end acceptance.

**Architecture:** Delivery work is sequential because migrations, seed data, provider caches, production configuration, and browser acceptance share state. The deployed application uses Vercel and Supabase with environment-separated configuration.

**Tech Stack:** Next.js, Supabase, OpenAI API, Playwright, Vercel.

## Global Constraints

- Never put a production key, demo password, or service-role key in Git.
- Local, preview, and production Supabase projects remain separate.
- Demo cache entries are versioned by content hash, prompt version, and model.
- Account deletion requires explicit confirmation and removes user-owned storage and database data.
- Deployment is not complete until the live desktop acceptance path succeeds.

---

### Task 1: Integrate screenshot analysis

**Files:**

- Create: src/app/(app)/import/image-import.tsx
- Create: src/app/api/v1/content/[contentId]/image-analysis/route.ts
- Test: tests/integration/content-analysis/image-analysis.test.ts
- Test: tests/e2e/image-learning-loop.spec.ts

**Interfaces:**

- Consumes private image NormalisedContent and AiProvider.analyse().
- Produces the same AnalysisResult and practice flow as text import.

- [ ] **Step 1: Write failing integration test**

Upload a fixture screenshot containing “你方便的时候发给我就行”. Assert the provider receives signed image input only on the server and the browser receives structured analysis without a storage service-role token.

- [ ] **Step 2: Implement server image analysis**

Resolve ownership, generate a short-lived signed URL or server-fetched image bytes, call the provider, persist run/cache status, and return AnalysisResult.

- [ ] **Step 3: Add E2E path**

Upload fixture, select Chinese expression, submit a response, and verify Vault persistence.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm test:integration -- image-analysis
    pnpm test:e2e -- image-learning-loop
    pnpm typecheck
    git add src/app tests/integration/content-analysis tests/e2e/image-learning-loop.spec.ts
    git commit -m "feat: complete screenshot learning loop"

### Task 2: Integrate public URL analysis

**Files:**

- Create: src/app/(app)/import/url-import.tsx
- Test: tests/integration/content-analysis/url-analysis.test.ts
- Test: tests/e2e/url-learning-loop.spec.ts

**Interfaces:**

- Consumes safe URL NormalisedContent.
- Produces the same AnalysisResult and practice flow as text import.

- [ ] **Step 1: Write failing tests with a controlled fixture server**

Cover successful Chinese HTML, redirect to private address, timeout, oversized response, unsupported content type, and page without Chinese text.

- [ ] **Step 2: Implement form integration**

Use English labels Paste a public URL and Import. Display copyright/sensitive-content guidance and safe error codes.

- [ ] **Step 3: Verify and commit**

Run:

    pnpm test:integration -- url-analysis
    pnpm test:e2e -- url-learning-loop
    pnpm typecheck
    git add src/app/\(app\)/import tests/integration/content-analysis tests/e2e/url-learning-loop.spec.ts
    git commit -m "feat: complete URL learning loop"

### Task 3: Export learner memory

**Files:**

- Create: src/server/domain/export-memory.ts
- Create: src/app/api/v1/account/export/route.ts
- Create: src/features/profile/export-memory-button.tsx
- Test: src/server/domain/export-memory.test.ts
- Test: tests/integration/account/export.test.ts

**Interfaces:**

- Produces version 1 JSON and Markdown exports containing profile learning settings, expressions, occurrences, attempts, mastery events, and review history.

- [ ] **Step 1: Write failing export tests**

Assert stable field order, UTF-8 Chinese preservation, English explanations, ISO dates, version marker, no provider token usage, no signed storage URLs, and no other user's data.

- [ ] **Step 2: Implement pure serializers**

Use explicit selected fields, not database row spreading. Markdown includes one section per Chinese expression and source metadata without reproducing an oversized full article.

- [ ] **Step 3: Implement authenticated route and button**

GET /api/v1/account/export?format=json or markdown returns an attachment. UI copy is Download JSON and Download Markdown.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm vitest run src/server/domain/export-memory.test.ts
    pnpm test:integration -- export
    pnpm typecheck
    git add src/server/domain/export-memory.ts src/app/api/v1/account/export src/features/profile tests/integration/account
    git commit -m "feat: export learner expression memory"

### Task 4: Delete account data

**Files:**

- Create: src/server/domain/delete-account.ts
- Create: src/app/api/v1/account/route.ts
- Create: src/features/profile/delete-account-dialog.tsx
- Test: tests/integration/account/delete-account.test.ts
- Test: src/features/profile/delete-account-dialog.test.tsx

**Interfaces:**

- DELETE /api/v1/account requires { confirmation: "DELETE MY ACCOUNT" }.

- [ ] **Step 1: Write failing deletion tests**

Assert wrong confirmation is rejected, all owned database rows are removed, storage objects are removed, auth user deletion occurs last, partial storage failure reports retryable failure before auth deletion, and user B is untouched.

- [ ] **Step 2: Implement service-role-only server operation**

The browser never receives the service-role client. Log request ID and safe counts, not deleted content.

- [ ] **Step 3: Implement confirmation dialog**

English warning explains permanent deletion. Require exact typed phrase and disable destructive button until matched.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm test:integration -- delete-account
    pnpm vitest run src/features/profile/delete-account-dialog.test.tsx
    pnpm typecheck
    git add src/server/domain/delete-account.ts src/app/api/v1/account src/features/profile tests/integration/account
    git commit -m "feat: add verified account deletion"

### Task 5: Seed demo account and cache

**Files:**

- Create: scripts/seed-demo-account.ts
- Create: scripts/seed-demo-cache.ts
- Create: tests/fixtures/demo/demo-data.ts
- Create: tests/integration/demo/demo-seed.test.ts
- Modify: package.json

**Interfaces:**

- Produces repeatable demo data with existing Vault, progress history, and one due transfer task.

- [ ] **Step 1: Write idempotent seed test**

Run the seed twice and assert identical logical records, no duplicate mastery events, one pending due task, and at least one reused expression.

- [ ] **Step 2: Implement demo account seed**

Read DEMO_USER_EMAIL and DEMO_USER_PASSWORD only from environment. Create profile B1 with goal “Understand and respond to everyday Chinese online.”

- [ ] **Step 3: Implement demo cache seed**

Use known inputs:

- 这也太离谱了吧。
- 你方便的时候发给我就行。
- 这事儿说白了就是钱的问题。

Store cache entries through the same run/cache service used in production, keyed by active model and prompt version.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm test:integration -- demo-seed
    pnpm demo:seed
    pnpm demo:seed
    pnpm test:integration -- demo-seed
    git add scripts tests/fixtures/demo tests/integration/demo package.json pnpm-lock.yaml
    git commit -m "feat: add repeatable demo data"

### Task 6: Add production observability and safe health check

**Files:**

- Create: src/server/logging/logger.ts
- Create: src/app/api/health/route.ts
- Create: tests/integration/health/health.test.ts
- Modify: src/server/api/respond.ts

**Interfaces:**

- GET /api/health returns application status, database reachability, and build revision without secrets.

- [ ] **Step 1: Write failing health tests**

Assert 200 when database is reachable, 503 when unavailable, requestId always present, and response excludes keys, URLs with credentials, model prompts, and user content.

- [ ] **Step 2: Implement structured logger**

Log timestamp, level, requestId, route, safe error code, duration, AI run ID, and build revision. Redact email, raw content, API keys, cookies, and Authorization.

- [ ] **Step 3: Verify and commit**

Run:

    pnpm test:integration -- health
    pnpm typecheck
    git add src/server/logging src/app/api/health src/server/api/respond.ts tests/integration/health
    git commit -m "feat: add safe production health checks"

### Task 7: Configure preview and production environments

**Files:**

- Create: docs/operations/deployment.md
- Create: docs/operations/backup-restore.md
- Create: vercel.json only if a concrete platform setting is required
- Modify: .env.example

**Interfaces:**

- Produces documented local, preview, and production environment boundaries.

- [ ] **Step 1: Document exact environment variables**

List public Supabase URL/anon key, server service-role key, OpenAI key/model/embedding model, app URL, demo credentials, and build revision. Mark which Vercel environment receives each value.

- [ ] **Step 2: Document Supabase deployment**

Commands:

    pnpm exec supabase link --project-ref "$SUPABASE_PROJECT_REF"
    pnpm exec supabase migration list --linked
    pnpm exec supabase db push --linked

Require a separate preview project before production push.

- [ ] **Step 3: Document backup and restore rehearsal**

Record schema dump, data backup, storage inventory, restore to a non-production project, and post-restore RLS tests. No production deletion command belongs in an automated script.

- [ ] **Step 4: Verify docs and commit**

Run:

    rg -n "OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|DEMO_USER_PASSWORD" .env.example docs/operations
    git diff --check
    git add docs/operations .env.example vercel.json
    git commit -m "docs: add deployment and recovery runbook"

If vercel.json is not required and does not exist, omit it from git add.

### Task 8: Full local acceptance suite

**Files:**

- Create: tests/e2e/demo-acceptance.spec.ts
- Create: docs/operations/demo-checklist.md

**Interfaces:**

- Proves final user-visible path from a clean local database.

- [ ] **Step 1: Write the final acceptance test**

The test:

1. signs into the seeded account;
2. shows existing Vault and Progress;
3. imports new Chinese text;
4. receives tone and expression analysis;
5. writes a genuine Chinese response;
6. sees English feedback;
7. verifies automatic Vault and mastery evidence update;
8. opens a due task;
9. submits transfer evidence;
10. signs out and back in;
11. confirms all state persists.

- [ ] **Step 2: Run clean local verification**

Run:

    pnpm install --frozen-lockfile
    pnpm db:reset
    pnpm db:test
    pnpm verify
    pnpm build
    pnpm test:e2e

Expected: every command exits 0 with zero skipped required tests.

- [ ] **Step 3: Add demo checklist**

Include credentials availability, seeded data, due task, known cached inputs, browser viewport, network, provider status, backup, and a tested retry path.

- [ ] **Step 4: Commit**

Run:

    git add tests/e2e/demo-acceptance.spec.ts docs/operations/demo-checklist.md
    git commit -m "test: add complete demo acceptance path"

### Task 9: Deploy and verify the live application

**Files:**

- No code change unless live verification exposes a tested defect.

- [ ] **Step 1: Deploy preview**

Use the Vercel project connected to the feature branch and preview Supabase project. Apply preview migrations before testing.

- [ ] **Step 2: Run preview smoke tests**

Run:

    PLAYWRIGHT_BASE_URL="$PREVIEW_URL" pnpm test:e2e -- demo-acceptance

Expected: PASS against preview.

- [ ] **Step 3: Deploy production sequentially**

Verify production migration list, push reviewed migrations, deploy application, seed demo account/cache, then run health check.

- [ ] **Step 4: Run production acceptance**

Run:

    PLAYWRIGHT_BASE_URL="$PRODUCTION_URL" pnpm test:e2e -- demo-acceptance

Expected: PASS against production.

- [ ] **Step 5: Record release**

Run:

    git tag -a popcorn-web-v1 -m "Popcorn desktop web v1"
    git status --short --branch

Expected: clean tracked worktree on the release commit. Existing intentionally untracked project artifacts may remain listed and must not be deleted.
