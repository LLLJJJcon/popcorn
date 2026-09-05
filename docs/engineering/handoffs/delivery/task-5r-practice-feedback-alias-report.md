# Task 5R — Practice evaluation feedback compatibility

Status: implemented. The Practice parser now accepts string `feedback` aliases for `accuracy`, `naturalness`, and `contextualFit`, while producing only the existing `score`/`englishFeedback` evaluation shape. Canonical `englishFeedback` remains accepted, and non-string/missing feedback still fails strict validation.

Commit SHA: 1a50156c5fb493af6c5a2640c9d4c8fe35e83c06

## TDD evidence

- RED: `pnpm vitest run src/server/ai/prompts/evaluate.v1.test.ts` — 3 tests, 1 failed. The alias case failed with Zod errors for missing `englishFeedback` and unrecognized `feedback` on all three dimensions.
- GREEN: `pnpm vitest run src/server/ai/prompts/evaluate.v1.test.ts` — 1 test file passed, 3 tests passed.

## Verification

- `pnpm eslint src/server/ai/prompts/evaluate.v1.ts src/server/ai/prompts/evaluate.v1.test.ts` — passed.
- `git diff --check 1192da8e5bbe30485c8dc084adf999b5ad4479ec..HEAD` — passed.
- `pnpm typecheck` — blocked by pre-existing unrelated fixture errors in `src/features/practice/practice-session.test.tsx` (`savedReturnTarget`) and `src/features/saved/candidate-list.test.tsx` (`videoSourceId`). No files outside the allowed scope were changed to address them.

## Files changed and scope check

- `src/server/ai/prompts/evaluate.v1.ts`
- `src/server/ai/prompts/evaluate.v1.test.ts`
- `docs/engineering/handoffs/delivery/task-5r-practice-feedback-alias-report.md`

Only the three files permitted by the brief were changed. No provider, persistence, database, auth, UI, root configuration, lockfile, or ledger changes were made.

## Risks / concerns

The full typecheck remains blocked by the noted baseline test-fixture type errors. The live provider was not called, and no credentials or raw model output were accessed or emitted.
