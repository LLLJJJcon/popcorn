# Batch B Task 6 — PostgREST timestamp promotion fix

## Assignment

- Parent plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 6.
- Baseline: `50bd6b1`.
- Branch: `codex/popcorn-batch-b-6-timestamp-fix`.
- Worktree: `/private/tmp/popcorn-batch-b-6-timestamp-fix`.

Fix only the real browser-gate defect where a valid original attempt is staged but
promotion returns 500 because PostgREST serializes a PostgreSQL `timestamptz` as
`2026-08-20T22:35:31.562+00:00`, while `scheduleReview` intentionally accepts only
canonical millisecond UTC `...Z` input. A manual retry using the same stored row
after canonical `Date#toISOString()` conversion succeeds.

## Allowed files

- `src/server/domain/record-valid-attempt.ts`
- `tests/integration/learning-loop/record-valid-attempt.test.ts`
- `docs/engineering/handoffs/batch-b/task-6-timestamp-fix.md`
- this brief

All other files are forbidden. Do not edit migrations, shared contracts,
`schedule-review.ts`, repositories/routes/UI, generated types, root config,
lockfile, CI, Provider/gateway code, ledger, or Task 6 E2E/AI tests.

## Required TDD evidence

1. Add a focused test proving a passed revision-1 attempt with a real PostgREST UTC
   offset timestamp such as `2026-08-20T22:35:31.562+00:00` currently fails before
   the repository promotion call.
2. Make the smallest fix at the promotion boundary: validate that the persisted
   value contains an explicit UTC offset, parse it, canonicalize it to
   millisecond `Z`, and pass that canonical instant to the existing unmodified
   `scheduleReview` function.
3. Prove the repository receives exactly one-day due time and all other promotion
   fields remain unchanged. Retain failure for invalid or timezone-less values.
4. Run the full existing `record-valid-attempt.test.ts` plus TypeScript and diff
   checks.

Do not loosen the deterministic scheduling algorithm. Do not use current wall
clock time. Do not add a retry, Provider call, log, or client-controlled field.

## Verification

```bash
./node_modules/.bin/vitest run tests/integration/learning-loop/record-valid-attempt.test.ts
./node_modules/.bin/tsc --noEmit --pretty false
git diff --check
```

Use the integration worktree's existing dependency tree by a temporary symlink if
needed; never commit `node_modules`.

## Upstream and license

No YouTube Digest implementation applies. LLM Wiki remains method-only at commit
`723e259309aea5e3850265b631f80224f66dd9f6`; copy no GPLv3 code, tests, prompts,
components, assets, or wording. Add no dependency and preserve notices.

Commit the fix, regression test, brief, and handoff. Return RED/GREEN evidence,
commit SHA, residual risk, and handoff path.
