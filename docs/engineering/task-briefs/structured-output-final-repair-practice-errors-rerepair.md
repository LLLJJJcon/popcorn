# Final Repair A — Practice Persistence Classification Re-repair

- Parent implementation: `08115646e1857710357638e917ae004eed7ae411`.
- Parent execution baseline: `4c8ea39bdf861271098606b1274257c5a69b0d38`.
- Re-repair worktree: `/private/tmp/popcorn-structured-output-final-practice-errors-rerepair`.
- Branch: `codex/structured-output-final-practice-errors-rerepair`.
- Re-repair baseline: controller commit containing this brief.

## Sole Important

When a completed persisted Due attempt cannot satisfy the current strict schema,
`complete-due-practice.ts` still throws legacy `PROVIDER_FAILED`. This is a
persistence/internal failure, not live model output.

First add a service RED and an HTTP-level RED for a completed malformed persisted
attempt. They must require `PracticeError("INTERNAL_ERROR", true)` and public
`INTERNAL_ERROR`, HTTP 500, `retryable: true`, with no raw sentinel. Then replace
the legacy classification with the existing shared mapping semantics. Do not
change valid replay, Provider evaluation, domain output, or persistence writes.

## Allowed files

- `src/server/domain/complete-due-practice.ts`
- `src/server/domain/complete-due-practice.test.ts`
- `tests/integration/practice/attempts.test.ts`
- `docs/engineering/handoffs/structured-output-final-repair-practice-errors-rerepair.md`

Everything else is forbidden.

## Verification

```bash
pnpm exec vitest run tests/integration/practice/attempts.test.ts src/server/domain/complete-due-practice.test.ts
pnpm typecheck
git diff --check <parent-implementation>..HEAD
git status --short
```

No full suite/DB/browser/Provider. Commit + handoff; return SHA, RED/GREEN,
typecheck/risks/clean. No merge/rebase/push. Preserve MIT/GPL boundaries.
