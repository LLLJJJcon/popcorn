# Batch B Task 5 review fix 1 handoff

- Plan/task: `2026-08-16-popcorn-batch-b-learning-loop.md`, Task 5 review fix 1.
- Baseline: `bee0851115ca5f9d2eb28360bdfad330dd668485`.
- Brief commit: `3cc318d3b93b54e9bceda36e8c3216bfc0026eca`.
- Worktree: `/private/tmp/popcorn-batch-b-5-fix`.

## Outcome

`PracticeSession` now records whether the original attempt created the Vault
entry. A passed original keeps its link through later optional failed revisions;
a failed original cannot acquire a link merely because revision 2 passes. The
latest attempt still controls feedback, and learner response text remains intact.

Vault suggestions now exclude the current expression before ranking. Ranking
retains different-expression normalized exact matches first, keeps only positive
Chinese trigram or short-substring similarity, deterministically orders exact /
score / text / ID, and remains capped at eight. The path remains read-only.

## TDD evidence

UI RED:

```text
./node_modules/.bin/vitest run src/features/practice/practice-session.test.tsx
exit 1; 2 failed, 2 passed
```

The old implementation removed the link after a failed revision and added it
after a passing revision whose original had failed.

UI GREEN:

```text
./node_modules/.bin/vitest run src/features/practice/practice-session.test.tsx
exit 0; 4 passed
```

Suggestion RED:

```text
./node_modules/.bin/vitest run tests/integration/memory/vault-practice.test.ts
exit 1; 2 failed, 6 passed
```

The old implementation returned a zero-overlap candidate and included the
current `userExpressionId` in Vault-detail suggestions.

Suggestion GREEN:

```text
./node_modules/.bin/vitest run tests/integration/memory/vault-practice.test.ts
exit 0; 8 passed
```

## Verification

```text
./node_modules/.bin/vitest run \
  src/features/practice/practice-session.test.tsx \
  tests/integration/memory/vault-practice.test.ts
exit 0; 2 files, 12 tests passed

./node_modules/.bin/vitest run \
  tests/integration/learning-loop/record-valid-attempt.test.ts \
  tests/integration/memory/vault-practice.test.ts \
  tests/integration/practice/attempts.test.ts \
  src/features/practice/practice-session.test.tsx
exit 0; 4 files, 53 tests passed

./node_modules/.bin/tsc --noEmit --pretty false
exit 0

git diff --check
exit 0
```

Database, full build, and browser gates were intentionally not repeated, as the
brief limits this review fix to focused UI and pure ranking behavior.

## Upstream, license, and risk

No YouTube extraction code was changed, so YouTube Digest has no applicable reuse
for this fix. No LLM Wiki GPLv3 code, tests, prompts, components, assets, wording,
or styling were copied.

Residual risk is limited to in-memory component state before navigation: the Vault
link reflects the original result returned in the current practice session. The
canonical Vault page remains the durable source of truth after navigation. No API
or shared contract changed, and no suggestion write or merge path was introduced.
