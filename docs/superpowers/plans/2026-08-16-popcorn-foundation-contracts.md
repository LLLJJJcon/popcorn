# Popcorn Foundation and Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the reproducible web, extension, API, database, security, job, and three-state mastery contracts required by every later Popcorn feature.

**Architecture:** Keep the Next.js App Router web/API application at the repository root and add a plain Manifest V3 extension under `extension/`. Supabase Auth/PostgreSQL/RLS is the durable boundary; extension requests are fast and idempotent, while provider work uses leased `knowledge_jobs` recovered by Supabase Cron.

**Tech Stack:** Next.js, TypeScript, pnpm, Zod, Supabase Auth/PostgreSQL/Cron, Chrome Manifest V3, Vitest, Testing Library, Playwright.

## Global Constraints

- Canonical product spec: `docs/superpowers/specs/2026-08-16-popcorn-desktop-web-design.md`.
- Extension support starts at Chrome 116; web support starts at 1024 pixels.
- Native language is fixed to `en`; target language is fixed to `zh-CN`.
- The first release accepts only standard public YouTube watch pages with native Simplified Chinese subtitles.
- Mastery states are exactly `tried`, `reused`, and `owned`; saving or viewing content is never mastery evidence.
- Every user-owned database row carries `user_id`; every public table enables RLS.
- Provider keys and the Supabase service-role key are server-only.
- Long provider work never runs in an extension request or depends on a live service worker.
- Pasted text, generic URL, image, screenshot, pgvector, graph, advanced Progress, and export are outside this plan.
- Root configuration, shared contracts, migrations, generated database types, and upstream provenance are primary-Agent-owned after this plan.

## Upstream Reuse Contract

| Repository | Pinned ref | Use in this plan | License action |
|---|---|---|---|
| `zarazhangrui/youtube-digest` | `d03e1f61e017b032159ffd1821cac6e7693ce0c7` | Vendor the listed extension source and tests before any extension feature work. | Preserve its MIT license and copyright notice. |
| `nashsu/llm_wiki` | `v0.6.9`, commit `723e259309aea5e3850265b631f80224f66dd9f6` | Record method provenance only: immutable raw sources, two-stage organization, traceability, incremental cache, durable review. | Do not copy GPLv3 implementation code. |

## Planned File Map

```text
package.json                                shared scripts and dependency boundary
extension/                                 pinned YouTube Digest intake target
extension/UPSTREAM.md                      exact source-to-target provenance
third_party/youtube-digest/LICENSE         required MIT notice
THIRD_PARTY_NOTICES.md                     distributable attribution
scripts/vendor-youtube-digest.sh           reproducible pinned intake
src/contracts/api.ts                       stable API envelopes and error codes
src/contracts/source.ts                    video, snapshot, transcript, and save types
src/contracts/knowledge.ts                 artifacts, candidates, and durable job types
src/contracts/practice.ts                  task, evaluation, and attempt types
src/contracts/memory.ts                    mastery and review types
src/server/domain/mastery.ts               deterministic three-state transition
src/server/domain/schedule-review.ts        deterministic due-date policy
src/server/domain/lease-job.ts              pure durable-job lease rules
supabase/migrations/202608160001_schema.sql core data model and indexes
supabase/migrations/202608160002_rls.sql    ownership and append-only policies
supabase/migrations/202608160003_cron.sql   scheduled recovery hook
supabase/tests/rls.sql                      cross-user and append-only proof
tests/provenance/                           upstream pin and license proof
```

### Task 1: Scaffold the web baseline and reproducible upstream intake

**Files:**

- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/test/setup.ts`
- Create: `.env.example`
- Create: `scripts/vendor-youtube-digest.sh`
- Create: `extension/UPSTREAM.md`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `tests/provenance/youtube-digest.test.ts`
- Test: `src/app/page.test.tsx`

**Interfaces:**

- Consumes: pinned upstream Git commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
- Produces: root scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:unit`, `test:contract`, `test:integration`, `test:provenance`, `test:e2e`, `verify`, `db:reset`, and `db:test`; vendored `extension/`; verified MIT attribution.

- [ ] **Step 1: Scaffold Next.js without overwriting documents**

Run from a temporary directory and copy only generated application/configuration files:

```bash
pnpm create next-app@latest popcorn-app --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

Expected: the temporary app builds; existing `docs/` and report artifacts remain untouched.

- [ ] **Step 2: Install the minimum foundation libraries**

```bash
pnpm add zod @supabase/ssr @supabase/supabase-js @tanstack/react-query openai
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test supabase
```

Expected: dependencies are locked in `pnpm-lock.yaml`; no vector, image-ingestion, or alternate-browser dependency is added.

- [ ] **Step 3: Write failing product and provenance tests**

Create `src/app/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

test("describes the YouTube-to-reuse loop", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", {
    name: "Turn Chinese videos into language you can use",
  })).toBeInTheDocument();
});
```

Create `tests/provenance/youtube-digest.test.ts`:

```ts
import { readFileSync } from "node:fs";

test("pins and attributes the YouTube Digest intake", () => {
  const upstream = readFileSync("extension/UPSTREAM.md", "utf8");
  const license = readFileSync("third_party/youtube-digest/LICENSE", "utf8");
  expect(upstream).toContain("d03e1f61e017b032159ffd1821cac6e7693ce0c7");
  expect(upstream).toContain("content.js");
  expect(upstream).toContain("sidepanel.js");
  expect(license).toContain("MIT License");
  expect(license).toContain("Copyright (c) 2026 Zara Zhang");
});
```

Run:

```bash
pnpm vitest run src/app/page.test.tsx tests/provenance/youtube-digest.test.ts
```

Expected: FAIL because the product heading and vendored source do not exist.

- [ ] **Step 4: Add the pinned vendor script**

Create `scripts/vendor-youtube-digest.sh` with this behavior and exact allowlist:

```bash
#!/usr/bin/env bash
set -euo pipefail

readonly UPSTREAM_URL="https://github.com/zarazhangrui/youtube-digest.git"
readonly UPSTREAM_COMMIT="d03e1f61e017b032159ffd1821cac6e7693ce0c7"
readonly TASK_TMP_DIR="$(mktemp -d /tmp/popcorn-youtube-digest.XXXXXX)"
trap 'rm -rf "$TASK_TMP_DIR"' EXIT

git clone --quiet "$UPSTREAM_URL" "$TASK_TMP_DIR/repo"
git -C "$TASK_TMP_DIR/repo" checkout --quiet "$UPSTREAM_COMMIT"
test "$(git -C "$TASK_TMP_DIR/repo" rev-parse HEAD)" = "$UPSTREAM_COMMIT"

mkdir -p extension/icons extension/prompts extension/tests third_party/youtube-digest
for file in manifest.json background.js content.js settings.js sidepanel.html sidepanel.css sidepanel.js options.html options.css options.js; do
  install -m 0644 "$TASK_TMP_DIR/repo/$file" "extension/$file"
done
for file in analysis.md explain.md note-cleanup.md translation.md; do
  install -m 0644 "$TASK_TMP_DIR/repo/prompts/$file" "extension/prompts/$file"
done
for file in digest-button.test.js options-language.test.js release.test.js settings.test.js transcript-selection.test.js translation.test.js; do
  install -m 0644 "$TASK_TMP_DIR/repo/tests/$file" "extension/tests/$file"
done
for file in icon16.png icon48.png icon128.png; do
  install -m 0644 "$TASK_TMP_DIR/repo/icons/$file" "extension/icons/$file"
done
install -m 0644 "$TASK_TMP_DIR/repo/LICENSE" third_party/youtube-digest/LICENSE
```

`extension/UPSTREAM.md` must list every copied path, the source commit, target path, reuse mode, expected Popcorn adaptation, and its owning future task. `THIRD_PARTY_NOTICES.md` must point to the preserved MIT license.

Run:

```bash
bash scripts/vendor-youtube-digest.sh
```

Expected: only allowlisted upstream files appear; `git rev-parse` verification prevents a floating intake.

- [ ] **Step 5: Implement the minimum page and shared test setup**

Set `src/app/page.tsx` to:

```tsx
export default function HomePage() {
  return <main><h1>Turn Chinese videos into language you can use</h1></main>;
}
```

Configure Vitest for jsdom, `@/`, and `src/test/setup.ts` importing `@testing-library/jest-dom/vitest`.

- [ ] **Step 6: Verify the foundation intake**

```bash
pnpm vitest run src/app/page.test.tsx tests/provenance/youtube-digest.test.ts
pnpm lint
pnpm typecheck
pnpm build
bash -n scripts/vendor-youtube-digest.sh
```

Expected: every command exits 0; `git diff -- extension/` shows upstream source rather than newly generated equivalents.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts vitest.config.ts playwright.config.ts src .env.example scripts/vendor-youtube-digest.sh extension third_party THIRD_PARTY_NOTICES.md tests/provenance
git commit -m "build: scaffold Popcorn and vendor YouTube Digest"
```

### Task 2: Define environment, API, source, knowledge, and learning contracts

**Files:**

- Create: `src/server/env.ts`
- Create: `src/contracts/api.ts`
- Create: `src/contracts/source.ts`
- Create: `src/contracts/knowledge.ts`
- Create: `src/contracts/practice.ts`
- Create: `src/contracts/memory.ts`
- Create: `src/contracts/index.ts`
- Create: `src/server/api/respond.ts`
- Create: `tests/factories/source.ts`
- Create: `tests/factories/practice.ts`
- Test: `tests/contract/shared-contracts.test.ts`
- Test: `src/server/env.test.ts`
- Test: `src/server/api/respond.test.ts`

**Interfaces:**

- Consumes: product-spec field names and fixed `en`/`zh-CN` language boundary.
- Produces: `ApiSuccess<T>`, `ApiFailure`, `VideoSource`, `VideoSnapshot`, `TranscriptSegment`, `SavedItem`, `SavedItemInput`, `GeneratedArtifact`, `KnowledgeJob`, `CandidateExpression`, `PracticeTask`, `EvaluationResult`, `AttemptRecorded`, `MasteryState`, and `ReviewTask`.

- [ ] **Step 1: Write failing API and source-contract tests**

Use these required assertions:

```ts
expect(SavedItemInputSchema.parse({
  clientEventId: "00000000-0000-4000-8000-000000000101",
  youtubeVideoId: "dQw4w9WgXcQ",
  kind: "subtitle_selection",
  capturedAt: "2026-08-16T10:00:00.000Z",
  startSeconds: 42,
  endSeconds: 48,
  originalChinese: "这也太离谱了吧。",
  englishTranslation: "That is way too absurd.",
  segmentIds: ["seg-42"],
  startOffset: 0,
  endOffset: 9,
  contextBefore: ["你刚才看到了吗？"],
  contextAfter: ["我完全没想到。"],
})).toMatchObject({ kind: "subtitle_selection" });

expect(MasteryStateSchema.options).toEqual(["tried", "reused", "owned"]);
```

Also assert rejection of arbitrary URLs, missing exact quote text, more than three candidates, non-English explanations, and `seen` or `understood` mastery.

Run:

```bash
pnpm vitest run tests/contract/shared-contracts.test.ts src/server/env.test.ts src/server/api/respond.test.ts
```

Expected: FAIL because contracts do not exist.

- [ ] **Step 2: Implement stable API envelopes and errors**

```ts
export type ApiSuccess<T> = { ok: true; data: T; requestId: string };
export type ApiFailure = {
  ok: false;
  error: {
    code: "AUTH_REQUIRED" | "SESSION_EXPIRED" | "FORBIDDEN" |
      "INVALID_YOUTUBE_VIDEO" | "NATIVE_CHINESE_TRANSCRIPT_REQUIRED" |
      "TRANSCRIPT_UNAVAILABLE" | "SYNC_QUEUE_FULL" |
      "IDEMPOTENCY_CONFLICT" | "PROVIDER_RATE_LIMITED" |
      "PROVIDER_UNAVAILABLE" | "PROVIDER_OUTPUT_INVALID" |
      "JOB_LEASE_CONFLICT" | "JOB_RETRY_EXHAUSTED" |
      "VALIDATION_FAILED" | "CONFLICT" | "INTERNAL_ERROR";
    message: string;
    retryable: boolean;
    fieldErrors?: Record<string, string[]>;
  };
  requestId: string;
};
```

- [ ] **Step 3: Implement strict Zod domain contracts**

Define exact enums:

```ts
export const SavedItemKindSchema = z.enum([
  "video", "player_moment", "subtitle_row", "subtitle_selection",
  "key_quote", "ai_explanation",
]);
export const SavedItemStatusSchema = z.enum([
  "saved", "resolving_source", "organizing", "ready", "unsupported", "failed",
]);
export const KnowledgeJobStatusSchema = z.enum([
  "pending", "leased", "succeeded", "retryable_failed", "terminal_failed",
]);
export const KnowledgeJobTypeSchema = z.enum([
  "resolve_snapshot", "generate_overview", "translate_segments",
  "explain_selection", "analyze_saved_item",
]);
export const MasteryStateSchema = z.enum(["tried", "reused", "owned"]);
```

`SavedItemInputSchema` must use a discriminated union so `key_quote` requires `exactQuote`, `ai_explanation` requires `selectedChinese` plus `englishExplanation`, and subtitle selections require stable segment IDs and character offsets.

`CandidateExpressionSchema` requires Simplified Chinese expression, English meaning, English explanation, tone, communicative function, register, exact evidence text, segment IDs, timestamp range, and confidence `0..1`.

- [ ] **Step 4: Define server environment requirements**

Require:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPADATA_API_KEY
OPENAI_API_KEY
OPENAI_MODEL
APP_URL
EXTENSION_REDIRECT_ORIGIN
INTERNAL_JOB_SECRET
```

Do not include an embedding model or dimensions. `.env.example` leaves credentials empty and documents that no provider key enters the extension.

- [ ] **Step 5: Add deterministic factories and verify**

Factories use fixed UUIDs, ISO dates, YouTube IDs, and Chinese fixtures; they never use randomness or current time.

```bash
pnpm vitest run tests/contract/shared-contracts.test.ts src/server/env.test.ts src/server/api/respond.test.ts
pnpm typecheck
```

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/contracts src/server/env.ts src/server/env.test.ts src/server/api tests/factories tests/contract/shared-contracts.test.ts .env.example
git commit -m "feat: freeze YouTube learning contracts"
```

### Task 3: Create the database schema, indexes, and RLS

**Files:**

- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608160001_schema.sql`
- Create: `supabase/migrations/202608160002_rls.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/rls.sql`
- Create: `src/types/database.generated.ts`

**Interfaces:**

- Consumes: Task 2 field names and enums.
- Produces: `profiles`, `video_sources`, `video_snapshots`, `transcript_segments`, `saved_items`, `generated_artifacts`, `knowledge_jobs`, `expression_senses`, `expression_occurrences`, `user_expressions`, `practice_tasks`, `attempts`, `mastery_events`, and `review_tasks`.

- [ ] **Step 1: Write failing RLS and constraint assertions**

Create two deterministic users. Assert user B cannot select, insert, update, or delete user A source, snapshot, segment, save, artifact, job, expression, attempt, or review task. Assert a client cannot update or delete `mastery_events`.

Run:

```bash
pnpm exec supabase init
pnpm db:reset
pnpm db:test
```

Expected: FAIL because tables and policies do not exist.

- [ ] **Step 2: Implement schema invariants**

The migration must include these exact uniqueness and status rules:

```sql
create extension if not exists pg_trgm;

create unique index video_sources_user_video_unique
  on video_sources (user_id, youtube_video_id);
create unique index saved_items_user_event_unique
  on saved_items (user_id, client_event_id);
create unique index video_snapshots_source_hash_unique
  on video_snapshots (video_source_id, transcript_hash);
create unique index transcript_segments_snapshot_stable_unique
  on transcript_segments (snapshot_id, stable_id);
create unique index generated_artifacts_user_result_unique
  on generated_artifacts (user_id, artifact_type, result_key);
create unique index knowledge_jobs_user_dedupe_unique
  on knowledge_jobs (user_id, job_type, dedupe_key);

alter table user_expressions add constraint mastery_state_check
  check (mastery_state in ('tried', 'reused', 'owned'));
alter table saved_items add constraint saved_item_status_check
  check (status in ('saved', 'resolving_source', 'organizing', 'ready', 'unsupported', 'failed'));
alter table knowledge_jobs add constraint knowledge_job_status_check
  check (status in ('pending', 'leased', 'succeeded', 'retryable_failed', 'terminal_failed'));
alter table knowledge_jobs add constraint knowledge_job_type_check
  check (job_type in ('resolve_snapshot', 'generate_overview', 'translate_segments',
    'explain_selection', 'analyze_saved_item'));
```

Every user-owned table has `user_id uuid not null`, `created_at timestamptz not null default now()`, and appropriate updated timestamps. `transcript_segments` stores ordinal, stable ID, original text, start/end seconds, language, and snapshot ID. `generated_artifacts.result_key` and `knowledge_jobs.dedupe_key` are non-null hashes over the documented source/payload/prompt/model inputs. Raw source and mastery history are append-only from client roles.

- [ ] **Step 3: Add retrieval and job indexes**

Add indexes for `saved_items(user_id, video_source_id, start_seconds)`, `knowledge_jobs(status, next_attempt_at, lease_expires_at)`, `review_tasks(user_id, due_at, status)`, normalized expression text, and a GIN trigram index over Simplified Chinese expression text. Do not enable `vector`.

- [ ] **Step 4: Implement RLS**

Enable RLS on every public table. Duplicate `user_id` on child records so policies use `(select auth.uid()) = user_id` without deep joins. Apply `to authenticated` and explicit `with check` clauses. Service-role workers are server-only and must still filter every operation by job `user_id`.

- [ ] **Step 5: Seed fixtures and generate types**

Seed two users, one Chinese YouTube source/snapshot for user A, three timestamped transcript segments, and no data for user B.

```bash
pnpm db:reset
pnpm db:test
pnpm exec supabase gen types typescript --local > src/types/database.generated.ts
pnpm typecheck
```

Expected: reset succeeds, RLS assertions pass, and generated types compile.

- [ ] **Step 6: Commit**

```bash
git add supabase src/types/database.generated.ts package.json pnpm-lock.yaml
git commit -m "feat: add secure YouTube learning schema"
```

### Task 4: Implement deterministic mastery, scheduling, and job leasing

**Files:**

- Create: `src/server/domain/mastery.ts`
- Create: `src/server/domain/schedule-review.ts`
- Create: `src/server/domain/lease-job.ts`
- Test: `src/server/domain/mastery.test.ts`
- Test: `src/server/domain/schedule-review.test.ts`
- Test: `src/server/domain/lease-job.test.ts`

**Interfaces:**

- Produces: `advanceMastery(current, evidence): MasteryState`, `scheduleReview(input): ReviewSchedule`, `leaseJob(job, now): LeaseDecision`, and `nextJobFailure(job, error, now): KnowledgeJobState`.

- [ ] **Step 1: Write failing mastery tests**

Assert:

```ts
expect(advanceMastery(null, { kind: "valid_original_attempt" })).toBe("tried");
expect(advanceMastery("tried", { kind: "successful_independent_transfer" })).toBe("reused");
expect(advanceMastery("reused", {
  kind: "owned_threshold_met",
  distinctContexts: 2,
  distinctUtcDates: 2,
  includesDuePractice: true,
})).toBe("owned");
expect(advanceMastery("reused", { kind: "saved_item_created" })).toBe("reused");
```

Also prove weak later evidence never lowers the highest state.

- [ ] **Step 2: Implement the pure transition**

The function accepts only server-generated evidence union members. It reads no clock, database, client-requested target state, or AI-proposed mastery.

- [ ] **Step 3: Write and implement scheduling tests**

At fixed `2026-08-16T00:00:00.000Z`, assert first `tried` and failed/heavily assisted reuse are due in one day, successful independent reuse in seven days, and `owned` maintenance in thirty days. Implement with UTC millisecond arithmetic.

- [ ] **Step 4: Write and implement job-lease tests**

Prove only `pending`, due `retryable_failed`, or expired `leased` jobs can be leased; a lease expires after a fixed duration; retry uses bounded exponential backoff; the final allowed attempt becomes `terminal_failed`; result keys are deterministic from job type, source hash, saved-item hash, prompt version, and model version.

```bash
pnpm vitest run src/server/domain/mastery.test.ts src/server/domain/schedule-review.test.ts src/server/domain/lease-job.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/domain
git commit -m "feat: add deterministic mastery and job rules"
```

### Task 5: Add scheduled recovery, CI, and the frozen ownership boundary

**Files:**

- Create: `supabase/migrations/202608160003_cron.sql`
- Create: `.github/workflows/ci.yml`
- Create: `docs/engineering/agent-boundaries.md`
- Create: `docs/engineering/upstream-reuse-policy.md`
- Modify: `package.json`
- Test: `tests/provenance/no-llm-wiki-code.test.ts`

**Interfaces:**

- Consumes: Tasks 1-4.
- Produces: a frozen baseline and a scheduled HTTPS recovery call to the future internal job endpoint.

- [ ] **Step 1: Write the failing license-boundary test**

```ts
import { readFileSync } from "node:fs";

test("documents LLM Wiki as method-only provenance", () => {
  const policy = readFileSync("docs/engineering/upstream-reuse-policy.md", "utf8");
  expect(policy).toContain("723e259309aea5e3850265b631f80224f66dd9f6");
  expect(policy).toContain("MUST NOT copy GPLv3 implementation code");
});
```

Run `pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts`.

Expected: FAIL because the policy does not exist.

- [ ] **Step 2: Add the Cron migration**

Use Supabase Vault-backed secrets and `pg_net` to call `POST /api/internal/jobs/process` every minute. The migration must not embed `INTERNAL_JOB_SECRET`; deployment documentation supplies it through Vault. The internal endpoint is implemented in Batch B and must return quickly after leasing a bounded batch.

- [ ] **Step 3: Freeze ownership and upstream rules**

Document that `src/contracts/**`, `supabase/migrations/**`, `src/types/database.generated.ts`, root config, vendor script, upstream notices, and shared error codes are primary-Agent-only during parallel batches. Require every extension task to name source repo, pin, source file/function, target file, adaptation, license action, and reused test.

- [ ] **Step 4: Add CI gates**

CI runs install, lint, typecheck, unit/contract/provenance tests, web build, Supabase reset, RLS tests, vendor-script syntax, `git diff --check`, and an extension static check. It does not call live providers.

- [ ] **Step 5: Run the complete freeze gate**

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm db:reset
pnpm db:test
pnpm build
bash -n scripts/vendor-youtube-digest.sh
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202608160003_cron.sql .github/workflows/ci.yml docs/engineering package.json pnpm-lock.yaml tests/provenance
git commit -m "ci: freeze YouTube foundation contracts"
```

## Foundation Exit Gate

Do not start Batch A until all of the following are recorded in the execution ledger:

- the pinned YouTube Digest files exist and provenance tests pass;
- no LLM Wiki code was copied;
- shared schemas expose exact save payloads and only three mastery states;
- database uniqueness, append-only history, RLS, and job indexes pass from a clean reset;
- mastery, scheduling, and lease rules pass with fixed time;
- CI, build, and provenance gates are green;
- migrations and shared contracts are frozen for feature agents.
