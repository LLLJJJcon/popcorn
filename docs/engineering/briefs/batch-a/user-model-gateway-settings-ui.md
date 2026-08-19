# User Model Gateway Task 3 Brief

## Task, baseline, and workspace

- Plan: `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`, Task 3.
- Accepted dependency: Task 2 integrated through `63f9b37`; ledger at `8c13805`.
- Baseline commit: `8c13805`.
- Branch: `codex/popcorn-gateway-settings-ui`.
- Worktree: `/private/tmp/popcorn-gateway-settings-ui`.
- Implement only this numbered task with strict RED/GREEN, commit, and hand off.

## Allowed files

Create or edit only:

- `src/app/settings/model-gateway/page.tsx`
- `src/app/settings/model-gateway/model-gateway-settings.tsx`
- `src/app/settings/model-gateway/model-gateway-settings.module.css`
- `src/app/settings/model-gateway/model-gateway-settings.test.tsx`
- `src/app/sign-in/page.tsx`
- `src/app/sign-in/sign-in-form.tsx`
- `src/app/sign-in/sign-in-form.test.tsx`
- `src/app/auth/sign-in/route.ts`
- `src/app/auth/callback/route.ts`
- `src/app/auth/sign-out/route.ts`
- `src/server/auth/web-auth-flow.ts`
- `src/server/auth/web-auth-flow.test.ts`
- `tests/integration/model-gateway/settings-web-auth.test.ts`
- this brief
- `docs/engineering/handoffs/batch-a/user-model-gateway-settings-ui.md`

Every other file is forbidden, especially Task 2 routes/services/auth factory,
shared contracts, migrations, generated types, root config/lockfile, globals,
extension, and Batch A artifact files. Report a frozen-interface blocker rather
than editing outside the allowlist.

## Consumed interfaces

- Reuse `createPopcornSsrServerClient` and `createNextCookieAdapter` from the
  accepted Task 2 Web-session module. Do not create a browser Supabase client or
  a second cookie convention.
- Consume `getModelGatewaySettingsEnv`, the four accepted settings API endpoints,
  frozen gateway Zod views/inputs, and standard API envelopes.
- Every settings mutation returns `ApiSuccess<ModelGatewayConfigView>`; always
  discard the local mutation response after strict parsing and refetch GET.

## Minimal Web authentication

The current integration tree has no ordinary Web login. Implement a minimal
server-only email magic-link PKCE loop:

- `/sign-in` renders an email form posting to `/auth/sign-in`.
- `POST /auth/sign-in` accepts only a bounded (4 KiB), strict UTF-8,
  `application/x-www-form-urlencoded` email body, enforces exact
  `Origin === new URL(APP_URL).origin`, generates a server flow UUID, stores a
  short-lived HttpOnly/SameSite=Lax/Path=/auth/callback cookie (Secure on HTTPS),
  and calls `signInWithOtp` with the one fixed callback URL. Never accept a
  caller redirect/callback/next/token.
- `GET /auth/callback` accepts exactly one `code` and one UUID flow value, checks
  it against the one-time flow cookie, clears the flow cookie, and calls
  `exchangeCodeForSession(code)`. It redirects only to the fixed settings page
  on success or fixed sign-in page on failure. Duplicate, missing, malformed,
  fragment, token, or arbitrary-next inputs fail closed.
- `POST /auth/sign-out` requires exact same origin, calls server `signOut`, and
  redirects only to `/sign-in`.
- All auth success/failure/redirect responses have `Cache-Control: no-store`;
  errors are generic and never contain raw Supabase text, email, code, cookies,
  service keys, or request bodies.
- Use `auth.getUser()` for page authorization. Unauthenticated settings page
  redirects to `/sign-in`; authenticated users never expose their identity in
  the client bundle. Bearer/extension tokens are irrelevant to this flow.

## Settings product surface

- Render approved origin selection, display name, model, and a write-only API
  key. Do not offer arbitrary URL, base path, headers, adapter, prompt, image,
  screenshot, generic URL, or extension-side configuration.
- Pending consent displays the exact canonical origin, policy
  `model-egress-v1`, and these fixed data classes: video title; necessary Chinese
  transcript excerpt or selection; timestamps; versioned prompt. Confirmation
  starts unchecked and submits only after explicit check.
- Active config displays non-secret name/model/origin/revision/state and only
  “Key saved” from `hasApiKey`; it supports rename, key rotation, and revoke.
  Revoked configs remain visibly revoked and never reveal old credentials.
- Password inputs use `type=password`, `autoComplete=off`, and
  `spellCheck=false`. Clear the DOM/state immediately after every submit attempt,
  including validation, HTTP, parse, and network failures. Rotation always opens
  empty. Never store a key in localStorage, sessionStorage, IndexedDB, URL,
  history, console, analytics, error/status text, server markup, or snapshots.
- Fetch with same-origin credentials and `cache: "no-store"`. Prevent duplicate
  submits. Refetch after mutation; do not keep a secret-bearing optimistic cache.

## UI, accessibility, and styling

Use a local CSS Module only. Follow the existing warm cream / terracotta / sage
Popcorn visual language without changing global CSS. Use semantic `main`,
`section` + `aria-labelledby`, explicit labels, `fieldset/legend`, status with
`aria-live=polite`, errors with `role=alert` and described invalid controls,
visible focus, text plus color for state, wrapping origins, and keyboard-usable
inline revoke confirmation. Do not use an inaccessible modal.

## Required RED evidence

Write failing tests before implementation for:

- magic-link POST exact-origin/body/email/callback and enumeration-safe errors;
- PKCE callback one-time flow matching, duplicate/malformed query rejection,
  fixed redirect, code exchange, and cookie clear;
- sign-out POST origin and fixed redirect;
- shared server cookie factory reuse and verified page authorization;
- loading, unauthenticated, empty catalog/config, failed request, pending,
  active, and revoked UI states;
- create/consent/rename/rotate/revoke endpoint shapes and GET refetch;
- fixed consent policy/data classes and unchecked default;
- API key DOM clearing on every success/failure path, remount non-persistence,
  no browser-storage/URL/history/console/HTML/error leakage, and no key echo;
- absence of custom URL/provider/header controls and extension configuration;
- accessible labels/status/errors/focusable confirmation and duplicate-submit
  prevention.

## Verification

```bash
./node_modules/.bin/vitest run src/server/auth/web-auth-flow.test.ts \
  src/app/sign-in/sign-in-form.test.tsx \
  src/app/settings/model-gateway/model-gateway-settings.test.tsx \
  tests/integration/model-gateway/settings-web-auth.test.ts
./node_modules/.bin/vitest run tests/integration/model-gateway/settings-api.test.ts \
  tests/integration/model-gateway/settings-service.test.ts
./node_modules/.bin/vitest run src tests/contract tests/integration tests/provenance --passWithNoTests
./node_modules/.bin/eslint src tests --max-warnings 0
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build --webpack
git diff --check
git status --short
```

## Upstream and license

No YouTube Digest UI applies. LLM Wiki remains method-only GPLv3 inspiration;
copy no code, tests, prompts, components, styles, or assets. No real Provider
call, real model key, or external email delivery is part of CI.

## Handoff

Write `docs/engineering/handoffs/batch-a/user-model-gateway-settings-ui.md`
with baseline/HEAD, genuine RED/GREEN evidence, exact verification, risks,
scope/license confirmation, and confirmation that no secret, Provider request,
or real email was used.
