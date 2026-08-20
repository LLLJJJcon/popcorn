# Batch B controller AI contract — review fix 2

## Assignment

- Review target: Batch B controller AI contract after fix 1.
- Baseline: `446e1453f828e1ce5b94565853280ecb613a3da2`.
- Worktree: `/private/tmp/popcorn-batch-b-ai-contract-fix-2`.
- Independent re-review result: FAIL on one generated-type consistency issue.

## Blocking finding

Migration 010 now defines five-column practice/attempt provenance foreign keys that
include `model`, but `src/types/database.generated.ts` still describes the older
four-column relationships. The frozen TypeScript database contract must exactly
match the repaired schema before Task 4 consumes it.

## Allowed files

- `src/types/database.generated.ts`
- `docs/engineering/handoffs/batch-b/controller-ai-contract.md`

Every other path is forbidden, including migrations, SQL tests, application code,
root config/lockfile, ledger, prompts, and upstream files.

## Required protocol

1. Use the repaired local schema to generate types to a temporary file and record
   RED evidence: a diff showing `evaluation_model -> model` and
   `activation_model -> model` are missing from the committed relationships.
2. Mechanically regenerate `src/types/database.generated.ts`; do not hand-invent
   unrelated type changes. Remove the generator's extra trailing blank line if
   needed for `git diff --check`.
3. GREEN: regenerated output and committed type must match exactly (except a
   documented final blank-line normalization), and `git diff --check` must pass.
4. Update the existing handoff, commit only allowed files, and return commit SHA,
   RED/GREEN evidence, risks, and handoff path.

Do not reset the database, rerun pgTAP, run the full app suite, or build. Fix 1
already passed focused pgTAP 26/26; the controller will run one clean reset/full
pgTAP/build after this generated contract passes re-review.

## Product and license boundaries

- This is a mechanical schema/type consistency fix. It must not change runtime
  behavior, gateway egress, API-key access, RLS, queue behavior, prompts, or UI.
- No upstream code is needed. Copy no LLM Wiki GPLv3 code/tests/prompts/assets and
  no YouTube Digest code.
