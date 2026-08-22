# Delivery Task 4 Verification Repair 2 — Make practice wiring test CI-stable

## Assignment

- Parent: revised Delivery Task 4 final `pnpm verify` gate.
- Baseline/HEAD before repair: `dca9df0b1b037dabb1978ee5c53dfa731a9943ea`.
- Worktree: `/private/tmp/popcorn-delivery-4`.

## Allowed files

- Modify `tests/integration/practice/attempts.test.ts`.
- Create `docs/engineering/handoffs/delivery/task-4-verification-repair-2.md`.
- This brief.

Every runtime file, CI/acceptance file, package/lockfile, migration, generated file, and other test is forbidden.

## RED and root cause

`CI=true pnpm verify` passed unit 190/190 and contract 181/181, then failed one of 330 integration tests. The production practice route wiring test hard-codes `createPracticeServerServices(client, false)`, while each accepted route intentionally passes `process.env.CI === "true"`; GitHub CI and Task 4 fixture CI set `CI=true`, so the received value is correctly `true`.

The test is intended to verify production/non-fixture wiring and must not inherit the invoking shell's CI state. This is test-environment drift, not a runtime defect.

## Minimal GREEN

- Inside only the `production practice route wiring` describe, explicitly stub `CI` to the non-fixture value before module imports and restore environment state after the test.
- Preserve the existing `false` assertion and every auth/client/service mutation assertion.
- Do not change routes or make the assertion depend on ambient CI.

## Verification

```bash
CI=true pnpm vitest run tests/integration/practice/attempts.test.ts -t 'the three POST-only route modules wire cookie auth and service mutations'
CI=true pnpm vitest run tests/integration/practice/attempts.test.ts
CI=true pnpm eslint tests/integration/practice/attempts.test.ts
git diff --check
```

Commit implementation and a separate handoff. Return SHAs, tests, and risks; do not integrate or push.

No upstream code or licensing change is involved.
