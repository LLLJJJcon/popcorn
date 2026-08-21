# Batch C Task 3 handoff — evidence-based Progress

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
