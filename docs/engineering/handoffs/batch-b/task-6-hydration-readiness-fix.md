# Batch B Task 6 hydration-readiness repair handoff

## Scope and baseline

- Assignment HEAD: `279e725f0616c666a138dc969c5a2388f1ec322b`.
- Reviewed FAIL baseline: `744f947f00021d35842c63a4b3f3a6bc5e966441`.
- Worktree: `/private/tmp/popcorn-batch-b-6-cleanup-fix`.
- Modified only CandidateList and its focused component test, the Saved learning
  loop E2E, and this handoff. The controller-provided brief was already present.
- No migration, root configuration, lockfile, API/repository, generated file,
  provider, gateway, prompt, CI, or ledger change.

## RED evidence

The new component regression rendered the real CandidateList to server markup
and checked its native action before hydration. On the baseline:

```text
FAIL keeps the native action disabled in SSR, then enables one activation after hydration
Received element is not disabled: <button type="button" />
Test Files 1 failed; Tests 1 failed | 8 passed
```

This reproduces the browser diagnosis: the visible server-rendered action could
accept a click before React attached the client handler.

## Minimal repair

- CandidateList starts with `hydrationReady=false`.
- A client-only effect schedules readiness and cancels the scheduled callback on
  unmount. This satisfies the repository's no-synchronous-setState-in-effect
  lint rule while retaining the hydration boundary.
- CandidateExpressionCard receives disabled while hydration is not ready or an
  activation is pending.
- The regression proves the SSR native button is disabled, the client action
  becomes enabled, and one enabled click sends exactly one activation POST and
  performs one practice navigation.
- The browser test no longer uses `networkidle`; it waits for the native button
  to become enabled, then retains the explicit activation response wait,
  status/body diagnostic, HTTP 201 assertion, and navigation assertion.

## GREEN evidence

- Focused CandidateList suite: 1 file, 9 tests passed.
- Final focused chromium-web E2E run 1: 1 passed in 8.2s.
- Final consecutive focused chromium-web E2E run 2: 1 passed in 3.4s.
- There was no database reset between the two final runs. The fixture server
  recorded `POST /api/v1/practice/tasks 201` in both runs.
- Scoped ESLint for CandidateList, its test, and the E2E: exit 0.
- `pnpm typecheck`: exit 0.
- `git diff --check`: exit 0.

The temporary webpack server was required only because Next 16 Turbopack rejects
this worktree's pnpm realpath. Its generated `AGENTS.md`, `CLAUDE.md`, and
`next-env.d.ts` changes were removed and are not included.

## Residual risk

The controller owns the immediate full pgTAP run after integration and the
fresh independent re-review. No live provider or user API key was used; browser
runs used deterministic fixture mode against local Supabase.
