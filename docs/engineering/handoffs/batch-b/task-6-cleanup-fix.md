# Batch B Task 6 cleanup repair handoff

## Scope and baseline

- Baseline: `e99a08007509c073b081b13136dbfaa6a425aa83`.
- Worktree: `/private/tmp/popcorn-batch-b-6-cleanup-fix`.
- Changed implementation surface: test harness only in
  `tests/e2e/saved-learning-loop.spec.ts`.
- No production code, migration, database permission, root configuration,
  lockfile, CI, provider, prompt, or gateway change.

## RED evidence inherited from review

The baseline browser test used immutable fixed IDs without teardown. A second
consecutive run failed on the retained fixture graph, and the immediately
following full pgTAP run failed global-count assertions. The parent brief
records this accepted RED evidence; it was not repeated before the repair.

## Repair

- Added test-only `execFile`/argument-array invocation of local `psql` before
  setup and in `afterAll`.
- Requires explicit `POPCORN_E2E_DATABASE_URL`; fails closed unless it is a
  PostgreSQL URL for `postgres` on `127.0.0.1` or `localhost`, port `54322`,
  database `/postgres`, with no query or fragment and a non-empty password.
- Uses only `PG*` child-process environment fields; it neither shells nor logs
  the database URL, credentials, cookies, service key, or cleanup SQL.
- Guards the reserved UUID against any email other than
  `learning-loop@popcorn.test` before deletion.
- Deletes only the fixed E2E user's graph, in foreign-key-safe order, beginning
  with the private immutable promotion receipt. It does not truncate, reset,
  delete by time/status, change permissions, or accept a remote database.
- Verifies zero residual rows for that owner across every owner-bearing public
  and private Popcorn table plus `auth.users` before committing cleanup.

## Verification evidence

Static verification completed after the final source edit:

- `pnpm eslint tests/e2e/saved-learning-loop.spec.ts` — exit 0.
- `pnpm typecheck` — exit 0.
- `git diff --check` — exit 0.

Dynamic verification is **not complete in this worktree**:

- Default Playwright startup could not enter the test because Next 16
  Turbopack rejected this temporary worktree's pnpm realpath.
- A task-local `next dev --webpack` fixture server entered the browser test,
  but the test timed out waiting for the candidate action to navigate; the
  server saw no candidate POST. A repeat reached the same stage and was stopped
  at the controller's direction.
- Consequently, this handoff does not claim the required two consecutive E2E
  passes or the no-reset immediate 570-test pgTAP pass. The controller should
  run those three commands after cherry-picking into the integration worktree's
  known-good dependency/runtime path.

No live provider or user API key was used. All attempted browser execution used
`CI=true` / `POPCORN_PROVIDER_MODE=fixtures` on the locally started app.

## Residual risk

The cleanup SQL and fail-closed connection validation are statically verified,
but repeatability and post-E2E database cleanliness remain unaccepted until the
integration worktree completes the mandated E2E, E2E, pgTAP sequence without a
reset.
