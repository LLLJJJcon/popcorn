# Batch C Task 2 revised handoff — Due Practice completion

## Delivered scope

- `create-transfer-task.ts` creates an answer-free, normalized different-context prompt and leaves the original prompt out of its public task.
- `complete-due-practice.ts` reads an owner-scoped transfer task, selects the CI fixture before gateway resolution, evaluates before invoking the sole `complete_due_practice` RPC, preserves RPC IDs/state/schedule, and exposes generic no-store error handlers.
- The dynamic owner route creates/reads the transfer task by review ID and completes it; the Due UI holds the learner response on failure and allows a retry.
- The existing Due-list route now maps unexpected errors to a no-store generic response rather than passing through a repository failure.

## TDD evidence

RED was recorded before production modules existed:

```bash
node_modules/.bin/vitest run tests/integration/practice/due-transfer.test.ts src/server/domain/complete-due-practice.test.ts
```

Both suites failed to resolve the absent domain modules. GREEN subsequently covered independent `tried -> reused`, RPC-owned `reused -> owned`, assisted non-promotion, deterministic exact replay, stale/future/graph failure mapping, zero completion RPC calls on gateway failure, answer-free transfer context, generic public errors, and UI response/retry behavior.

## Verification

- `node_modules/.bin/vitest run tests/integration/practice/due-transfer.test.ts src/server/domain/complete-due-practice.test.ts src/features/practice/due-practice.test.tsx`
- `node_modules/.bin/tsc --noEmit`
- `node_modules/.bin/eslint src/server/domain/create-transfer-task.ts src/server/domain/complete-due-practice.ts src/features/practice/due-practice.tsx src/app/api/v1/practice/due`
- `git diff --check`

No migration, generated type, repository, shared gateway/runtime/Vault, package, lockfile, extension, ledger, database reset, pgTAP, or concurrency command was changed or run.

## Remaining review focus

- Read-only review should confirm the transfer-task insert is not treated as a completion write and that the frozen RPC remains the only attempt/mastery/review mutation.
- The browser UI intentionally exposes only unaided submission. The domain and RPC input preserve `none`, `hint`, and `model_answer` for future assistance controls without asserting client-supplied mastery.
