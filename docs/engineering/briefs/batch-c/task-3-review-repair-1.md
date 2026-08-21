# Batch C Task 3 review repair 1 brief

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-c-progress-chinese.md`, Task 3.
- Rebased integration baseline: `7e977cff6b695ed8f1faeeb026e0c087837dbea8` with frozen CONTRACT-015 generated types.
- Rebased candidate: `33c13b9`.
- Worktree/branch: `/private/tmp/popcorn-batch-c-3`, `codex/popcorn-batch-c-3`.
- Allowed modifications: `src/server/repositories/progress-repository.ts`, `tests/integration/progress/progress-summary.test.ts`, `docs/engineering/handoffs/batch-c/task-3.md`, and this brief. Modify the dashboard/schema/routes only if a failing repair test proves necessary; explain first in handoff.
- Forbidden modifications: contracts, migrations, generated types, root config, lockfile, other feature/repository/tests, gateway/Provider/extension, ledger.

## Independent review blockers

1. `MAX_EVIDENCE_ROWS=1000` with `QUERY_LIMIT=1001` cannot detect overflow when PostgREST `max_rows=1000`; it can silently undercount. Use a detectable product bound below the transport cap (recommended 500 with request 501), exact count, or complete bounded pagination. Add a test that proves row `bound+1` fails instead of truncating.
2. The whole Supabase client is cast through `unknown` to an untyped string query builder. CONTRACT-015 types are now frozen. Use direct `SupabaseClient<Database>` typed queries and typed row mappings; do not erase table/column/RPC types.
3. Production queries fetch only due tasks and recognized reuse events. Missing/wrong task/event relations can therefore look like valid zero evidence and silently undercount. Fetch every referenced task and every relevant attempt event, then require the complete exact owner graph before classifying due-independent reuse. Add negative tests for a missing task, wrong task kind/link, missing event, unexpected/duplicate event, and cross-owner relation.
4. Repository/query exceptions escape the HTTP handler, so the route does not return the frozen generic `ApiFailure` with request ID and `Cache-Control: no-store`. Add a failing route test and map all repository failures to generic retryable `INTERNAL_ERROR` without leaking DB/provider detail.

## TDD and verification

- Add the above focused tests first and capture RED against `33c13b9`; then make the minimum implementation repair.
- Preserve fixed UTC windows and DTO meanings: attempts, completed due reviews, independent due reuse, current due Practice, and exact `tried/reused/owned` distribution only.
- Every query must include authenticated `user_id`, deterministic order, detectable bound, and fail-closed relationship validation. Do not add an aggregation RPC or schema change.
- Run focused Progress integration/dashboard tests, scoped ESLint, `./node_modules/.bin/tsc --noEmit`, `git diff --check`, and baseline-to-HEAD allowlist. No DB reset/build/browser/full app suite because this repair changes no shared contract.
- Update the existing handoff with RED/GREEN evidence, changed files, risk, and commit SHA; commit and return the SHA. Do not self-review.

## Upstream/license

- No upstream code is needed. Preserve YouTube Digest MIT pin `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
- LLM Wiki v0.6.9 commit `723e259309aea5e3850265b631f80224f66dd9f6` remains method-only; copy no GPLv3 code, tests, prompts, components, or assets.
