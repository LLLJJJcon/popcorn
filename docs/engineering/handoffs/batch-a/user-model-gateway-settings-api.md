# User Model Gateway Task 2 Handoff

## Identity and scope

- Plan task: `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`, Task 2.
- Recorded baseline: `3d0e6842a4867fb59c07b9abcf6fa444dd794a16`.
- Controller brief commit: `e79ab133d5e778082a0106f94ec08b0fbd0e0d7d`.
- Implementation commit: `5b0d61288df4745a6e54d4ddbe9d9f63aa12fa89`.
- Worktree: `/private/tmp/popcorn-gateway-settings-api`.

Only the brief allowlist was changed. Shared contracts, migrations, generated
database types, root configuration, lockfiles, UI, extension, and Batch A Task 3
files were not modified.

## Delivered behavior

- Added a reusable `@supabase/ssr` server-client factory with `getAll`/`setAll`
  cookie semantics and fixed `Path=/`, `HttpOnly`, `SameSite=Lax`, and
  production `Secure` options.
- Added cookie-only verified Web session authentication through `auth.getUser`;
  bearer-only and unrelated-cookie requests are not accepted as sessions.
- Added owner-filtered, bounded, deterministic catalog/config reads.
- Added an RPC-only Vault lifecycle adapter. Settings reads use only the
  boolean credential-presence RPC and never invoke the credential resolver.
- Added framework-neutral settings service and HTTP handlers with exact-origin
  mutation checks before body parsing/storage, strict 8 KiB UTF-8 JSON bodies,
  frozen DTO discrimination, sanitized envelopes, request IDs, and `no-store`.
- Added production GET/PUT/DELETE settings routes and POST consent route backed
  by the service-role repository and frozen atomic RPCs.

## RED evidence

Initial focused run, before production files existed:

```text
vitest run src/server/auth/web-session.test.ts \
  tests/integration/model-gateway/settings-service.test.ts \
  tests/integration/model-gateway/settings-api.test.ts
Result: exit 1; 3 failed suites; imports for web-session/settings-service were
missing as expected.
```

An additional test-first session-classification regression produced:

```text
web-session.test.ts: 1 failed, 4 passed
Expected an unrelated browser cookie to map to "missing"; received "expired".
```

The minimal fix recognizes only Supabase session cookie names before calling
the SSR auth client.

## GREEN and verification evidence

```text
vitest focused three files: 3 passed files, 30 passed tests
vitest run src tests/contract tests/integration tests/provenance: 20 passed files,
337 passed tests
eslint src tests --max-warnings 0: exit 0
tsc --noEmit: exit 0
next build --webpack: exit 0; both settings routes emitted as dynamic routes
git diff --check: exit 0
```

The focused coverage includes missing/expired/bearer-only authentication,
same-origin-before-service enforcement, two-user isolation, explicit owner
filters, active/bounded catalog and bounded/newest config queries, strict and
ambiguous bodies, byte limits, pending creation, exact consent, rename,
write-only rotation, revoked/wrong-owner constraints, replay-safe revocation,
sanitized error/header/body leak scans, and boolean-only credential presence.

## Risks and follow-up

- This task uses explicit in-memory fakes for CI. It does not perform a live
  Supabase Auth or Vault operation; the frozen database contract and its pgTAP
  suite remain the source of truth for those atomic RPCs.
- Final manual verification still requires a configured Supabase deployment,
  an approved catalog entry, and a real authenticated browser session.
- Production gateway egress/proxy validation remains a later Delivery gate and
  is deliberately not exercised while saving settings.

No Provider request was made. No real credential was created, read, stored in a
fixture, or included in this handoff. No YouTube Digest code applied to this
task. LLM Wiki remains method-only; no GPLv3 code, tests, prompts, components,
styles, or assets were copied.
