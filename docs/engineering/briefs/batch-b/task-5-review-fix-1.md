# Batch B Task 5 review fix 1

## Assignment

- Plan: Batch B Task 5.
- Baseline: `bee0851115ca5f9d2eb28360bdfad330dd668485`.
- Worktree: `/private/tmp/popcorn-batch-b-5-fix`.
- Independent review: FAIL on two user-visible state/suggestion semantics.

## Allowed files

- Modify: `src/features/practice/practice-session.tsx`
- Modify: `src/features/practice/practice-session.test.tsx`
- Modify: `src/server/repositories/review-task-repository.ts`
- Modify: `tests/integration/memory/vault-practice.test.ts`
- Create: `docs/engineering/handoffs/batch-b/task-5-review-fix-1.md`

Everything else is forbidden, including migrations, generated types, other Task 5
files, root config/lockfile/CI/ledger, gateway/Provider code, and original handoff.

## Required TDD repairs

Write failing tests first and record RED evidence.

1. Vault-entry UI state:
   - failed original followed by passed revision 2 does not show a Vault link;
   - passed original shows the link, and a later failed optional revision preserves
     that existing link;
   - learner response preservation and feedback behavior remain unchanged.
   Track whether the original attempt created Vault state; do not infer it from the
   latest revision's `passed` value and do not change API/shared contracts.
2. Possible-match suggestions:
   - `getVault` excludes the current `userExpressionId` from candidates;
   - a different expression with the same normalized text is `exact` and first;
   - only positive Chinese trigram/short-substring similarity may be `similar`;
   - zero-overlap candidates are omitted;
   - score/exact/text/ID ordering remains deterministic and output remains <= 8;
   - suggestions remain read-only and create no merge/write path.

Do not add unrelated hardening or tests.

## Verification

```bash
./node_modules/.bin/vitest run \
  src/features/practice/practice-session.test.tsx \
  tests/integration/memory/vault-practice.test.ts
./node_modules/.bin/vitest run \
  tests/integration/learning-loop/record-valid-attempt.test.ts \
  tests/integration/memory/vault-practice.test.ts \
  tests/integration/practice/attempts.test.ts \
  src/features/practice/practice-session.test.tsx
./node_modules/.bin/tsc --noEmit --pretty false
git diff --check bee0851115ca5f9d2eb28360bdfad330dd668485..HEAD
```

Do not repeat database, full application, build, or browser gates: this is a focused
UI/pure-ranking repair and the Task 5 candidate build already passed 25/25.

## Upstream and license

- YouTube Digest commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`:
  no applicable implementation; do not add extraction code.
- LLM Wiki v0.6.9 commit `723e259309aea5e3850265b631f80224f66dd9f6`:
  method-only; copy no GPLv3 code/tests/prompts/components/assets.

## Handoff

Commit only the allowlist. Return RED/GREEN, full focused regression, TypeScript,
diff check, risk, SHA, and handoff path. A new independent re-review is required.
