# Structured Output Final Repair — Practice Material Version Gate

## Scope

- Plan: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, final Task 9 review repair.
- Baseline commit: `ab524cec806e70e34f7f35a5f6ad054b0a485f0c`.
- Worktree: `/private/tmp/popcorn-structured-output-final-practice-material`.
- Branch: `codex/structured-output-final-practice-material`.

## Allowed files

- `src/server/repositories/practice-material-repository.ts`
- `src/server/repositories/practice-material-repository.test.ts`
- `docs/engineering/handoffs/structured-output-final-repair-practice-material-version.md`

Do not modify database migrations, generated database types, routes, UI, contracts, root configuration, lockfiles, or any other file.

## Contract and data-flow boundary

The immediate Practice page must only consume a draft that the attempt submission repository can also consume. Reuse `isReadableActivationPromptVersion` from `@/server/ai/prompts/activate.v1` and mirror the existing `readableDraft` provenance rule:

- A legacy/fixed fixture is readable only when `activation_prompt_version`, model, gateway config id, gateway revision, and gateway fingerprint are all `null`.
- A generated draft is readable only when all five fields are present and the prompt version is explicitly supported (`activate-practice-v1` or `activate-practice-v2` via the shared helper).
- Unknown versions and mixed null/non-null provenance fail closed and return `null`.

The query must select the activation provenance fields. Do not expose them in `PracticeMaterialView`; the existing output shape and downstream Saved → Practice → attempt submission flow must remain unchanged.

## TDD evidence

First add focused tests that demonstrate RED for:

1. readable v1 generated provenance;
2. readable v2 generated provenance;
3. unknown activation version rejection;
4. mixed provenance rejection;
5. preservation of the existing all-null fixture/legacy case.

Then make the smallest production change needed for GREEN. Do not weaken strict schemas or assertions.

## Verification

Run only:

```bash
pnpm exec vitest run src/server/repositories/practice-material-repository.test.ts
pnpm typecheck
git diff --check
```

No full suite, browser, database, real gateway, or end-to-end test is required for this repair.

## Upstream and license

No upstream code is needed. Do not copy code, prompts, tests, components, or assets from `nashsu/llm_wiki` (GPLv3). YouTube Digest reuse is outside this repair and must remain untouched.

## Handoff

Commit the scoped changes and report the commit SHA, RED and GREEN evidence, focused test/typecheck results, risks, and handoff path.
