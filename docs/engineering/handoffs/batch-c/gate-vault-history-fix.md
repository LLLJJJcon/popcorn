# Gate C Vault History Regression Fix Handoff

## Baseline and scope

- Baseline: `2e2e114c5e69ac7532201546ed86a1f5382986b5`
- Branch: `codex/popcorn-batch-c-gate-vault-history-fix`
- Worktree: `/private/tmp/popcorn-batch-c-gate-vault-history-fix`
- Modified production file: `src/server/repositories/review-task-repository.ts`
- Modified test file: `tests/integration/memory/vault-practice.test.ts`
- No E2E, migration, generated type, root configuration, or lockfile changes.

## Root cause

Task 4 changed every Vault attempt read from `practice_draft_attempts` to
canonical `attempts`. Promotion copies only the accepted activation attempt to
the canonical table, while later revisions remain in the active practice draft.
Consequently, active Vault cards lost revision history. Source deletion removes
the source-bound draft rows, so tombstoned cards must still read canonical
attempts without reconstructing an occurrence or source.

## RED evidence

Command:

```text
node_modules/.bin/vitest run tests/integration/memory/vault-practice.test.ts -t "keeps active draft revisions separate from tombstoned canonical evidence in one Vault read"
```

Observed before the repository fix: exit 1. The single mixed Vault call returned
the tombstoned canonical attempt, but the active card returned an empty attempt
array instead of the original plus revision. The failure was the intended
behavior assertion; nine unrelated tests were skipped.

## Implemented behavior

- Active cards query owner-scoped `practice_draft_attempts` using only active
  `future_user_expression_id` values.
- Tombstoned cards query owner-scoped canonical `attempts` using only deleted
  `user_expression_id` values.
- Each branch keeps the existing `submitted_at`, `id` stable ordering and
  500-row limit.
- Card assembly chooses exactly one history source. Active cards do not merge
  canonical rows, and tombstones do not depend on deleted draft/source data.
- Existing active occurrence/source scoping and tombstone null-occurrence
  behavior are unchanged.

## GREEN and regression evidence

- Targeted RED test after implementation: 1/1 passed, exit 0.
- Vault/Practice focused file: 10/10 passed, exit 0.
- Vault + Task 4 deletion + Saved library regression: 3 files, 20/20 passed,
  exit 0.
- `tsc --noEmit`: exit 0.
- Scoped ESLint for the two code/test files: exit 0 with no warnings.
- `git diff --check`: exit 0.

## Risks and follow-up

- The bounded active and tombstone queries each retain their own 500-row cap.
  This restores the prior active behavior and preserves deletion evidence; it
  intentionally does not introduce cross-table deduplication or new attempt
  semantics.
- Chromium E2E was not run in this worktree per the task brief; the controller
  should rerun the original saved learning loop as the acceptance proof.

## Upstream and license

This repository-only regression fix does not use YouTube Digest code. It does
not copy or adapt any LLM Wiki GPLv3 code, tests, prompts, components, assets, or
other material. Existing project licensing remains unchanged.
