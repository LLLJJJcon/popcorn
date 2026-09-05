# Revised Delivery Task 5F — Signed-in `/sign-in` state

## Outcome

`/sign-in` now obtains a verified, bounded account state through the existing
SSR authentication handler. Anonymous and expired sessions continue to render
the existing `SignInForm`. A verified session instead shows the account email
(or `Popcorn account` when absent), a continuation link to
`/settings/model-gateway`, and the existing `POST /auth/sign-out` form.

The handler exposes `getPageAccount()` as `{ authenticated: boolean, email?:
string }`; it does not return a user ID, provider error, token, or credential.
`getPageAuthorization()` remains available for existing protected routes and
derives its result from the new bounded state.

## TDD evidence

RED command:

```bash
pnpm vitest run src/app/sign-in/page.test.tsx src/server/auth/web-auth-flow.test.ts
```

RED result: 3 failures / 17 passing. The signed-in page tests failed because
the anonymous form was still rendered, and the auth-helper test failed because
`getPageAccount` did not exist.

GREEN command:

```bash
pnpm vitest run src/app/sign-in/page.test.tsx src/server/auth/web-auth-flow.test.ts
```

GREEN result: 2 test files passed; 20 tests passed.

## Final verification

```bash
pnpm vitest run src/app/sign-in/page.test.tsx src/app/sign-in/sign-in-form.test.tsx src/server/auth/web-auth-flow.test.ts
pnpm eslint src/app/sign-in/page.tsx src/app/sign-in/page.test.tsx src/server/auth/web-auth-flow.ts src/server/auth/web-auth-flow.test.ts
pnpm typecheck
git diff --check
```

All commands exited successfully. The Vitest command passed 3 test files and
21 tests. ESLint, TypeScript, and whitespace checks were clean.

## Scope and risks

Only Task 5F allowed files are included in the commit. Pre-existing unrelated
working-tree changes remain uncommitted: `next-env.d.ts`, `.DS_Store`,
`AGENTS.md`, `CLAUDE.md`, and `extension/.DS_Store`.

Residual risk: browser-level interaction was not run; the server-rendered
state, accessible controls, form method/action, and layout classes are covered
by the specified automated checks.
