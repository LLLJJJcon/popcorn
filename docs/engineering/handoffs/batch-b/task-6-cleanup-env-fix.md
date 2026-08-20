# Batch B Task 6 cleanup subprocess environment repair handoff

## Scope and baseline

- Baseline: `6ac36c684869ebd55b47576c1d23112f7f496285`.
- Worktree: `/private/tmp/popcorn-batch-b-6-cleanup-fix`.
- Changed only the Task 6 E2E cleanup harness, its contract test, this handoff,
  and the controller-provided repair brief.
- No production code, migration, database permission, root configuration,
  lockfile, CI, provider, prompt, gateway, or ledger change.

## RED evidence

The new contract test was run before the safe helper existed:

```text
FAIL tests/contract/e2e/saved-learning-loop-cleanup.test.ts
Failed to resolve import "../../e2e/saved-learning-loop-cleanup"
Test Files 1 failed; Tests no tests
```

The missing API was the intended RED: the E2E cleanup had no independently
testable subprocess boundary capable of enforcing an exact environment.

## Repair

- Extracted the cleanup subprocess boundary to
  `tests/e2e/saved-learning-loop-cleanup.ts`; the scoped SQL remains unchanged
  in the Playwright spec.
- Preserved the exact protocol, loopback host, port, database, user, non-empty
  password, query, and fragment checks.
- Replaced broad `process.env` inheritance with an explicit allowlist:
  `PATH`, `LANG`, `LC_ALL`, and `LC_CTYPE` when present, plus validated
  `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`.
- Adds bounded `PGCONNECT_TIMEOUT=5`, fixed
  `PGAPPNAME=popcorn-saved-learning-loop-cleanup`, and `PGSSLMODE=disable`.
- Does not pass `HOME`, `PGHOSTADDR`, `PGSERVICE`, `PGSERVICEFILE`, service
  secrets, model secrets, or any other inherited field.
- Retains argument-array `execFile`, generic credential-free failure text,
  receipt-first owner-scoped SQL, reserved-email guard, and zero-residual
  verification.

## GREEN evidence

- `pnpm vitest run tests/contract/e2e/saved-learning-loop-cleanup.test.ts` —
  1 file, 5 tests passed.
- `pnpm eslint tests/e2e/saved-learning-loop.spec.ts tests/e2e/saved-learning-loop-cleanup.ts tests/contract/e2e/saved-learning-loop-cleanup.test.ts` — exit 0.
- `pnpm typecheck` — exit 0.
- `git diff --check` — exit 0.

Per the brief, no dynamic browser E2E or pgTAP command was run in this repair
worktree. The controller retains responsibility for E2E twice followed by the
full pgTAP run after integration.

## Residual risk

The static/unit contract proves the exact `execFile` environment and fail-closed
URL behavior, but actual local `psql` execution and cleanup repeatability remain
for the controller's integration verification. No live provider or user API key
was used.
