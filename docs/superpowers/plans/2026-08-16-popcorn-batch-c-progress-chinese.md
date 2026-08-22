# Popcorn Batch C Retrieval, Progress, and Resilience Implementation Plan

> **Revised for uncompleted Tasks 2-6 on 2026-08-22:** Use
> `2026-08-22-popcorn-batch-c-school-demo-revision.md`. Task 1 remains accepted;
> conflicting account-deletion, full-site accessibility, repeated full-suite,
> and duplicate E2E requirements below are no longer current gates.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete reliable Chinese expression retrieval, independent reuse, basic evidence-based Progress, explicit deletion, and cross-surface resilience without expanding first-release scope.

**Architecture:** PostgreSQL exact/substring/trigram retrieval replaces the previous pgvector plan. Progress reads append-only attempts and mastery events; deletion separates raw learning sources from retained evidence; extension and web share clear recovery states.

**Tech Stack:** PostgreSQL/pg_trgm, Next.js, Supabase RLS, React, Vitest, Playwright, Chrome extension tests.

## Global Constraints

- Batch B exit gate must be green.
- No pgvector, embeddings, graph, semantic recommendation, Expression Health Check, or advanced analytics.
- Chinese search uses normalized Simplified Chinese, substring/trigram matching, and explicit metadata filters.
- AI can generate practice content but cannot choose mastery or due dates.
- Progress reports practice evidence, not save volume as achievement.
- Deleting a source never silently deletes attempts or mastery history.
- All extension behavior continues from the pinned YouTube Digest adaptation; do not create a replacement extension UI.

### Task 1: Implement first-release Chinese expression retrieval

**Files:**

- Create: `src/features/vault/search-schema.ts`
- Create: `src/server/repositories/expression-search-repository.ts`
- Create: `src/features/vault/vault-search.tsx`
- Modify: `src/app/api/v1/vault/route.ts`
- Test: `src/server/repositories/expression-search-repository.test.ts`
- Test: `src/features/vault/vault-search.test.tsx`

**Interfaces:**

- Consumes: normalized expression text, English meaning, function, register, video source, mastery, and date.
- Produces: `searchExpressions(userId, query): ExpressionSearchResult[]` ordered by exact match, prefix/substring, trigram similarity, then recency.

**LLM Wiki method adaptation:** Implement staged retrieval in relational form only: structured filters first, lexical match second, source-overlap presentation third. Do not copy LLM Wiki search, graph, LanceDB, chunk, or ranking code.

- [ ] **Step 1: Write failing Chinese retrieval tests**

Cover exact `太离谱了`, substring `离谱`, typo-near trigram, English meaning `absurd`, communicative function `reaction`, video filter, user isolation, and empty query. Prove another user's closer match never appears.

- [ ] **Step 2: Implement normalized lexical queries**

Normalize whitespace and punctuation without changing meaningful Chinese characters. Use equality and `ILIKE` before `similarity`; bind parameters; require `user_id` in every query; cap results and return match reason.

- [ ] **Step 3: Implement accessible search UI**

Debounce only the browser request, not repository correctness. Expose text, meaning, source count, mastery, and match reason. Keyboard navigation and clear-filter behavior are required.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run src/server/repositories/expression-search-repository.test.ts src/features/vault/vault-search.test.tsx
pnpm db:test
git add src/features/vault src/server/repositories/expression-search-repository.ts src/app/api/v1/vault
git commit -m "feat: add bounded Chinese expression search"
```

### Task 2: Implement due Practice and evidence-driven mastery advancement

**Files:**

- Create: `src/server/domain/create-transfer-task.ts`
- Create: `src/server/domain/complete-due-practice.ts`
- Modify: `src/features/practice/due-practice.tsx`
- Modify: `src/app/api/v1/practice/due/route.ts`
- Create: `src/app/api/v1/practice/due/[reviewTaskId]/route.ts`
- Test: `tests/integration/practice/due-transfer.test.ts`
- Test: `src/server/domain/complete-due-practice.test.ts`

**Interfaces:**

- Consumes: due review task, expression knowledge, prior contexts, learner response, assistance level, evaluation.
- Produces: new-context task, attempt, mastery event, and rescheduled review.

- [ ] **Step 1: Write failing transfer tests**

Assert a due task differs meaningfully from the original saved context, withholds a complete answer, records assistance, advances `tried -> reused` only after successful independent evidence, and advances `reused -> owned` only with two contexts on separate UTC dates including a due task.

- [ ] **Step 2: Implement context guardrails**

Pass prior context summaries to AI, validate the new task is not a copy, and fall back to a deterministic fixture when provider output is invalid. AI output cannot contain mastery or due fields.

- [ ] **Step 3: Implement atomic completion**

Lock the due task, reject stale/double completion, store attempt/evaluation, call pure mastery/schedule rules, append evidence, and create the next review in one transaction.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run tests/integration/practice/due-transfer.test.ts src/server/domain/complete-due-practice.test.ts
pnpm db:test
git add src/server/domain src/features/practice src/app/api/v1/practice/due tests/integration/practice
git commit -m "feat: advance mastery through due Practice"
```

### Task 3: Build basic evidence-based Progress

**Files:**

- Create: `src/server/repositories/progress-repository.ts`
- Create: `src/features/progress/schema.ts`
- Create: `src/features/progress/progress-dashboard.tsx`
- Create: `src/app/api/v1/progress/route.ts`
- Create: `src/app/(app)/progress/page.tsx`
- Test: `tests/integration/progress/progress-summary.test.ts`
- Test: `src/features/progress/progress-dashboard.test.tsx`

**Interfaces:**

- Produces: weekly attempt count, due completion count, independent reuse count, due Practice count, and `tried/reused/owned` distribution.

- [ ] **Step 1: Write failing aggregation tests**

Use fixed UTC boundaries. Assert saves and explanation views do not increase practice metrics; assisted attempts count as attempts but not independent reuse; highest mastery and recent performance remain distinct; user A cannot affect user B totals.

- [ ] **Step 2: Implement bounded aggregation**

Derive all values from attempts, review tasks, user expressions, and append-only mastery events. Do not materialize unverifiable client counters.

- [ ] **Step 3: Implement the minimal dashboard**

Show four summary values and the three-state distribution. Do not add streaks, health scores, leaderboards, graphs requiring a new visualization library, or saved-item counts as success.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run tests/integration/progress/progress-summary.test.ts src/features/progress/progress-dashboard.test.tsx
git add src/server/repositories/progress-repository.ts src/features/progress src/app/api/v1/progress src/app/'(app)'/progress tests/integration/progress
git commit -m "feat: show evidence-based learning progress"
```

### Task 4: Implement source deletion and account deletion safely

**Files:**

- Create: `src/server/domain/plan-source-deletion.ts`
- Create: `src/server/domain/delete-source.ts`
- Create: `src/server/domain/delete-account.ts`
- Create: `src/features/saved/delete-source-dialog.tsx`
- Create: `src/features/profile/delete-account-dialog.tsx`
- Create: `src/app/api/v1/saved/[videoSourceId]/delete-preview/route.ts`
- Create: `src/app/api/v1/saved/[videoSourceId]/route.ts`
- Create: `src/app/api/v1/account/route.ts`
- Test: `tests/integration/deletion/source-deletion.test.ts`
- Test: `tests/integration/deletion/account-deletion.test.ts`

**Interfaces:**

- Produces: `planSourceDeletion(userId, sourceId): DeletionImpact` and explicit deletion modes `remove_unpracticed_source` or `remove_source_keep_evidence`.

- [ ] **Step 1: Write failing deletion-impact tests**

Assert unpracticed source deletion removes derived candidates/artifacts. Practiced source deletion reports affected expressions and, by default, removes source body/occurrences while retaining attempts/mastery with `source_deleted`. Cross-user deletion and ambiguous mode are rejected.

- [ ] **Step 2: Implement preview-before-delete**

The dialog names the video, saved-item count, and affected learned expressions. It never uses a generic confirmation for practiced evidence.

- [ ] **Step 3: Implement transactional deletion modes**

Delete only user-scoped rows. Preserve append-only learning evidence under the keep-evidence mode. Account deletion removes all user-owned source, generated knowledge, attempts, mastery, reviews, profile, and extension-link records.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run tests/integration/deletion src/features/saved/delete-source-dialog.test.tsx src/features/profile/delete-account-dialog.test.tsx
pnpm db:test
git add src/server/domain src/features/saved src/features/profile src/app/api/v1/saved src/app/api/v1/account tests/integration/deletion
git commit -m "feat: delete sources without losing evidence silently"
```

### Task 5: Harden extension and web recovery/accessibility states

**Files:**

- Modify: `extension/sidepanel.html`
- Modify: `extension/sidepanel.css`
- Modify: `extension/sidepanel.js`
- Modify: `extension/options.html`
- Modify: `extension/options.js`
- Create: `src/components/states/loading-state.tsx`
- Create: `src/components/states/empty-state.tsx`
- Create: `src/components/states/error-state.tsx`
- Create: `src/components/ui/chinese-text.tsx`
- Test: `extension/tests/recovery-accessibility.test.js`
- Test: `tests/accessibility/web-states.test.tsx`

**Interfaces:**

- Consumes: explicit unsupported, saved, retrying, sign-in-required, organizing, ready, and failed states.
- Produces: keyboard-accessible recovery actions without blocking video playback.

**Upstream reuse:** Adapt YouTube Digest loading/error/translation retry UI, notes filter accessibility, keyboard behavior, focus handling, and safe markup styles from `sidepanel.*`, `options.*`, and `tests/release.test.js`. Do not replace the Side Panel.

- [ ] **Step 1: Write failing accessibility/recovery tests**

Cover keyboard activation, focus return after explanation modal, reduced motion, visible focus, aria-live save feedback, unsupported native-Chinese message, session-expired pending count, retry action, and long mixed Chinese/English text.

- [ ] **Step 2: Adapt extension states**

Preserve original video controls and transcript position during recoverable failures. A sign-in-required save remains queued. A provider failure shows raw saved content and a web recovery link.

- [ ] **Step 3: Implement shared web states**

Use one component set across Home, Saved, Practice, Vault, and Progress. Error copy includes recovery and request ID but no provider internals.

- [ ] **Step 4: Verify and commit**

```bash
node --test extension/tests/recovery-accessibility.test.js extension/tests/release.test.js
pnpm vitest run tests/accessibility/web-states.test.tsx
git add extension src/components tests/accessibility
git commit -m "feat: harden learning recovery and accessibility"
```

### Task 6: Run the full mastery, deletion, and resilience gate

**Files:**

- Create: `tests/e2e/returning-learner.spec.ts`
- Create: `tests/e2e/source-deletion.spec.ts`
- Create: `tests/e2e/extension/offline-recovery.spec.ts`
- Modify: `docs/engineering/execution-ledger.md`

**Interfaces:**

- Consumes: Tasks 1-5 and all prior batches.
- Produces: proof of `tried -> reused -> owned`, bounded retrieval, explicit deletion, and offline recovery.

- [ ] **Step 1: Add returning-learner scenario**

Complete two independent contexts on separate fixture dates, including a due Practice task; assert deterministic transitions and Progress changes while save count remains irrelevant.

- [ ] **Step 2: Add deletion scenario**

Delete an unpracticed source, then delete a practiced source with keep-evidence mode; assert exact UI preview and resulting records.

- [ ] **Step 3: Add extension recovery scenario**

Save offline, terminate/reload the worker, expire auth, sign in again, and verify the original owner/event syncs once without pausing playback.

- [ ] **Step 4: Run the Batch C gate**

```bash
node --test extension/tests/*.test.js
pnpm vitest run src/server/repositories/expression-search-repository.test.ts tests/integration/practice tests/integration/progress tests/integration/deletion tests/accessibility
pnpm playwright test tests/e2e/returning-learner.spec.ts tests/e2e/source-deletion.spec.ts
pnpm playwright test tests/e2e/extension/offline-recovery.spec.ts --project=chromium-extension
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
pnpm test:provenance
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e docs/engineering/execution-ledger.md
git commit -m "test: prove retrieval mastery and resilience"
```

## Batch C Exit Gate

- Chinese search works without vector infrastructure and remains user-scoped.
- Due Practice alone can advance `reused` and `owned` under fixed rules.
- Progress excludes save volume from evidence metrics.
- Source deletion previews and preserves/deletes evidence exactly as selected.
- Extension and web accessibility/recovery tests pass.
- Offline, worker restart, expired auth, and retry preserve owner/event identity.
- Full Batch C, RLS, build, provenance, browser, and extension gates pass.
