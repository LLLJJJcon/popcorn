# Popcorn Chrome Extension and Web Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package, deploy, seed, observe, and verify the complete YouTube-to-owned Popcorn product through a repeatable live demonstration.

**Architecture:** Vercel hosts the authenticated web/API application; Supabase provides Auth, PostgreSQL, RLS, Cron, and durable job state; a packaged Manifest V3 extension links to the deployed origin. CI uses fixed fixtures while the final checklist includes explicit real-provider smoke tests.

**Tech Stack:** Chrome extension packaging, Next.js/Vercel, Supabase, Playwright persistent Chromium, Vitest, server-only Supadata/AI providers.

## Global Constraints

- Batch A, B, and C exit gates must be green.
- The packaged extension must retain YouTube Digest MIT attribution and the exact upstream commit record.
- No LLM Wiki GPLv3 implementation code enters the package.
- Provider terms and private transcript-snapshot permission must be reviewed and recorded before production readiness.
- CI never depends on live YouTube, Supadata, or AI availability.
- The live demo must still show a real extension save entering authenticated cloud data.
- Other input sources remain absent.

### Task 1: Package and audit the extension distribution

**Files:**

- Create: `scripts/package-extension.sh`
- Create: `scripts/check-extension-release.sh`
- Create: `docs/operations/extension-install.md`
- Create: `docs/operations/upstream-provenance.md`
- Modify: `extension/manifest.json`
- Test: `tests/release/extension-package.test.ts`

**Interfaces:**

- Consumes: completed `extension/`, stable public manifest key, Popcorn production/preview origins.
- Produces: deterministic `dist/popcorn-extension.zip` and SHA256 checksum.

**Upstream reuse:** Adapt YouTube Digest `scripts/package-extension.sh`, `scripts/check-release.sh`, `manifest.json`, and `tests/release.test.js` rather than writing an unrelated packaging flow. Preserve its MIT license in the distribution.

- [ ] **Step 1: Write the failing package audit**

Assert the archive contains manifest, service worker, Side Panel, options/auth, prompts, icons, MIT license, and provenance; rejects source maps, secrets, tests, retired API-key fields, direct Supadata/DeepSeek hosts, or `llm_wiki` code.

- [ ] **Step 2: Adapt upstream package/check scripts**

Use a clean temporary staging directory, an explicit allowlist, deterministic file ordering where supported, and `shasum -a 256`. `check-extension-release.sh` verifies minimum Chrome 116, permissions, host allowlist, stable key, CSP, and absence of secrets.

- [ ] **Step 3: Document install/reload**

Describe unpacked installation for assessment, exact folder/zip, reload after updates, sign-in, supported page, and how to confirm Chinese transcript and cloud save. Do not require users to enter provider keys.

- [ ] **Step 4: Verify and commit**

```bash
bash scripts/package-extension.sh
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
pnpm vitest run tests/release/extension-package.test.ts
git add scripts docs/operations extension/manifest.json tests/release
git commit -m "build: package the Popcorn Chrome extension"
```

### Task 2: Seed the demo account, known video, and cached jobs

**Files:**

- Create: `scripts/seed-demo-account.ts`
- Create: `scripts/seed-demo-youtube.ts`
- Create: `tests/fixtures/demo/youtube-video.ts`
- Create: `tests/fixtures/demo/transcript.zh-CN.json`
- Create: `tests/fixtures/demo/generated-artifacts.json`
- Create: `tests/integration/demo/demo-seed.test.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: one demo user with one existing video snapshot, saved moments, `tried/reused/owned` examples, one due task, and cached results for a known public video.

- [ ] **Step 1: Write the failing seed test**

Assert stable UUIDs, exact video ID/hash, ordered segments, source-grounded quotes/candidates, all three mastery states, one due task, and idempotent rerun.

- [ ] **Step 2: Implement deterministic fixtures**

Store short necessary transcript fixture excerpts, timestamps, expected English translations, overview, candidates, evaluation, and prompt/model versions. Record source URL and fixture acquisition date; do not store the video file.

- [ ] **Step 3: Implement idempotent seed scripts**

Require explicit target environment, refuse production unless `--allow-production-demo-seed` is supplied, and never print passwords, tokens, full private transcripts, or provider responses.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run tests/integration/demo/demo-seed.test.ts
pnpm demo:seed -- --environment local
pnpm demo:seed -- --environment local
git add scripts tests/fixtures/demo tests/integration/demo package.json
git commit -m "feat: seed the YouTube learning demonstration"
```

### Task 3: Add minimal job observability and recovery operations

**Files:**

- Create: `src/server/logging/logger.ts`
- Create: `src/app/api/internal/jobs/status/route.ts`
- Create: `docs/operations/job-recovery.md`
- Create: `docs/operations/backup-restore.md`
- Test: `tests/integration/jobs/status.test.ts`

**Interfaces:**

- Produces: authenticated aggregate job counts/oldest age for operators, request IDs, and documented retry/recovery. This is operational support, not an Expression Health Check or learner-facing product feature.

- [ ] **Step 1: Write failing safe-output tests**

Assert the internal status route requires the job secret and reports aggregate counts only. It exposes no key, model prompt, user ID, URL, transcript, saved text, learner response, or full provider error. Do not add a public health dashboard or learner-facing health score.

- [ ] **Step 2: Implement structured redacted logging**

Allow request ID, job type/status, duration, provider category, retry count, and hashed identifiers. Explicitly redact authorization, cookies, provider bodies, transcript text, saved text, and learner responses.

- [ ] **Step 3: Document recovery**

Include failed-job inspection, retry by exact ID/user scope, lease expiry, Cron verification, cache invalidation by version, database backup, restore rehearsal, and extension pending-queue diagnosis.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run tests/integration/jobs/status.test.ts
git add src/server/logging src/app/api/internal/jobs/status docs/operations tests/integration/jobs/status.test.ts
git commit -m "feat: observe and recover knowledge jobs safely"
```

### Task 4: Configure production auth, RLS, Cron, and provider boundaries

**Files:**

- Create: `docs/operations/deployment.md`
- Create: `docs/operations/provider-terms-review.md`
- Modify: `.env.example`
- Modify: `extension/manifest.json`
- Create: `vercel.json` only if a measured duration/runtime setting is required
- Test: `tests/contract/deployment-config.test.ts`

**Interfaces:**

- Produces: preview/production configuration matrix and a completed provider snapshot-permission gate.

- [ ] **Step 1: Write failing deployment checks**

Assert preview and production use different Supabase projects, auth redirect origins include the stable Chromium extension origin, service-role/provider/job secrets are absent from `NEXT_PUBLIC_*`, Cron secret comes from Vault, and extension host permissions contain only YouTube plus approved Popcorn origins.

- [ ] **Step 2: Document exact deployment order**

Apply migrations, verify RLS, set Vault/Cron, configure Supabase Auth redirects, set Vercel server variables, deploy web, package extension with production origin, seed demo, and run smoke checks. Rollback reverses application deployment without rolling back append-only learning evidence blindly.

- [ ] **Step 3: Complete provider-terms gate**

Record current provider terms URL/date, native-caption storage permission, retention, deletion obligations, private-use boundary, and responsible reviewer. If private full transcript snapshots are not permitted, mark production deployment blocked; do not silently change to clip-only storage.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run tests/contract/deployment-config.test.ts
git diff --check
git add docs/operations .env.example extension/manifest.json vercel.json tests/contract/deployment-config.test.ts
git commit -m "docs: define secure Popcorn deployment"
```

### Task 5: Build the complete local acceptance suite

**Files:**

- Create: `tests/e2e/demo-acceptance.spec.ts`
- Create: `tests/e2e/extension/live-save-fixture.spec.ts`
- Create: `docs/operations/demo-checklist.md`
- Modify: `playwright.config.ts`

**Interfaces:**

- Produces: one repeatable demo covering extension acquisition, cloud capture, Saved organization, first practice, due reuse, and Progress.

- [ ] **Step 1: Write the complete fixture-backed scenario**

Use persistent Chrome with unpacked extension. Sign in, open the known YouTube fixture, show Chinese/English/bilingual transcript, Overview, save from player and subtitle, verify no playback interruption, open web, inspect grouped saves/evidence, complete Use It Now, verify `tried`, complete due Practice, and verify Progress.

- [ ] **Step 2: Add outage proof**

Force transcript and AI providers unavailable after cached fixture setup. The known video still renders cached results; a new raw save remains durable and visibly pending/failed without corrupting mastery.

- [ ] **Step 3: Write the presenter checklist**

Include extension loaded/enabled, exact build checksum, demo login available without exposing credentials, known video available, provider-cache status, due task present, backup path, fallback narration, and post-demo data cleanup.

- [ ] **Step 4: Run full local acceptance**

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm db:reset
pnpm db:test
pnpm build
node --test extension/tests/*.test.js
bash scripts/package-extension.sh
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
pnpm playwright test tests/e2e/demo-acceptance.spec.ts --project=chromium-extension
pnpm test:provenance
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e docs/operations/demo-checklist.md playwright.config.ts
git commit -m "test: add complete Popcorn demo acceptance"
```

### Task 6: Deploy and perform real-service verification

**Files:**

- Modify: `docs/operations/deployment.md`
- Modify: `docs/operations/demo-checklist.md`
- Create: `docs/operations/release-report.md`

**Interfaces:**

- Consumes: Tasks 1-5 and approved provider-terms review.
- Produces: deployed web URL, packaged extension checksum, migration version, and manual smoke evidence.

- [ ] **Step 1: Deploy preview and run smoke checks**

Verify auth redirect, extension linking, native Chinese transcript, one translation batch, Overview, exact save, web Saved record, job completion, RLS isolation, and authenticated aggregate job status.

- [ ] **Step 2: Deploy production and re-run the same checks**

Use one known public video plus one different public Chinese video. Do not claim support from fixture-only tests.

- [ ] **Step 3: Record release evidence**

Report URLs, commit, extension SHA256, migration versions, test commands/results, real videos tested, provider result categories, known limitations, rollback reference, and explicit absence of other input sources.

- [ ] **Step 4: Final verification**

```bash
pnpm verify
pnpm db:test
pnpm build
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
git diff --check
```

Expected: all commands exit 0 and manual smoke checklist has no unchecked required item.

- [ ] **Step 5: Commit**

```bash
git add docs/operations/deployment.md docs/operations/demo-checklist.md docs/operations/release-report.md
git commit -m "docs: record Popcorn release verification"
```

## Delivery Exit Gate

- Web deployment, auth redirects, RLS, Cron, and provider keys are environment-separated.
- Provider snapshot terms review is complete and compatible.
- Packaged extension passes allowlist, permissions, secrets, attribution, and provenance checks.
- Seed scripts are deterministic and idempotent.
- Fixture-backed full acceptance and real-provider manual smoke tests both pass.
- The known-video cached path survives provider outage without losing raw saves.
- Release report includes exact commit, extension checksum, migrations, tests, limitations, and rollback.
