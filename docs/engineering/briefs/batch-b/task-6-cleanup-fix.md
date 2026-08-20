# Batch B Task 6 — repeatable E2E cleanup repair

## Assignment

- Parent plan/task: Batch B learning-loop Task 6.
- Review status: FAIL, one Important blocker.
- Baseline: `e99a080`.
- Branch: `codex/popcorn-batch-b-6-cleanup-fix`.
- Worktree: `/private/tmp/popcorn-batch-b-6-cleanup-fix`.

Repair only the E2E isolation defect: the test leaves an immutable promotion
receipt and canonical graph, so a second run fails and a following pgTAP run sees
polluted global counts. The final proof must run the Web E2E twice consecutively
and then all 570 pgTAP tests without any database reset between those commands.

## Allowed files

- `tests/e2e/saved-learning-loop.spec.ts`
- `docs/engineering/handoffs/batch-b/task-6-cleanup-fix.md`
- this brief

All production files, migrations, database permissions/functions, root config,
lockfile, CI, ledger, shared contracts, prompts, gateways, and other tests are
forbidden.

## Required TDD and implementation

1. Record RED from a consecutive second E2E run and/or immediate pgTAP count
   failure on the baseline.
2. Add test-harness-only cleanup before setup and in `afterAll`. It may connect
   through local PostgreSQL superuser `psql` because service role intentionally
   cannot delete `private.practice_promotion_receipts`.
3. Fail closed unless the cleanup database URL is explicitly supplied through a
   task-specific environment variable and resolves exactly to a loopback host and
   expected local Supabase database/port. Never accept a remote hostname.
4. Before deleting, fail if the fixed E2E user UUID belongs to any email other
   than the reserved E2E fixture email. Delete only rows owned by the fixed E2E
   user and its fixed source graph, in FK-safe order, including the private receipt
   first. Do not truncate, reset, delete by broad date/status, or touch seed/other
   users.
5. Use `execFile`/argument arrays, not shell interpolation. Do not print the
   database URL, service key, auth cookies, or SQL containing secrets.
6. Cleanup must also work after partial setup/failure and leave zero rows for the
   fixed E2E user across auth/profile/source/save/artifact/draft/promotion graph.

The local test database is disposable, but the fix must be task-scoped and
repeatable; do not call `supabase db reset` inside the test.

## Verification

With the integration dependency tree temporarily linked and the local database
currently clean:

```bash
pnpm playwright test tests/e2e/saved-learning-loop.spec.ts --project=chromium-web
pnpm playwright test tests/e2e/saved-learning-loop.spec.ts --project=chromium-web
pnpm db:test
pnpm typecheck
pnpm eslint tests/e2e/saved-learning-loop.spec.ts
git diff --check
```

There must be no reset between the two browser runs and pgTAP. Record counts and
commands in the handoff. Use only `CI=true` fixture mode; no live Provider/key.

## License

No upstream implementation applies. Copy no LLM Wiki GPLv3 code, tests, prompts,
components, assets, or wording. Add no dependency.

Commit only the allowlist and return SHA, RED/GREEN evidence, verification,
residual risk, and handoff path. A fresh read-only Agent will re-review before
integration.
