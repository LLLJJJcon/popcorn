# User Model Gateway Task 3 Handoff

## Provenance

- Plan: `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`, Task 3.
- Baseline: `8c13805`.
- Controller brief: `593e271`.
- Implementation commit: `493d036`.
- Worktree: `/private/tmp/popcorn-gateway-settings-ui`.
- Branch: `codex/popcorn-gateway-settings-ui`.

## Delivered behavior

- Added server-only email magic-link PKCE sign-in, callback, and sign-out routes.
- Reused Task 2 `createPopcornSsrServerClient` and `createNextCookieAdapter`; no browser
  Supabase client or alternate session-cookie convention was added.
- Added verified `auth.getUser()` authorization for the server-rendered gateway settings page.
- Added an accessible model gateway settings UI for approved-origin create, exact consent,
  rename, write-only key rotation, and inline-confirmed revoke.
- Every successful mutation response is parsed with the frozen DTO, discarded, and followed
  by a no-store GET refetch.
- Create and rotation key state is cleared before validation/network handling continues; all
  surfaced failures are generic and never interpolate request, provider, or Supabase text.

## Strict TDD evidence

### RED

Auth tests were written first and run with:

```bash
./node_modules/.bin/vitest run src/server/auth/web-auth-flow.test.ts \
  src/app/sign-in/sign-in-form.test.tsx \
  tests/integration/model-gateway/settings-web-auth.test.ts
```

Observed: three failing files. The two unit suites failed import resolution for the missing
`web-auth-flow` and `sign-in-form`; integration assertions failed because the three auth routes
and authorized settings page did not exist.

UI tests were then written first and run with:

```bash
./node_modules/.bin/vitest run \
  src/app/settings/model-gateway/model-gateway-settings.test.tsx
```

Observed: one failing file because `model-gateway-settings` did not exist. This was the expected
missing-feature failure before UI implementation.

### GREEN

```text
Task 3 focused: 4 files, 36 tests passed
Task 2 regression: 2 files, 28 tests passed
Full Vitest: 24 files, 383 tests passed
```

The focused tests cover strict Origin/body/email handling, enumeration-safe magic-link output,
one-time flow matching and clearing, malformed callback rejection, fixed redirects, sign-out,
verified page auth, every settings state and mutation shape, refetches, consent contents,
accessibility, duplicate submits, and secret clearing/non-persistence.

## Final verification

All commands exited 0 before the implementation commit:

```bash
./node_modules/.bin/vitest run src/server/auth/web-auth-flow.test.ts \
  src/app/sign-in/sign-in-form.test.tsx \
  src/app/settings/model-gateway/model-gateway-settings.test.tsx \
  tests/integration/model-gateway/settings-web-auth.test.ts

./node_modules/.bin/vitest run tests/integration/model-gateway/settings-api.test.ts \
  tests/integration/model-gateway/settings-service.test.ts

./node_modules/.bin/vitest run src tests/contract tests/integration tests/provenance \
  --passWithNoTests

./node_modules/.bin/eslint src tests --max-warnings 0
./node_modules/.bin/tsc --noEmit

env NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key \
  SUPABASE_SERVICE_ROLE_KEY=service-role-key \
  APP_URL=https://popcorn.example \
  ./node_modules/.bin/next build --webpack

git diff --check
```

The production build compiled and emitted dynamic routes for `/auth/callback`, `/auth/sign-in`,
`/auth/sign-out`, and `/settings/model-gateway`, plus the existing settings APIs.

## Security, scope, and license confirmation

- API keys are not placed in browser storage, URL/history, console output, analytics, status/error
  text, server markup, snapshots, or optimistic response state. Tests exercise success,
  validation, HTTP, strict-parse, network, rotation, and remount paths.
- The browser receives only approved origins. There are no custom URL, base-path, provider-header,
  prompt, generic input, image/screenshot, or extension configuration controls.
- No Task 2 routes/services, shared contract, migration, generated type, root configuration,
  lockfile, extension file, or artifact file was changed.
- No real email, Provider request, API credential, or user secret was used.
- No YouTube Digest code was applicable. No LLM Wiki GPLv3 code, test, prompt, component, style,
  or asset was copied; this implementation is original and GPL-isolated.

## Residual risks and manual follow-up

- CI uses fakes only. A real Supabase email delivery and PKCE callback remains an authorized
  Delivery-stage manual check after local product acceptance.
- Responsive and keyboard behavior is covered structurally and through jsdom interactions, but
  final browser visual QA remains part of the Delivery demo gate.
