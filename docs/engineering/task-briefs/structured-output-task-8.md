# Structured Output Reliability — Task 8 Brief

## Identity

- Plan task: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 8, **Practice Non-Pass Feedback and Consistent Revision UX**.
- Product baseline: `cb06a7d` (Tasks 1–5 accepted and integrated).
- Execution baseline: controller commit containing this brief; record exact SHA.
- Worktree: `/private/tmp/popcorn-structured-output-task-8`.
- Branch: `codex/structured-output-task-8`.

## Allowed files

- `src/features/practice/evaluation-panel.tsx`
- `src/features/practice/evaluation-panel.test.tsx`
- `src/features/practice/practice-session.tsx`
- `src/features/practice/practice-session.test.tsx`
- `src/features/practice/due-practice.tsx`
- `src/features/practice/due-practice.test.tsx`
- `src/features/practice/practice-workspace.module.css`
- `src/features/practice/api.ts`
- `docs/engineering/handoffs/structured-output-task-8.md`

Everything else is forbidden: server/domain logic, prompts/schemas/contracts,
migrations, extension, root config, dependencies, lockfile, and ledger.

## Consumes and produces

- Consume unchanged server-enriched `EvaluationResultSchema`; never trust or
  recompute model wire `passed`, assistance, mastery, or scheduling.
- Deterministically derive presentation only: failed dimensions are scores below
  3; focus is the lowest score with stable dimension order as tie-break.
- For scores 2/4/1 show `Keep practising - 2 areas need work`, explicit first
  focus, and that the expression was not added to Vault. Emphasize only sub-3
  dimensions and show existing specific feedback.
- Original `Revise and check again` calls the real revision endpoint exactly
  once. Due post-feedback shows learner and suggested Chinese side by side under
  `Compare with suggested revision`, makes zero new API/Provider calls, and does
  not say checked/evaluated/scored.
- Preserve textarea contents after valid non-pass and system error. A natural
  suggested revision remains optional; do not invent another model field.
- Produce no server/API/persistence/domain shape change.

## TDD and verification

Write failing component tests first for the exact non-pass hierarchy, stable
focus/tie behavior, dimension emphasis, Vault consequence, original one-call
revision, Due zero-call comparison/copy, optional revision, and textarea
preservation. Expected RED is current generic heading/ambiguous Due copy and
inconsistent revision behavior.

Run only:

```bash
pnpm exec vitest run src/features/practice/evaluation-panel.test.tsx src/features/practice/practice-session.test.tsx src/features/practice/due-practice.test.tsx
pnpm typecheck
git diff --check <execution-baseline>..HEAD
git status --short
```

The allowed `practice-session.test.tsx` currently owns seven known missing-
`savedReturnTarget` TS2741 fixture errors; update those fixtures when touched so
Task 8 should preferably restore clean typecheck, and must add no diagnostics.
Do not run full suite, build, browser, DB, or Provider. Commit code plus handoff;
return SHA, RED/GREEN, typecheck result, risks, clean status. Do not
merge/rebase/push.

## Upstream/license

No upstream code is needed. Preserve YouTube Digest MIT pin
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`. LLM Wiki v0.6.9 commit
`723e259309aea5e3850265b631f80224f66dd9f6` is GPLv3 method-only; copy no code,
tests, prompts, components, or assets.

An independent read-only Agent must PASS the full baseline-to-HEAD diff before
integration. Critical/Important findings require TDD repair and fresh re-review.
