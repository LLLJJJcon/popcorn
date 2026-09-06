# Structured Output Final Repair — Practice Material Version Gate Handoff

## Scope and root cause

- Baseline: `ab524cec806e70e34f7f35a5f6ad054b0a485f0c`
- Branch: `codex/structured-output-final-practice-material`
- The immediate Practice material repository did not select or validate Activation prompt and gateway provenance. It could therefore render a draft that the attempt repository would later reject on submission.
- The repair reuses `isReadableActivationPromptVersion` and mirrors the attempt repository's finite-version/all-null-or-all-present rule without changing `PracticeMaterialView`.

## TDD evidence

RED command (using the existing dependency runtime directly because this isolated worktree has no independent install):

```bash
./node_modules/.bin/vitest run --configLoader runner src/server/repositories/practice-material-repository.test.ts
```

Before production changes: 1 file failed; 5 tests failed and 23 passed. The readable v1/v2 cases and all-null compatibility case returned `null`, proving the old strict row schema/query did not consume Activation provenance.

GREEN with the same command: 1 file passed; 28 tests passed.

Added focused coverage for:

- readable `activate-practice-v1` provenance;
- readable `activate-practice-v2` provenance;
- unknown version rejection;
- mixed null/non-null provenance rejection;
- preservation of the all-null fixture/legacy case;
- selection of all five Activation provenance fields.

## Implementation

- Added the five Activation provenance fields to the strict draft row schema and query projection.
- Added a local readability guard with the same rule as `attempt-repository.ts`.
- Kept the existing public material view and Saved → Practice → attempt consumer shapes unchanged.

## Verification

- Focused repository test: 28/28 passed.
- TypeScript: `./node_modules/.bin/tsc --noEmit` passed (equivalent to `pnpm typecheck`).
- `git diff --check` passed.
- No full suite, browser, database, real gateway, or end-to-end test was run, as required.

## Risks

- This focused repair relies on the existing database constraints for generated provenance value quality beyond non-nullness; it intentionally mirrors the attempt repository instead of introducing a divergent validation policy.
- Manual/browser behavior remains outside this repair's acceptance scope.
