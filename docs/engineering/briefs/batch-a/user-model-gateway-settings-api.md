# User Model Gateway Task 2 Brief

## Task, baseline, and workspace

- Plan: `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`, Task 2.
- Frozen contracts: CONTRACT-008 through `04f17a5`, CONTRACT-008A at `ad5390e`.
- Baseline commit: `3d0e6842a4867fb59c07b9abcf6fa444dd794a16`.
- Branch: `codex/popcorn-gateway-settings-api`.
- Worktree: `/private/tmp/popcorn-gateway-settings-api`.
- Implement only this numbered task using strict RED then minimal GREEN. Commit the
  result and add the handoff at the path below.

## Allowed files

Create or edit only:

- `src/server/auth/web-session.ts`
- `src/server/model-gateway/settings-service.ts`
- `src/server/model-gateway/vault-secret-store.ts`
- `src/server/repositories/model-gateway-settings-repository.ts`
- `src/app/api/v1/settings/model-gateway/route.ts`
- `src/app/api/v1/settings/model-gateway/consent/route.ts`
- `src/server/auth/web-session.test.ts`
- `tests/integration/model-gateway/settings-service.test.ts`
- `tests/integration/model-gateway/settings-api.test.ts`
- this brief
- `docs/engineering/handoffs/batch-a/user-model-gateway-settings-api.md`

Every other path is forbidden, especially `src/contracts/**`, migrations,
generated database types, root config, lockfiles, extension files, Web UI, and
Batch A Task 3 artifact files. If a frozen contract is insufficient, stop and
report the exact missing interface rather than changing it.

## Consumed and produced interfaces

Consume the frozen Zod schemas in `src/contracts/model-gateway.ts`, the standard
API envelope/error taxonomy, generated `Database` types, `@supabase/ssr`,
`APP_URL`, Supabase anon key, and the service-role key.

Produce:

- cookie-authenticated `GET`, `PUT`, and `DELETE`
  `/api/v1/settings/model-gateway`;
- cookie-authenticated `POST`
  `/api/v1/settings/model-gateway/consent`;
- an injectable Web-session authenticator, owner-filtered repository,
  Vault-lifecycle RPC adapter, and framework-neutral service/handler boundary.

`PUT` must deterministically distinguish the three already-frozen strict DTOs:
create (`originId + displayName + model + apiKey`), rename
(`configId + displayName`), and rotate (`configId + apiKey`). Ambiguous, unknown,
or extra fields are validation failures; do not add an unfrozen `action` field.

## Authentication and HTTP security

- Use `createServerClient` from `@supabase/ssr` and `auth.getUser()` with the
  Next cookie adapter. Do not accept bearer-only authentication, extension
  tokens, query tokens, or caller-supplied user IDs.
- Missing cookie/session maps to `AUTH_REQUIRED`; an invalid or expired cookie
  maps to `SESSION_EXPIRED`.
- Before body parsing or any repository call, every mutating request must have
  an exact `Origin` equal to `new URL(APP_URL).origin`; missing, malformed,
  lookalike, alternate-port, path-derived, or cross-origin values fail closed.
- Every success and failure response has `Cache-Control: no-store`, a bounded
  public message, and a request ID. Never return/log raw Supabase errors or raw
  request bodies.
- Bound request bodies by bytes (maximum 8 KiB), decode UTF-8 strictly, and use
  only the frozen strict schemas. Reject `userId`, URL/basePath/adapter/headers,
  Vault IDs, nested extras, oversized bodies, and ambiguous PUT shapes.

## Owner, Vault, and lifecycle rules

- Even with service role, every config query includes `.eq("user_id", userId)`;
  config listing is newest-first and bounded to 20. Catalog listing returns
  only active origins and at most 50.
- Validate every returned config belongs to the authenticated owner. A wrong
  owner, missing row, false lifecycle RPC, or malformed DB result fails closed.
- Derive `hasApiKey` only through
  `has_user_model_gateway_secret(userId, configId)`. The settings read path must
  never call `resolve_user_model_gateway_config` or read private/Vault schemas.
- Create/rotate/revoke/activate delegate to the frozen atomic SQL RPCs. Never
  split a config lifecycle write from its Vault mutation. The production route
  always constructs the real RPC-backed adapter; tests inject an explicit
  in-memory fake. Do not select a fake from runtime environment flags.
- Create validates that the chosen catalog origin is active, generates config
  identity server-side, and returns a pending non-secret view. Consent must bind
  the exact catalog origin and `model-egress-v1`. Rename preserves semantic
  revision/consent. Rotation is write-only. Revoke is owner-bound and replay-safe.
- Saving, renaming, rotating, revoking, consenting, and listing perform zero
  Provider probes/fetches. No API key may appear in response bodies, headers,
  thrown messages, logs, snapshots, fixtures, handoff text, or browser storage.

## Required RED evidence

Start with failing tests and retain concise evidence for:

- missing/expired cookie and bearer-only rejection;
- exact same-origin enforcement before repository calls;
- two-user isolation and explicit owner filters under service role;
- active-only/bounded catalog plus newest-first/bounded configs;
- strict/ambiguous/unknown/oversized body rejection;
- create pending config with zero Provider calls;
- exact owner/origin/policy consent activation;
- rename, write-only rotation, owner/revoked constraints;
- active/pending/missing-secret revoke and idempotent replay;
- response/header/error leak scans for API key, Vault ID, service key, and raw
  persistence errors;
- boolean-only credential presence and proof the secret-bearing resolver is not
  invoked by GET.

## Verification commands

```bash
./node_modules/.bin/vitest run src/server/auth/web-session.test.ts
./node_modules/.bin/vitest run tests/integration/model-gateway/settings-service.test.ts
./node_modules/.bin/vitest run tests/integration/model-gateway/settings-api.test.ts
./node_modules/.bin/vitest run src tests/contract tests/integration tests/provenance --passWithNoTests
./node_modules/.bin/eslint src tests --max-warnings 0
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build --webpack
git diff --check
git status --short
```

## Upstream and license

No YouTube Digest function applies to this server settings task; do not copy or
reimplement its extension code. LLM Wiki is GPLv3 and method-only: the only
permitted reuse is the approved architectural method of server-side provider
isolation. Copy no GPLv3 code, tests, prompts, components, styles, or assets.

## Handoff

Commit all allowed changes and write
`docs/engineering/handoffs/batch-a/user-model-gateway-settings-api.md` with the
baseline, commit SHA, RED/GREEN evidence, exact commands/results, risks, scope
confirmation, upstream/license confirmation, and a statement that no real
Provider request or real credential was used.
