# Batch B Task 6 — cleanup subprocess environment repair

## Assignment

- Parent: Batch B Task 6 cleanup repair.
- Review result: FAIL due to unsafe broad child-process environment inheritance.
- Baseline: `6ac36c684869ebd55b47576c1d23112f7f496285`.
- Worktree: `/private/tmp/popcorn-batch-b-6-cleanup-fix`.

The current helper spreads all of `process.env` into the local `psql` process.
This forwards unrelated secrets and lets libpq variables such as `PGHOSTADDR`,
`PGSERVICE`, or `PGSERVICEFILE` override the validated loopback target.

## Allowed files

- Modify: `tests/e2e/saved-learning-loop.spec.ts`
- Create: `tests/e2e/saved-learning-loop-cleanup.ts`
- Create: `tests/contract/e2e/saved-learning-loop-cleanup.test.ts`
- Create: `docs/engineering/handoffs/batch-b/task-6-cleanup-env-fix.md`
- this brief

All production code, migrations, permissions, root config, lockfile, CI, ledger,
and other tests are forbidden.

## TDD requirements

1. Add a failing unit test that gives the helper a valid local DB URL plus an
   inherited environment containing remote `PGHOSTADDR`, `PGSERVICE`,
   `PGSERVICEFILE`, and sentinel service/model secrets. Prove none appear in the
   exact environment passed to `execFile`.
2. Extract the SQL/local URL/cleanup harness from the E2E spec only as needed for
   testability. The subprocess environment must be constructed from a strict
   allowlist: runtime lookup/locale fields only (`PATH`, optional locale fields)
   plus validated `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, a
   bounded connection timeout/application name, and disabled SSL for loopback.
   Do not include `HOME` or spread the inherited environment.
3. Retain the exact loopback/port/database/user/password/query/fragment checks,
   receipt-first scoped cleanup, email guard, and zero-residual verification.
4. Prove remote URL, missing password, and override variables fail closed or are
   absent. Never print credentials or SQL.

## Verification

```bash
pnpm vitest run tests/contract/e2e/saved-learning-loop-cleanup.test.ts
pnpm eslint tests/e2e/saved-learning-loop.spec.ts tests/e2e/saved-learning-loop-cleanup.ts tests/contract/e2e/saved-learning-loop-cleanup.test.ts
pnpm typecheck
git diff --check
```

Dynamic E2E×2 then pgTAP remains the controller's integration verification after
this fix passes independent review. Add no dependency and copy no upstream code.

Commit the allowlist with RED/GREEN evidence and a truthful handoff.
