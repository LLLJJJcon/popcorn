# CONTRACT-007 Review Fix 1 — Exercise artifact conflict replay

## Identity and scope

- Review target: `920bccd..9c8b8f7eec593830a6f77ad16eef6bc2dcc47fc4`
- Worktree: `/private/tmp/popcorn-artifact-job-contract`
- Blocking review finding: the existing duplicate-result test loses the job
  lease before reaching `generated_artifacts ... on conflict`, so it does not
  prove first-artifact preservation.
- Allowed modifications only: `supabase/tests/rls.sql`, this fix brief, and
  `docs/engineering/handoffs/batch-a/contract-learning-artifact-jobs.md`.
- Forbidden: migration 007 or any earlier migration, application code,
  generated types, config, dependencies/lockfile, ledger, and unrelated tests.

## Required TDD fix

1. Add a pgTAP fixture that pre-inserts an artifact for an exact
   `(user_id, artifact_type, result_key)` and records its complete row.
2. Create a distinct valid leased learning-artifact job whose dedupe key is
   that result key and whose owner/source/type/mapping/fence are exact.
3. Temporarily mutate the existing migration only to prove RED: make the
   conflict branch overwrite or reject the preserved artifact. Run the focused
   pgTAP suite and record the single relevant failure, then restore migration
   007 byte-for-byte to commit `9c8b8f7`.
4. GREEN must assert the completion returns the pre-existing artifact UUID,
   the first artifact full row including `content`, prompt/model/languages and
   timestamps is unchanged, the job becomes succeeded, private input is `{}`,
   and private result is exactly `{ "artifactId": <existing uuid> }`.
5. Also extend the existing three mapping assertion to compare exact artifact
   `content`, so every mapping proves the bounded payload written.

Run fresh `pnpm db:reset`, `pnpm db:test`, `CI=true pnpm test:contract`,
`CI=true pnpm typecheck`, `CI=true pnpm build`, and `git diff --check`.
Commit only the allowlist files, update the handoff with RED/GREEN evidence,
and return SHA, counts, risks, and changed files. Do not self-review.

No upstream or license change: YouTube Digest remains MIT-attributed and LLM
Wiki remains method-only; copy no GPLv3 expression.
