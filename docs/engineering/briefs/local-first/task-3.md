# Local-First Task 3 — Email/password account path

- Plan/task: `2026-08-22-popcorn-local-first-amendments.md`, Task 3.
- Baseline commit: `76d82c3`.
- Worktree: `/private/tmp/popcorn-local-password-auth`.
- Ownership: the Web sign-in form/handler, retired callback and extension-token
  broker files, server auth environment, extension Options/auth/background
  slice, focused tests, and this task's brief/handoff.
- Controller-owned: root `.env.example`, ledger, checkpoints, integration, and
  the Task 4 manifest/runtime-config generator.
- Forbidden: migrations, generated types, package/lockfile, gateway, queues,
  Saved/Practice/Progress, extension manifest, and unrelated tests.

The task consumes the exact configured Supabase URL, public anon key, password
signup/token/refresh endpoints, the existing trusted-context storage, and the
existing bearer API calls. It produces Web and extension email/password
account creation/sign-in with a shared Supabase identity. Only normalized
access/refresh tokens, expiry, user ID, and email may be stored by the extension
worker. Passwords exist only in the dedicated form, trusted Options message,
and Supabase request body; Options clears both credential inputs after every
attempt.

The original plan omitted `tests/integration/extension/auth-refresh.test.ts`,
whose only production dependency was the token broker this task explicitly
deletes. The controller expanded the allowlist to delete that obsolete test and
replace both broker tests with `password-auth.test.ts`. The controller also
allowed the directly coupled magic-link sentence in `src/app/sign-in/page.tsx`
to be replaced with truthful password-account copy.

Expected RED: Web still called `signInWithOtp` and exposed a callback; the
extension still required Chrome Identity/PKCE and had no password controls or
password message commands. GREEN is the focused Web/extension/environment
suite plus TypeScript, scoped ESLint, and diff checks.

This work continues the existing MIT adaptation of YouTube Digest commit
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`: the established
`options.html`, `options.js:createStorageAdapter`, and classic background
message-router shape remain in place. No LLM Wiki v0.6.9 / commit
`723e259309aea5e3850265b631f80224f66dd9f6` GPLv3 code, tests, prompts,
components, or assets were used. New code remains MIT-intended.
