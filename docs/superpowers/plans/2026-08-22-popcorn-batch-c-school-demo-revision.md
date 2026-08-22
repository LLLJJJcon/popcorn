# Popcorn Batch C School-Demo Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Due Practice, truthful basic Progress, source deletion, and the essential recovery states needed for one classroom learning-loop demonstration without building commercial analytics or operations infrastructure.

**Architecture:** Consume the already-frozen expression-search and atomic due-completion contracts. Keep feature repositories owner-scoped and bounded, retain practiced evidence when a source is deleted, and prove the final learning loop with one deterministic returning-learner browser scenario plus the existing queue/restart tests.

**Tech Stack:** Next.js, React, Supabase, TypeScript, Vitest, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-22-popcorn-local-first-school-demo-design.md`

## Authority and Global Constraints

- This plan supersedes Tasks 2-6 and the Batch C Exit Gate in
  `2026-08-16-popcorn-batch-c-progress-chinese.md`. Accepted Task 1 remains
  unchanged.
- CONTRACT-014 and CONTRACT-015 remain frozen unless a test proves an actual
  contract defect.
- Task 2 waits for Local-First Task 1 because Practice evaluation consumes the
  user-configured model gateway.
- Task 3 may be repaired in parallel with Local-First Tasks 1-2 because its
  files do not overlap.
- Account deletion UI is deferred; Task 4 implements source deletion only.
- Do not add pagination infrastructure, aggregate RPCs, materialized metrics,
  cache invalidation, streaks, health scores, a visualization library, a full
  WCAG program, or new offline E2E coverage that duplicates accepted queue
  evidence.
- Each implementation task gets a fresh implementation agent, then a separate
  read-only reviewer; fixes receive a new test and a fresh reviewer.

---

### Task 2: Complete Due Practice through the frozen atomic RPC

**Files:**

- Create: `src/server/domain/create-transfer-task.ts`
- Create: `src/server/domain/complete-due-practice.ts`
- Modify: `src/features/practice/due-practice.tsx`
- Modify: `src/app/api/v1/practice/due/route.ts`
- Create: `src/app/api/v1/practice/due/[reviewTaskId]/route.ts`
- Test: `tests/integration/practice/due-transfer.test.ts`
- Test: `src/server/domain/complete-due-practice.test.ts`
- Document: `docs/engineering/briefs/batch-c/task-2-revised.md`
- Document: `docs/engineering/handoffs/batch-c/task-2-revised.md`

**Interfaces:**

- Consumes: active user gateway resolver, frozen fixture evaluator, generated
  due lifecycle fields, pure mastery/schedule rules, and
  `complete_due_practice(...)` from CONTRACT-015.
- Produces: a different-context prompt that withholds the complete answer; an
  evaluated attempt; immutable RPC result IDs/state/next due time; an accessible
  Due Practice UI result.

**LLM Wiki:** Method-only source traceability and staged evaluation from
`nashsu/llm_wiki@723e259309aea5e3850265b631f80224f66dd9f6`; no GPL code,
tests, prompts, components, or assets.

- [ ] **Step 1: Write RED tests for the three mastery rules and API boundary**

Use fixed UTC instants. Assert:

```ts
expect(independentDuePass.transition).toEqual({ from: "tried", to: "reused" });
expect(secondIndependentDateAndContext.transition).toEqual({ from: "reused", to: "owned" });
expect(assistedOrFailed.transition).toBeNull();
```

The integration test must also prove exact replay returns the same IDs, stale
and cross-owner tasks fail, Provider/gateway failure writes no completion, and
responses contain no key, base URL, raw Provider body, or database detail.

- [ ] **Step 2: Run RED**

```bash
pnpm vitest run tests/integration/practice/due-transfer.test.ts src/server/domain/complete-due-practice.test.ts
```

Expected: failure because application generation/evaluation/completion and the
due submission route are incomplete. Do not use pgTAP as RED; CONTRACT-015 is
already green.

- [ ] **Step 3: Implement minimal generation, evaluation, and completion**

Normalize the original and generated context for copy detection, reject a
complete supplied answer, and use the frozen deterministic candidate fixture
in CI. In live mode resolve the current owner's pinned gateway and evaluate
before the RPC. Call `complete_due_practice` as the sole completion write and
compare its returned state/schedule with pure rules. Do not recount evidence or
calculate the persisted transition in application code.

- [ ] **Step 4: Run GREEN and focused verification**

```bash
pnpm vitest run tests/integration/practice/due-transfer.test.ts src/server/domain/complete-due-practice.test.ts src/features/practice/due-practice.test.tsx
pnpm typecheck
pnpm exec eslint src/server/domain/create-transfer-task.ts src/server/domain/complete-due-practice.ts src/features/practice/due-practice.tsx src/app/api/v1/practice/due
git diff --check
```

Expected: all exit 0. Do not repeat clean DB, full pgTAP, DST, rollback, or
two-session concurrency tests unless this task changes migration 014.

- [ ] **Step 5: Review and commit**

Reviewer PASS requires sole-RPC writing, owner/replay/stale handling, no key
leak, no synchronous Provider call in the RPC/save path, and correct three-state
rules. Then commit the scoped task and handoff.

### Task 3: Repair and accept truthful basic Progress

**Files:**

- Modify only the existing Task 3 candidate files under:
  `src/server/repositories/progress-repository.ts`,
  `src/features/progress/**`, `src/app/api/v1/progress/route.ts`,
  `src/app/(app)/progress/page.tsx`, and their Task 3 tests/handoff.
- Test: `tests/integration/progress/progress-summary.test.ts`
- Test: `src/features/progress/progress-dashboard.test.tsx`
- Document: `docs/engineering/briefs/batch-c/task-3-review-fix.md`

**Interfaces:**

- Produces: weekly attempts, due completions, independent reuse, due Practice,
  and `tried/reused/owned` distribution from typed owner-scoped rows.

- [ ] **Step 1: Strengthen the existing RED around the four review blockers**

Add tests that fail the current candidate when it uses hand-written/untyped
query shapes, silently truncates above the stated bound, accepts an incomplete
task/event graph, or leaks repository errors through the API. The boundary case
must request 501 rows for a documented 500-row product limit and return a fixed
generic failure rather than a partial total.

- [ ] **Step 2: Run the candidate RED**

```bash
pnpm vitest run tests/integration/progress/progress-summary.test.ts src/features/progress/progress-dashboard.test.tsx
```

Expected: the new blocker tests fail against the recorded Task 3 candidate.

- [ ] **Step 3: Implement only the four repairs**

Use generated Supabase types, bind every read to the authenticated owner, use
one fixed UTC week boundary, fail closed on more than 500 relevant rows, require
the complete attempt/review/mastery relationship needed by each metric, and map
all repository failures to generic `INTERNAL_ERROR` with `Cache-Control:
no-store`. Do not add pagination, aggregation RPCs, caches, materialized tables,
or charts.

- [ ] **Step 4: Run GREEN, review, and commit**

```bash
pnpm vitest run tests/integration/progress/progress-summary.test.ts src/features/progress/progress-dashboard.test.tsx
pnpm typecheck
pnpm exec eslint src/server/repositories/progress-repository.ts src/features/progress src/app/api/v1/progress src/app/'(app)'/progress
git diff --check
```

Reviewer PASS requires all four blockers closed and no broadened scope. No DB,
extension, provenance, or full-app gate is justified.

### Task 4: Implement source deletion while retaining practiced evidence

**Controller pre-Task contract gate:** Before dispatching the feature agent,
the controller creates and independently reviews
`supabase/migrations/202608220016_source_deletion.sql`,
`supabase/tests/source_deletion.sql`, and regenerated
`src/types/database.generated.ts`. It freezes a service-role-only
`delete_video_source(p_user_id, p_video_source_id, p_mode, p_now)` RPC returning
`{ deleted, retained_user_expression_count }`.

The contract has two exact modes:

- `remove_unpracticed_source`: refuse if the owner has a promoted
  `user_expression` from the source; otherwise delete private pins/inputs,
  pending jobs, draft data, generated artifacts, occurrences/senses, saved
  items, transcript rows/snapshots, then the source in one transaction.
- `remove_source_keep_evidence`: retain canonical expression text/meaning,
  practice tasks, attempts, mastery events, review tasks, immutable promotion
  receipts, and their IDs. Add explicit `source_deleted_at` tombstone state and
  nullable/scrubbed source-locator fields wherever retained receipt/evidence
  rows currently require the source/snapshot/save/occurrence graph. Remove or
  scrub video identity, URL, title/description, transcript bodies, generated
  artifacts, raw saves, and segment/time locators so retained rows cannot
  reconstruct the deleted source. Existing receipt replay returns the same
  canonical learning IDs without recreating source rows.

The RPC locks the owned source, re-evaluates the requested mode inside the
transaction, rejects cross-owner/unknown/ambiguous calls, and safely
terminalizes source jobs before removing private inputs. Focused pgTAP must
cover both modes, receipt replay, another owner, rollback on a forced final-step
failure, and absence of source content after keep-evidence deletion. Because
this changes schema/FKs, run one clean reset, focused pgTAP, full pgTAP, exact
generated-type comparison, and TypeScript before freezing CONTRACT-016. The
feature agent may not edit the migration or generated types.

**Files:**

- Create: `src/server/domain/plan-source-deletion.ts`
- Create: `src/server/domain/delete-source.ts`
- Create: `src/features/saved/delete-source-dialog.tsx`
- Create: `src/app/api/v1/saved/[videoSourceId]/delete-preview/route.ts`
- Create: `src/app/api/v1/saved/[videoSourceId]/route.ts`
- Test: `tests/integration/deletion/source-deletion.test.ts`
- Test: `src/features/saved/delete-source-dialog.test.tsx`
- Document: `docs/engineering/briefs/batch-c/task-4-revised.md`
- Document: `docs/engineering/handoffs/batch-c/task-4-revised.md`

**Interfaces:**

- Produces: `DeletionImpact` with video title, saved count, affected expressions,
  and exact mode; modes are `remove_unpracticed_source` and
  `remove_source_keep_evidence`.
- Consumes: frozen CONTRACT-016
  `delete_video_source(p_user_id, p_video_source_id, p_mode, p_now)` as the sole
  deletion write.

- [ ] **Step 1: Write RED deletion tests**

Prove an unpracticed source removes its source-derived content; a practiced
source removes source bodies/occurrences but retains attempts, mastery, and
reviews marked `source_deleted`; cross-owner and a mode that does not match the
preview fail. The component must name the video/count/effect before enabling
confirmation.

- [ ] **Step 2: Run RED**

```bash
pnpm vitest run tests/integration/deletion/source-deletion.test.ts src/features/saved/delete-source-dialog.test.tsx
```

Expected: routes/domain/UI are absent.

- [ ] **Step 3: Implement the minimum owner-scoped transaction and UI**

Use owner-scoped reads for preview and the frozen RPC as the sole write. Do not
simulate a transaction with multiple PostgREST mutations. Do not add
undo windows, approval workflows, account deletion UI, recovery archives,
concurrent deletion stress tests, or a separate deletion E2E.

- [ ] **Step 4: Run GREEN, review, and commit**

```bash
pnpm vitest run tests/integration/deletion/source-deletion.test.ts src/features/saved/delete-source-dialog.test.tsx
pnpm typecheck
pnpm exec eslint src/server/domain/plan-source-deletion.ts src/server/domain/delete-source.ts src/features/saved/delete-source-dialog.tsx src/app/api/v1/saved
git diff --check
```

Reviewer PASS requires preview/commit agreement, owner scope, retained learning
evidence, and explicit mode refusal.

### Task 5: Add only demo-path recovery and accessibility states

**Files:**

- Modify: `extension/sidepanel.html`
- Modify: `extension/sidepanel.css`
- Modify: `extension/sidepanel.js`
- Modify: `extension/options.html`
- Modify: `extension/options.js`
- Create: `src/components/states/error-state.tsx`
- Test: `extension/tests/recovery-accessibility.test.js`
- Test: `tests/accessibility/web-states.test.tsx`
- Document: `docs/engineering/briefs/batch-c/task-5-revised.md`
- Document: `docs/engineering/handoffs/batch-c/task-5-revised.md`

**Interfaces:**

- Consumes/produces explicit `Saving`, `Saved`, `retrying`, `sign-in required`,
  `organizing`, `failed`, and unsupported-YouTube states with keyboard recovery.

**Upstream reuse:** Adapt the pinned YouTube Digest Side Panel loading/error,
retry, focus, keyboard, and notes-filter accessibility behavior. Preserve the
current DOM and functions; do not build a replacement extension UI.

- [ ] **Step 1: Write RED state tests**

Assert aria-live save feedback, visible keyboard retry, queued saves after auth
expiry/offline state, raw saved content after Provider failure, unsupported
watch-page copy, and preservation of player/transcript position. The Web test
covers one generic no-detail error with a request ID and recovery action.

- [ ] **Step 2: Run RED**

```bash
node --test extension/tests/recovery-accessibility.test.js
pnpm vitest run tests/accessibility/web-states.test.tsx
```

- [ ] **Step 3: Implement minimal state changes**

Change only the demo path. Do not refactor Home/Saved/Practice/Vault/Progress
into a design system, add animations/reduced-motion tests when no animation is
present, or run a full-site WCAG matrix.

- [ ] **Step 4: Run GREEN, review, and commit**

```bash
node --test extension/tests/recovery-accessibility.test.js extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
pnpm vitest run tests/accessibility/web-states.test.tsx
pnpm typecheck
git diff --check
```

Reviewer PASS requires queued-save persistence, keyboard/aria behavior, no
playback interruption, no internal error details, and actual pinned-function
adaptation.

### Task 6: Run one Batch C returning-learner gate

**Files:**

- Create: `tests/e2e/returning-learner.spec.ts`
- Modify: `playwright.config.ts`
- Create: `docs/engineering/checkpoints/gate-c.md`
- Modify: `docs/engineering/execution-ledger.md`

**Interfaces:**

- Consumes: accepted Tasks C1-C5 and local-first gateway/auth/runtime contracts.
- Produces: one fixture-backed proof of Due Practice -> mastery transition ->
  Progress update, plus retained existing queue/restart evidence.

- [ ] **Step 1: Write the deterministic browser scenario**

Use fixed fixture dates and content. Complete one due Practice independently,
assert the expected `tried -> reused` or `reused -> owned` transition, then
assert Progress changes while save count does not. Do not create separate
source-deletion or offline-recovery browser files.

- [ ] **Step 2: Run the scoped candidate gate**

```bash
pnpm vitest run tests/integration/practice/due-transfer.test.ts tests/integration/progress/progress-summary.test.ts tests/integration/deletion/source-deletion.test.ts src/features/practice src/features/progress src/features/saved/delete-source-dialog.test.tsx tests/accessibility/web-states.test.tsx
node --test extension/tests/recovery-accessibility.test.js extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
pnpm playwright test tests/e2e/returning-learner.spec.ts --project=chromium-web
pnpm typecheck
pnpm build
git diff --check
```

Expected: all exit 0. Configure the existing `chromium-web` project to match
both `saved-learning-loop.spec.ts` and `returning-learner.spec.ts`. Do not run
full pgTAP again here: CONTRACT-016 owns the one clean/full database gate and
CONTRACT-015 retains its accepted 624/624 evidence.

- [ ] **Step 3: Independent final review and checkpoint**

The reviewer checks the complete Batch C diff for product scope, owner/RLS,
mastery truthfulness, deletion retention, queue recovery, upstream reuse, and
GPL isolation. After PASS, the controller updates the ledger/checkpoint and
commits the gate.

## Revised Batch C Exit Gate

- Task 1 lexical Chinese search remains accepted.
- Due Practice can demonstrate deterministic independent advancement through
  only `tried -> reused -> owned`.
- Progress reports practice evidence and excludes save volume.
- Source deletion previews exact impact and preserves practiced evidence.
- Demo-path failures remain recoverable without interrupting playback.
- One returning-learner E2E, existing queue/restart regressions, focused suites,
  TypeScript, build, and diff checks pass.
