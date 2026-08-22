# Batch C Task 3 handoff — evidence-based Progress

## Review repair 2 — implementation handoff

- Baseline reviewed: `7e977cff6b695ed8f1faeeb026e0c087837dbea8`.
- Parent candidate before this repair: `f41a01fcff598d2463cdacf94555f8e39f8aa3ee`.
- Verified repair commit: `bff49f7ba78b51ad2a2738427c7bf1a497d67d25`
  (`fix: align Progress review evidence`).

### Review blockers closed

- The typed Supabase adapter now de-duplicates a task returned by both its
  owner-scoped `id` and `review_task_id` reads, while conflicting records with
  the same ID still fail closed. The repository still rejects duplicate task
  records presented by an arbitrary evidence source.
- A pending, due review counts as due Practice before a task is materialized.
  When a task is returned, its owner, kind, review link, and expression link
  must match an included review; orphaned or conflicting task evidence fails.
- `failed_or_assisted_reuse` now follows CONTRACT-015: the original review is
  completed with that attempt ID and timestamp, while the separately-created
  pending next review can have no materialized Practice task. It contributes
  one attempt and one completion, never independent reuse.

### TDD evidence

RED, before this production repair:

```bash
CI=true pnpm vitest run tests/integration/progress/progress-summary.test.ts src/features/progress/progress-dashboard.test.tsx
```

Result: exit 1; exactly the three new cases failed. The adapter/repository
path rejected a duplicate read of the same task, a taskless pending review was
rejected, and the real failed/assisted completion graph was rejected because
the completed old review was incorrectly required to be pending.

GREEN after the minimal repair:

```bash
CI=true pnpm vitest run tests/integration/progress/progress-summary.test.ts src/features/progress/progress-dashboard.test.tsx
```

Result: exit 0; 2 files and 22 tests passed. Additional regression coverage
keeps a malformed materialized pending task and conflicting duplicate source
records fail-closed.

### Final focused verification

```bash
CI=true pnpm exec eslint src/server/repositories/progress-repository.ts src/features/progress src/app/api/v1/progress 'src/app/(app)/progress' tests/integration/progress/progress-summary.test.ts
CI=true pnpm typecheck
git diff --check
```

All commands exited 0. No migration, generated type, gateway, root config,
lockfile, ledger, extension, or app file outside Task 3 was changed.

### Remaining risk / review request

- The 500-row intentional Progress bound remains unchanged.
- This implementation awaits a new independent read-only review; this handoff
  is evidence, not approval.

## Review repair 1 — implementation handoff

- Baseline reviewed: `7e977cff6b695ed8f1faeeb026e0c087837dbea8`.
- Verified implementation commit: `e697933d9fc42640cb288aa5f1ec043245ff7c9a` (`fix: harden Progress evidence reads`).
- Scope: only `src/server/repositories/progress-repository.ts` changed in the implementation commit; this handoff records the evidence separately.

### Review blockers closed

- The product evidence bound is now 500 and each owner-scoped, deterministically
  ordered query requests 501 rows. A 501-row result fails closed before any
  metric is returned, avoiding PostgREST's 1,000-row transport ceiling.
- `createSupabaseProgressEvidenceSource` now calls `SupabaseClient<Database>`
  directly. It uses generated table and column types throughout; the former
  `unknown`/string-query-builder cast and untyped record parsing are removed.
- The repository fetches all referenced attempt tasks, task rows associated
  with included reviews, and all mastery events associated with weekly
  attempts. It validates one exact owner-consistent attempt/task/event/review
  graph before classification: missing, wrong-kind, wrong-link, unexpected,
  duplicate, and cross-owner evidence fail closed.
- The Progress HTTP handler catches every repository exception and returns the
  frozen retryable `INTERNAL_ERROR` response with the request ID and
  `Cache-Control: no-store`; database/provider details never reach the body.

### TDD evidence

RED, before production repair:

```bash
CI=true pnpm vitest run tests/integration/progress/progress-summary.test.ts src/features/progress/progress-dashboard.test.tsx
```

Result: exit 1; 9 of 17 tests failed. Failures demonstrated the silent-bound
path, incomplete task/event graph acceptance, filtered task adapter result,
and an uncaught repository error containing `database provider secret`.

GREEN, after the repair:

```bash
CI=true pnpm vitest run tests/integration/progress/progress-summary.test.ts src/features/progress/progress-dashboard.test.tsx
```

Result: exit 0; 2 files and 17 tests passed.

### Final focused verification

```bash
CI=true pnpm vitest run tests/integration/progress/progress-summary.test.ts src/features/progress/progress-dashboard.test.tsx
CI=true pnpm exec eslint src/server/repositories/progress-repository.ts src/features/progress src/app/api/v1/progress 'src/app/(app)/progress' tests/integration/progress/progress-summary.test.ts
CI=true ./node_modules/.bin/tsc --noEmit
git diff --check
```

All commands exited 0. Baseline-to-HEAD and working-tree allowlist review
contained only Task 3 repository, Progress feature/route/page, focused tests,
and Task 3 brief/handoff files; no migration, generated type, gateway, root
configuration, lockfile, ledger, extension, or integration-worktree change
was made.

### Remaining risk / review request

- A user with more than 500 rows in any queried Progress evidence slice now
  receives the generic retryable failure rather than a partial metric. A
  controller-owned paginated or aggregated design can replace this bounded
  release behavior later.
- Graph validation intentionally treats inconsistent persisted evidence as
  unavailable Progress. No DB repair is attempted in this task.
- Independent review is still required; this handoff is evidence, not a
  self-review or pass claim.

## WIP checkpoint — review repair 1

- Checkpoint stage: repair tests drafted only; production repair has not started.
- Drafted coverage for a detectable 500-row product bound, complete task/event owner graph failures, fetching all referenced task/event rows, and generic retryable HTTP repository failures.
- The focused test command has not been run at this checkpoint. The suite is expected to remain RED because the row interfaces and repository/HTTP implementation have not yet been updated for the new assertions.
- Remaining work: capture RED evidence, implement typed Supabase queries and exact graph validation, map repository errors, capture GREEN evidence, run the brief's focused lint/type/diff checks, update this handoff with final evidence, and obtain independent review.
- This WIP checkpoint is not a completion or review-pass claim.

## Assignment

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-c-progress-chinese.md`, Task 3.
- Baseline: `0974be1943db1c981ba62eed2b59ee7e474d4e33`.
- Brief commit: `bc83d2522b41a5446bfdeae822d3ff97d4b3b6ad`.
- Worktree: `/private/tmp/popcorn-batch-c-3`.

## Implementation

- Added a strict public Progress DTO with an ISO UTC week, four evidence counts,
  and the exact `tried/reused/owned` distribution.
- Added an owner-scoped bounded repository. Every Supabase query binds
  `user_id`; each result set is limited to 1,001 rows and fails closed above
  the 1,000-row product bound or on a cross-owner/malformed relationship.
- Weekly attempts use `attempts.submitted_at` in the UTC Monday
  `[weekStart, weekEnd)` interval.
- Due completions use `review_tasks.status='completed'` and the frozen Task 2
  `completed_at`/`completed_attempt_id` evidence. Current due Practice counts
  pending rows with `due_at <= now`.
- Independent reuse counts distinct passed, unassisted, independent
  `due_practice` attempts backed by either `successful_independent_transfer`
  or `owned_threshold_met` append-only mastery evidence. It never counts the
  original `valid_original_attempt` or weak/assisted evidence.
- Current mastery distribution comes from the monotonic `user_expressions`
  projection and remains independent of weak recent attempt performance.
- Added an authenticated no-store GET route and a server-rendered Progress page
  with four textual evidence summaries and the three-state distribution. No
  collection-volume achievements, charts, AI, or provider calls were added.

## TDD evidence

RED command:

```bash
CI=true pnpm vitest run tests/integration/progress/progress-summary.test.ts src/features/progress/progress-dashboard.test.tsx
```

RED result: exit 1. Both suites failed import resolution because
`progress-repository.ts` and `progress-dashboard.tsx` did not exist. This was
the expected missing-feature failure before production files were created.

First GREEN result for the same command: exit 0, 2 files and 7 tests passed.
The tests cover fixed inclusive/exclusive UTC boundaries, assisted-attempt
exclusion from independent reuse, saved/explanation irrelevance, current
highest mastery versus recent failure, completed versus currently-due review
semantics, cross-owner failure closure, authenticated route output, four
summary labels, and the exact three mastery states.

## Verification

Fresh final verification is recorded immediately before the task commit. The
required commands are:

```bash
CI=true pnpm vitest run tests/integration/progress/progress-summary.test.ts src/features/progress/progress-dashboard.test.tsx
CI=true pnpm exec eslint src/server/repositories/progress-repository.ts src/features/progress/schema.ts src/features/progress/progress-dashboard.tsx src/features/progress/progress-dashboard.test.tsx src/app/api/v1/progress/route.ts 'src/app/(app)/progress/page.tsx' tests/integration/progress/progress-summary.test.ts
CI=true pnpm typecheck
git diff --check
```

No database reset, pgTAP, full build, or provider test was run: this task does
not own a migration, shared contract, root configuration, or provider path.

## Changed files

- `src/server/repositories/progress-repository.ts`
- `src/features/progress/schema.ts`
- `src/features/progress/progress-dashboard.tsx`
- `src/features/progress/progress-dashboard.test.tsx`
- `src/app/api/v1/progress/route.ts`
- `src/app/(app)/progress/page.tsx`
- `tests/integration/progress/progress-summary.test.ts`
- `docs/engineering/handoffs/batch-c/task-3.md`

## Dependencies and risks

- Integration requires the controller-owned Task 2 migration/types that add
  nullable `review_tasks.completed_at` and `completed_attempt_id` with the
  completed-state invariant. The repository intentionally consumes those
  frozen column names through a narrow Supabase adapter and does not modify
  generated types in this branch.
- A user with more than 1,000 rows in any one Progress evidence slice receives
  a closed error instead of an understated metric. This is intentional for the
  bounded personal-product release and can later be replaced by a controller-
  owned aggregation RPC without changing the DTO.
- No YouTube Digest code was needed. LLM Wiki contributed only the documented
  staged-evidence method; no GPLv3 code, tests, prompts, components, or assets
  were copied.
