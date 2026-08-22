# Popcorn GitHub Personal-Use Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a reproducible personal-use GitHub release and demonstrate the complete local YouTube-to-owned learning loop to a professor.

**Architecture:** The official acceptance path runs Next.js, Supabase, and the durable-job trigger locally and loads a generated unpacked MV3 extension. Automated verification is fixture-only; after it passes, one manual smoke uses a real Mandarin YouTube video, Supadata, and the user's active OpenAI-compatible gateway.

**Tech Stack:** Node.js 20, pnpm 11.19.0, Docker/Supabase CLI, Next.js, Chrome MV3, Vitest, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-22-popcorn-local-first-school-demo-design.md`

## Authority and Global Constraints

- This plan replaces all Tasks 1-6 and the exit gate in
  `2026-08-16-popcorn-delivery-demo.md`.
- Delivery begins only after the revised Batch C gate passes.
- Tasks 1-6 run sequentially because packaging, seed, documentation,
  acceptance evidence, and release state overlap.
- Do not deploy Vercel, create preview/production Supabase projects, add an
  operator status API/logger platform, run load tests, or perform a formal
  backup/compliance/terms program.
- CI uses fixtures only. Real Supadata/model calls occur only in Task 5 and
  credentials never enter committed files or the release report.
- Preserve YouTube Digest MIT attribution and LLM Wiki GPLv3 method-only
  isolation in source and distribution.

---

### Task 1: Package and license the local extension/repository

**Files:**

- Create: `LICENSE`
- Create: `scripts/package-extension.sh`
- Create: `scripts/check-extension-release.sh`
- Create: `docs/operations/extension-install.md`
- Create: `docs/operations/upstream-provenance.md`
- Test: `tests/release/extension-package.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `pnpm extension:local`, stable public manifest key, exact generated
  origins, `extension/UPSTREAM.md`, and the pinned MIT license.
- Produces: deterministic `dist/popcorn-extension.zip`, unpacked directory, and
  `dist/popcorn-extension.sha256`.

**Upstream reuse:** Adapt the allowlisted packaging/check approach from
`zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
Include its MIT notice; do not copy non-allowlisted release prose/tests.

- [ ] **Step 1: Write the RED package audit**

Assert the archive contains runtime files, generated manifest/config, prompts,
icons, Popcorn root MIT license, YouTube Digest license, and provenance. Reject
tests, source maps, `.env*`, service/job/transcript/model keys, passwords,
tokens, direct Provider hosts, and any LLM Wiki code/prompt/component/asset.

- [ ] **Step 2: Run RED**

```bash
pnpm vitest run tests/release/extension-package.test.ts
```

Expected: packaging/check scripts, root license, and archive are absent.

- [ ] **Step 3: Implement allowlisted packaging and checks**

Use a temporary staging directory, explicit file allowlist, stable ordering,
and SHA-256. The root license is MIT. The checker must verify Chrome 116,
stable manifest key, exact YouTube/App/Supabase hosts, required Side Panel and
storage permissions, absence of the retired `identity` permission, and absence
of private credentials.

- [ ] **Step 4: Run GREEN, review, and commit**

```bash
pnpm extension:package
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
pnpm vitest run tests/release/extension-package.test.ts
pnpm test:provenance
git diff --check
```

Reviewer PASS requires a loadable archive, exact checksum, both MIT notices,
no GPL material, no secrets, and no hardcoded user environment.

### Task 2: Seed a short deterministic classroom demonstration

**Files:**

- Create: `scripts/seed-demo.ts`
- Create: `tests/fixtures/demo/youtube-video.ts`
- Create: `tests/fixtures/demo/transcript.zh-CN.json`
- Create: `tests/fixtures/demo/generated-artifacts.json`
- Create: `tests/integration/demo/demo-seed.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: one already-created local Supabase password account selected by
  email or UUID; migrations 001-016; fixture-only generated content. The script
  looks up the account and never creates credentials.
- Produces: one known video snapshot, short Chinese segments, grouped saves,
  one `tried`, one `reused`, one `owned` expression, one due task, and cached
  learning artifacts for the selected owner.

- [ ] **Step 1: Write RED seed tests**

Assert stable source/content IDs, ordered timestamped segments, exact owner on
every row, all three mastery states, one due task, no video bytes, no API key or
Provider response, and the same row counts/IDs after two runs.

- [ ] **Step 2: Run RED**

```bash
pnpm vitest run tests/integration/demo/demo-seed.test.ts
```

- [ ] **Step 3: Implement local-only idempotent seed**

Require an explicit local Supabase URL and target user. Refuse a non-loopback
database/API unless an explicit test-only injection is used. Never accept or
print an account password. Store only short necessary transcript fixture
excerpts with source URL and acquisition date; never store the video file.

- [ ] **Step 4: Run GREEN twice, review, and commit**

```bash
pnpm vitest run tests/integration/demo/demo-seed.test.ts
pnpm demo:seed -- --user learner@example.com
pnpm demo:seed -- --user learner@example.com
```

Reviewer PASS requires exact owner binding, idempotency, short fixture scope,
and zero live Provider/network dependency.

### Task 3: Write the fresh-clone personal self-host guide

**Files:**

- Create: `README.md`
- Create: `docs/operations/local-self-host.md`
- Create: `docs/operations/job-recovery.md`
- Create: `docs/operations/account-reset.md`
- Modify: `.env.example`
- Test: `tests/release/self-host-docs.test.ts`

**Interfaces:**

- Produces: one ordered path covering prerequisites, install, Supabase start
  and reset, local account creation, environment values, Web, `worker:local`,
  extension generation/load, gateway configuration, demo seed, troubleshooting,
  and shutdown.

- [ ] **Step 1: Write the RED documentation contract**

The test must require exact commands and explanations for:

```text
pnpm install --frozen-lockfile
pnpm exec supabase start
pnpm db:reset
pnpm dev
pnpm worker:local
pnpm extension:local
```

It must distinguish the public anon key from service-role, Supadata, job, and
user model keys; state that the model key is entered only in Web settings; name
`dist/popcorn-extension` for `chrome://extensions`; explain local Mailpit only
if email confirmation is enabled; and describe account reset through local
Supabase without promising an account-deletion UI.

- [ ] **Step 2: Run RED**

```bash
pnpm vitest run tests/release/self-host-docs.test.ts
```

- [ ] **Step 3: Write the minimum accurate guide**

List Node 20, pnpm 11.19.0, Docker, Supabase CLI through project dependencies,
and Chrome 116+. Document one supported local path and a short optional hosted
note only; do not add Vercel, production hardening, SLO, backup rehearsal,
firewall, quota, or operator-dashboard instructions.

- [ ] **Step 4: Execute every read-only/setup-safe documented command, review, and commit**

Run the commands against a disposable local Supabase state where needed. The
reviewer must compare docs to actual script names, ports, required values, auth
mode, extension output, worker behavior, and Provider prerequisites.

### Task 4: Run fixture-backed fresh-clone acceptance and slim CI

**Files:**

- Create: `tests/e2e/demo-acceptance.spec.ts`
- Create: `docs/operations/demo-checklist.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `playwright.config.ts` only if the existing persistent-Chromium
  project cannot load `dist/popcorn-extension`.
- Test: `tests/release/ci-scope.test.ts`

**Interfaces:**

- Produces: one fresh-clone fixture proof covering account, extension, known
  video transcript/language modes, noninterrupting save, Saved, Use It Now,
  Vault/search, Due Practice, Progress, and worker restart recovery.

- [ ] **Step 1: Write RED acceptance and CI-scope tests**

The E2E must use fixtures and persistent Chrome. The CI test must require
fixture mode, install/verify/extension checks, clean Supabase migration/test,
and patch whitespace; it must reject live credentials and the three standalone
concurrency scripts on every push.

- [ ] **Step 2: Run RED**

```bash
pnpm vitest run tests/release/ci-scope.test.ts
pnpm playwright test tests/e2e/demo-acceptance.spec.ts --project=chromium-extension
```

- [ ] **Step 3: Implement only the complete happy path and one recovery proof**

Reuse the accepted Batch A/B/C E2E helpers and queue tests. Do not create
parallel live-save, deletion, offline, multi-video, load, or browser-matrix
suites.

- [ ] **Step 4: Verify from a clean checkout/worktree**

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:extension
pnpm exec supabase start
pnpm db:reset
pnpm db:test
pnpm extension:package
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
pnpm playwright test tests/e2e/demo-acceptance.spec.ts --project=chromium-extension
git diff --check
```

Run the already-recorded gateway/due concurrency scripts only if their
migrations changed after their accepted proof. Reviewer PASS requires all
commands above, no live network dependency, and a reproducible clean-checkout
result.

### Task 5: Perform one real local YouTube and model-gateway smoke

**Files:**

- Modify: `docs/operations/demo-checklist.md`
- Create: `docs/operations/release-report.md`

**Interfaces:**

- Consumes: real `SUPADATA_API_KEY`, one user-entered gateway name/base
  URL/model/API key, the packaged extension, and one public Mandarin YouTube
  watch URL.
- Produces: credential-free manual evidence with date, video ID, gateway display
  name/model, result categories, and observed product behavior.

- [ ] **Step 1: Preflight without exposing credentials**

Confirm environment variables are present by boolean/length only, the active
gateway settings view reports `hasApiKey: true`, local worker is running, and
the fixture acceptance gate has passed. Do not print environment values.

- [ ] **Step 2: Run the real smoke once**

On one public Mandarin YouTube video, verify native Chinese transcript,
Chinese/English/bilingual display, one background save with uninterrupted
playback, one completed Overview/translation/explanation or Practice model
request, the Saved record, and visible downstream learning state. Interrupt and
restart the local worker once if not already manually covered by Task 4.

- [ ] **Step 3: Record bounded evidence**

Record commit, migrations 015-016 presence, extension SHA-256, test commands, public
video ID/date, gateway display name/model, success/failure categories, and
known limitations. Do not record the transcript in full, Provider response,
base URL if the user treats it as private, API key, tokens, cookies, request
bodies, or Supabase service credentials.

- [ ] **Step 4: Independent read-only release review**

Reviewer returns PASS only if the evidence proves a real video and a real user
gateway after fixture acceptance while preserving secret and product scope.
External Provider failure is a genuine Task 5 blocker, not a reason to weaken
fixture tests.

### Task 6: Integrate and publish the GitHub demo release

**Ownership:** Controller only; no feature agent edits integration state.

**Files:**

- Modify: `docs/engineering/execution-ledger.md`
- Create: `docs/engineering/checkpoints/delivery.md`
- Modify: `docs/operations/release-report.md`

**Interfaces:**

- Consumes: accepted Delivery Tasks 1-5, hosted GitHub CI, clean integration
  branch, root MIT license, and release checksum.
- Produces: GitHub `main` containing the accepted product and one annotated demo
  tag, with no implementation performed directly on `main`.

- [ ] **Step 1: Run final verification at the exact release commit**

```bash
pnpm verify
pnpm test:extension
pnpm db:reset
pnpm db:test
pnpm extension:package
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
pnpm playwright test tests/e2e/demo-acceptance.spec.ts --project=chromium-extension
pnpm test:provenance
git diff --check
git status --short
```

Expected: every command exits 0 and the worktree is clean. This is the one final
broad gate; do not add load/commercial deployment checks.

- [ ] **Step 2: Final full-diff reviewer gate**

Review from the recorded project baseline to release HEAD for product scope,
fresh-clone accuracy, secrets, owner/RLS/idempotency/queue recovery, gateway
configuration, upstream reuse, licensing, fixtures, and manual evidence.

- [ ] **Step 3: Publish without implementing on main**

After reviewer PASS and hosted fixture CI PASS, integrate the reviewed branch
into local `main`, push `main` to `LLLJJJcon/popcorn.git`, create an annotated
demo tag at the verified commit, and push that tag. Do not force-push or rewrite
unrelated history.

- [ ] **Step 4: Record release checkpoint**

Record exact commit/tag/checksum/CI URL or run identifier, commands, manual
video/date, known limitations, and zero unchecked required demo items.

## Revised Delivery Exit Gate

- README fresh-clone instructions work on the reference local topology.
- The unpacked and zipped extension have stable identity, exact origins,
  required notices, checksum, and no private credential.
- Demo seed is owner-bound, short, fixture-only, and idempotent.
- Fixture CI and one clean-checkout complete learning-loop E2E pass.
- One real Mandarin YouTube and one real user-configured gateway smoke pass.
- GitHub `main` and the demo tag point to the independently reviewed release
  commit.
