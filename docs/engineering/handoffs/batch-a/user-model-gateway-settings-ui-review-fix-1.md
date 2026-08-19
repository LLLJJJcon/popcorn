# User Model Gateway Task 3 Review Fix 1 Handoff

## Provenance

- Plan task: User Model Gateway Task 3.
- Original baseline: `8c13805`.
- Rejected candidate: `fafc55f8c3802e718ebd6dc6d8924bc737e03886`.
- Controller fix brief: `cc725ead53926b9c4493bc330a7542f426f0a078`.
- Fix implementation: `797b88c`.
- Worktree: `/private/tmp/popcorn-gateway-settings-ui`.
- Branch: `codex/popcorn-gateway-settings-ui`.

## Delivered fixes

1. The Web PKCE callback now accepts only a lowercase canonical RFC 4122
   version-4 authorization UUID before calling `exchangeCodeForSession`. The
   accepted format follows the example shipped in the pinned
   `@supabase/auth-js@2.112.3` source documentation. Invalid percent text,
   decoded NUL/control/newline data, Unicode, HTML/metacharacters, whitespace,
   overlength values, uppercase/non-hyphenated IDs, wrong UUID versions, and
   wrong variants all fail before exchange. Every callback attempt still
   clears the one-time flow cookie and redirects only to fixed local paths.
2. Empty rename and rotation submissions now associate the visible
   `role=alert` message with the exact invalid input using `aria-invalid` and
   `aria-describedby`. Editing that input clears its invalid association and
   visible validation error. A valid action clears invalid state before the
   request, and rotation still clears the write-only key immediately on every
   submission path and on cancellation/opening.

## Strict TDD evidence

### RED

Tests were added before production changes and run with:

```bash
./node_modules/.bin/vitest run src/server/auth/web-auth-flow.test.ts \
  src/app/settings/model-gateway/model-gateway-settings.test.tsx
```

Observed: 2 test files failed, with 12 expected regression failures among 48
tests. Ten malformed/noncanonical authorization-code cases reached the exchange
mock and redirected to settings; empty rename and rotation each lacked
`aria-invalid`/`aria-describedby`. Newline, surrounding whitespace, and
overlength cases already failed closed under the earlier length/trim checks and
remained in the parameterized security matrix.

### GREEN

After the minimal boundary and accessibility-state fixes, the same command
reported 2 files and 48 tests passed.

## Fresh verification

All of the following completed with exit code 0 after the final test edit:

```text
Focused auth/UI regression: 4 files, 51 tests passed
Full Vitest: 24 files, 398 tests passed
ESLint: 0 warnings/errors
TypeScript: no errors
Next.js production build: compiled, typed, and generated 15/15 pages
git diff --check: clean
```

Commands:

```bash
./node_modules/.bin/vitest run src/server/auth/web-auth-flow.test.ts \
  src/app/sign-in/sign-in-form.test.tsx \
  src/app/settings/model-gateway/model-gateway-settings.test.tsx \
  tests/integration/model-gateway/settings-web-auth.test.ts

./node_modules/.bin/vitest run src tests/contract tests/integration \
  tests/provenance --passWithNoTests

./node_modules/.bin/eslint src tests --max-warnings 0
./node_modules/.bin/tsc --noEmit

env NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key \
  SUPABASE_SERVICE_ROLE_KEY=service-role-key \
  APP_URL=https://popcorn.example \
  ./node_modules/.bin/next build --webpack

git diff --check
```

The first build attempt without environment variables stopped at the existing
environment schema because the four required values were absent. The documented
non-secret placeholder environment above then completed the build; it made no
network, email, or Provider request.

## Scope, security, license, and risks

- Only the four implementation/test files permitted by the fix brief and this
  handoff were changed. The controller brief itself was not modified.
- No real authorization code, email, Provider, model key, or user secret was
  used. Test values are synthetic, and the key-leak assertion runs only after
  submission has synchronously cleared the password state and DOM.
- No API, migration, shared contract, root configuration, lockfile, extension,
  or Batch A artifact file changed.
- No YouTube Digest implementation applied. No LLM Wiki GPLv3 code, test,
  prompt, component, style, or asset was copied.
- Real email delivery/PKCE remains a Delivery-stage manual verification with
  authorized credentials. Browser visual QA remains outside this jsdom-only
  fix task.
