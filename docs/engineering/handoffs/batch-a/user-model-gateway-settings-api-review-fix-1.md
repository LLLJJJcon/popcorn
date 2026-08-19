# User Model Gateway Task 2 Review Fix 1 Handoff

## Identity and scope

- Plan task: `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`, Task 2.
- Rejected candidate: `2b9f651655f23ec156cb17e3d3bbf03a0a3f6089`.
- Fix baseline with frozen scoped environment contract: `51a47c6`.
- Fix brief commit: `24661e6`.
- Implementation commit: `f919f66`.
- Worktree: `/private/tmp/popcorn-gateway-settings-api`.

The fix changed only the seven production/test files allowed by the review-fix
brief, plus this handoff. It did not change environment contracts, migrations,
generated database types, shared DTOs, root configuration, lockfiles, UI,
extension, or artifact files.

## Delivered fixes

- Both production route modules now parse only the four frozen settings
  variables through `getModelGatewaySettingsEnv`. Missing scoped configuration
  continues to fail closed.
- `listConfigs(userId)` retains the explicit owner predicate, descending
  creation ordering, and limit 20, and now throws a sanitized repository error
  as soon as a returned record has another owner.
- `createNextCookieAdapter` is exported from `web-session.ts` as a reusable,
  Next-compatible adapter over a narrow injected cookie-store interface. Both
  settings routes consume it and no longer carry local adapter copies. Reads
  map only name/value and writes preserve the SSR cookie options, including
  `Secure`, `HttpOnly`, `SameSite`, path, and lifetime.

## RED evidence

Before the production fixes, the focused three-file run exited 1 with exactly
three new failures and 31 existing passes:

```text
web-session: TypeError: createNextCookieAdapter is not a function
repository: expected mixed-owner listConfigs promise to reject; received []
production route: ZodError for missing SUPADATA_API_KEY, OPENAI_API_KEY,
OPENAI_MODEL, EXTENSION_REDIRECT_ORIGIN, and INTERNAL_JOB_SECRET
Result: 3 failed files; 3 failed, 31 passed tests
```

These failures reproduce the three review blockers against the rejected Task 2
implementation; none was caused by a typo, fixture error, or unavailable
external service.

## GREEN and verification evidence

```text
vitest focused three files: 3 passed files; 34 passed tests
vitest run src tests/contract tests/integration tests/provenance: 20 passed files;
347 passed tests
eslint src tests --max-warnings 0: exit 0
tsc --noEmit: exit 0
next build --webpack: exit 0; both settings routes emitted as dynamic routes
git diff --check: exit 0
```

The production-route regression initializes both route modules with only the
four scoped settings variables while mocking only the external cookie and
Supabase runtime seams. It also proves a missing scoped dependency fails
closed. The repository regression supplies a mixed-owner service-role result
and checks both the explicit owner predicate and bounded query. The cookie
adapter regression checks exact reads and secure option-preserving writes.

## Risks and follow-up

- Route initialization is covered without real Supabase network traffic. Live
  cookie refresh and authenticated settings use remain final manual deployment
  checks.
- Production gateway egress/proxy validation remains a later Delivery gate and
  is intentionally outside this settings task.

No Provider request was made and no real credential was used. No YouTube Digest
implementation applies. No GPLv3 LLM Wiki code, tests, prompts, components,
styles, or assets were copied.
