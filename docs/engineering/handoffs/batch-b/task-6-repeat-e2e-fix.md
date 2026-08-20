# Batch B Task 6 repeat-E2E repair handoff

## Scope and baseline

- Assignment HEAD: `2009a742f21dbfa07cec873f9abd034f4d989dcc`.
- Repair brief baseline: `6ca6d1930c1d293f384fb66e42cd3e05ea6eb559`.
- Worktree: `/private/tmp/popcorn-batch-b-6-cleanup-fix`.
- Modified only `tests/e2e/saved-learning-loop.spec.ts` and this handoff.
- No production code, migration, root configuration, lockfile, CI, other test,
  provider, prompt, gateway, or ledger change.

## RED and diagnosis

With local Supabase, fixture providers, and no database reset, the original test
reproduced the 60-second timeout at `page.waitForURL`. The webpack fixture server
recorded only Home/Saved/detail GETs and no `POST /api/v1/practice/tasks`.

Replacing the navigation-only wait with a diagnostic `page.waitForResponse`
reproduced the same 60-second timeout at the request boundary. There was still
no activation POST, so there was no status or response body to inspect. This
excluded a hidden non-201 backend response: the visible server-rendered button
was clicked before its client handler was ready after Next client navigation.

The default Playwright web server could not start in this temporary worktree
because Next 16 Turbopack rejected the pnpm realpath. The diagnostic runs used
the same worktree source through `next dev --webpack`; no root config was edited.

## Minimal repair

- Wait for the Saved detail client navigation to reach `networkidle` before
  clicking the client-component action.
- Explicitly wait for `POST /api/v1/practice/tasks`.
- Read its response body and include status plus body in the assertion message.
- Require HTTP 201 before separately asserting the practice-page navigation.

This keeps backend failures fail-fast and distinguishable from navigation or
hydration failures.

## GREEN evidence

Against the same local Supabase instance, with no reset between runs:

1. Focused chromium-web E2E: 1 passed in 6.3s.
2. Consecutive focused chromium-web E2E: 1 passed in 3.3s.

The fixture server recorded `POST /api/v1/practice/tasks 201` in both runs,
followed by successful original-attempt and revision POSTs. Each run's existing
`afterAll` cleanup completed; the second setup reused the fixed fixture IDs
without conflict.

Static verification after the final edit:

- `pnpm eslint tests/e2e/saved-learning-loop.spec.ts` — exit 0.
- `pnpm typecheck` — exit 0.
- `git diff --check` — exit 0.

The Next development server's generated `AGENTS.md`, `CLAUDE.md`, and
`next-env.d.ts` changes were removed and are not included.

## Residual risk

The controller still owns the immediate full pgTAP run and final consecutive
E2E confirmation in the integration worktree. No live provider or user API key
was used; both runs used deterministic fixtures.
