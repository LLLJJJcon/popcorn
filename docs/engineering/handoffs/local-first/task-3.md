# Local-First Task 3 Handoff

## Result

- Web account creation and sign-in now use the existing Supabase SSR cookie
  client with email/password and fixed success/error redirects.
- The magic-link callback, Google/Chrome Identity extension page, server token
  exchange/refresh broker, and their obsolete tests are removed.
- Extension Options now provides email/password sign-in and account creation;
  it clears both credential inputs after success or failure and renders only
  fixed status text.
- The service worker calls the exact configured Supabase password/signup and
  refresh endpoints, stores only normalized session data in trusted-context
  storage, serializes session mutations, and returns only bounded account
  state to Options.
- Sign-out preserves other owners' pending saves and requires an explicit
  decision before discarding the current owner's pending saves.
- `EXTENSION_REDIRECT_ORIGIN` is removed from application environment parsing.

## TDD evidence

RED:

```text
node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js
11 tests: 1 passed, 10 failed because password controls/client/commands were absent

node_modules/.bin/vitest run src/server/auth/web-auth-flow.test.ts tests/integration/extension/password-auth.test.ts
17 tests: 11 passed, 6 failed because Web remained OTP/callback based and extension auth still required Chrome Identity
```

Focused GREEN during implementation:

```text
node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js extension/tests/worker-restart.test.js
16 tests passed

node_modules/.bin/vitest run src/server/auth/web-auth-flow.test.ts tests/integration/extension/password-auth.test.ts src/server/env.test.ts
3 files passed; 29 tests passed

node_modules/.bin/tsc --noEmit
passed

node_modules/.bin/eslint src/app/sign-in src/app/auth/sign-in src/server/auth
passed
```

The final fresh verification and independent review are recorded by the
controller after this candidate commit.

## Risks and next dependency

Task 4 must generate and load `POPCORN_RUNTIME_CONFIG` with the exact local
Supabase URL and public anon key, and remove the now-unused manifest `identity`
permission. This task consumes that future public configuration but does not
create its template, generator, or manifest wiring. The controller also owns
removing the obsolete `EXTENSION_REDIRECT_ORIGIN` line from `.env.example`.

The password grant is intentionally the only reference mode. OAuth, MFA,
CAPTCHA, organization roles, rate-limit infrastructure, and a replacement
token broker were not added.
