# User Model Gateway Task 2 Review Fix 1 Brief

## Identity and workspace

- Plan: `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`, Task 2.
- Original review baseline: `3d0e6842a4867fb59c07b9abcf6fa444dd794a16`.
- Rejected candidate: `2b9f651655f23ec156cb17e3d3bbf03a0a3f6089`.
- Fix baseline after reviewed CONTRACT-008B cherry-pick: `51a47c6`.
- Worktree: `/private/tmp/popcorn-gateway-settings-api`.
- A fresh implementation Agent must use strict RED/GREEN for exactly the three
  blockers below, commit, and hand off for a fresh full-diff review.

## Allowed files

- `src/server/auth/web-session.ts`
- `src/server/auth/web-session.test.ts`
- `src/server/repositories/model-gateway-settings-repository.ts`
- `src/app/api/v1/settings/model-gateway/route.ts`
- `src/app/api/v1/settings/model-gateway/consent/route.ts`
- `tests/integration/model-gateway/settings-service.test.ts`
- `tests/integration/model-gateway/settings-api.test.ts`
- this brief
- `docs/engineering/handoffs/batch-a/user-model-gateway-settings-api-review-fix-1.md`
- the existing Task 2 handoff only to append corrected verification if needed

All other files are forbidden, including scoped env contracts, migrations,
generated types, shared DTOs, root config/lockfile, UI, extension, and artifact
files.

## Blockers and required RED/GREEN

1. Both production routes must consume the frozen
   `getModelGatewaySettingsEnv`, never `getServerEnv`. Add a production-route
   regression test proving a request can initialize with only the four scoped
   settings variables and no legacy OpenAI, Supadata, extension, or worker
   variables. Missing a scoped dependency must still fail closed. Mock only
   external runtime seams; do not replace the function under test with a fake.

2. `listConfigs(userId)` must throw if any service-role query result has a
   different `user_id`; it must not silently `.filter()` the row. Add a direct
   repository regression with mixed-owner returned rows that is RED against the
   rejected candidate and GREEN only when mismatch fails closed. Retain the
   explicit `.eq("user_id", userId)`, newest-first ordering, and limit 20.

3. Extract one reusable Next-compatible cookie-store adapter factory in
   `web-session.ts`. Both routes must import and use it; neither may define a
   local `nextCookieAdapter`. Test exact `getAll` mapping, `setAll` forwarding,
   and preservation of secure cookie options from the shared SSR client
   factory. The adapter accepts a narrow injected cookie-store interface so the
   auth module need not import a Next request context. Task 3 must be able to
   reuse the same factory for sign-in/callback/sign-out.

Retain all prior requirements: cookie-only verified auth, exact Origin before
body/repository, no-store, strict 8 KiB body, atomic lifecycle RPCs, boolean-only
credential presence, owner isolation, sanitized errors, zero Provider calls,
and no secret material.

## Verification

```bash
./node_modules/.bin/vitest run src/server/auth/web-session.test.ts \
  tests/integration/model-gateway/settings-service.test.ts \
  tests/integration/model-gateway/settings-api.test.ts
./node_modules/.bin/vitest run src tests/contract tests/integration tests/provenance --passWithNoTests
./node_modules/.bin/eslint src tests --max-warnings 0
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build --webpack
git diff --check
git status --short
```

No upstream implementation applies. Copy no YouTube Digest code and no GPLv3
LLM Wiki code, tests, prompts, components, styles, or assets.
