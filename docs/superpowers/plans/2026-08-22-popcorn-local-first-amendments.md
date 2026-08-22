# Popcorn Local-First Amendments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Popcorn application usable from a personal local installation with a user-entered model gateway, local authentication, a generated unpacked extension, and a recoverable local job trigger.

**Architecture:** Keep Supabase, the durable job queue, and server-only Provider execution. Amend the existing gateway contract so a user supplies one exact OpenAI-compatible HTTPS base URL; add an email/password reference auth path; generate exact local extension origins; and trigger the existing bounded internal processor from a small local process instead of requiring HTTPS Cron.

**Tech Stack:** Next.js 16, TypeScript, Supabase Auth/Postgres/Vault, Chrome Manifest V3, Node.js 20, Vitest, node:test, pgTAP.

**Spec:** `docs/superpowers/specs/2026-08-22-popcorn-local-first-school-demo-design.md`

## Global Constraints

- The reference topology is local Next.js + local Supabase + unpacked Chrome extension.
- Gateway display name, exact OpenAI-compatible HTTPS base URL, model, and API key are user configuration.
- No global OpenAI key/model remains required.
- Model and transcript credentials remain server-only; the public Supabase anon key is the only key allowed in generated extension configuration.
- Saving remains storage-first and performs no synchronous Provider call.
- Existing queue, lease, idempotency, owner/RLS, MIT provenance, and GPLv3 isolation contracts remain intact.
- Controller alone edits migrations, generated database types, root configuration, lockfile, ledger, and checkpoints.
- Do not add OAuth setup, Vercel, production egress infrastructure, local unauthenticated model support, or a new job system.

---

### Task 1: Amend the gateway contract for a user-entered base URL

**Ownership:** Controller implementation; independent read-only reviewer.

**Files:**

- Create: `supabase/migrations/202608220015_user_configured_gateway_url.sql`
- Modify: `src/contracts/model-gateway.ts`
- Modify: `src/types/database.generated.ts`
- Modify: `src/server/model-gateway/settings-service.ts`
- Modify: `src/server/model-gateway/vault-secret-store.ts`
- Modify: `src/server/model-gateway/runtime-resolver.ts`
- Modify: `src/server/repositories/model-gateway-settings-repository.ts`
- Modify: `src/app/settings/model-gateway/model-gateway-settings.tsx`
- Test: `supabase/tests/model_gateway.sql`
- Test: `supabase/tests/model_gateway_jobs.sql`
- Test: `tests/contract/model-gateway.test.ts`
- Test: `tests/integration/model-gateway/runtime-resolver.test.ts`
- Test: `tests/integration/model-gateway/settings-service.test.ts`
- Test: `src/app/settings/model-gateway/model-gateway-settings.test.tsx`
- Document: `docs/engineering/briefs/local-first/task-1.md`
- Document: `docs/engineering/handoffs/local-first/task-1.md`

**Interfaces:**

- Consumes: frozen gateway pins `{ configId, revision, fingerprint }`, Vault secret lifecycle, and `openai-compatible` transport.
- Produces: `ModelGatewayBaseUrlSchema`; create input `{ displayName, baseUrl, model, apiKey }`; immutable persisted `canonical_origin` plus `base_path`; the existing runtime resolver result `{ canonicalOrigin, basePath, model, apiKey, revision, configFingerprint }`.
- Public settings DTO: `ModelGatewayConfigViewSchema` exposes
  `{ id, displayName, baseUrl, model, revision, configFingerprint, state,
  consent, hasApiKey, createdAt, updatedAt }`; `consent` is null or
  `{ exactBaseUrl, policyVersion, consentedAt }`; `ModelGatewaySettingsViewSchema`
  exposes only `{ configs }`. It contains no origin catalog row, adapter URL
  fragments, Vault ID, or key.
- Consent input: `{ configId, exactBaseUrl, policyVersion:
  "model-egress-v1", confirmed: true }`. New and legacy configurations both
  normalize to the same exact `baseUrl = canonicalOrigin + basePath` DTO.
- Migration compatibility: existing catalog-backed configurations continue resolving; new configurations do not require a row in `model_gateway_origins`.

- [ ] **Step 1: Write the contract RED tests**

Add exact cases equivalent to:

```ts
expect(ModelGatewayCreateInputSchema.parse({
  displayName: "My DeepSeek gateway",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  apiKey: "secret",
})).toMatchObject({ baseUrl: "https://api.deepseek.com/v1" });

for (const baseUrl of [
  "http://api.example.com/v1",
  "https://user:pass@api.example.com/v1",
  "https://api.example.com/v1?token=x",
  "https://127.0.0.1/v1",
]) expect(() => ModelGatewayBaseUrlSchema.parse(baseUrl)).toThrow();
```

The settings UI test must assert an editable `Gateway base URL` field, display
the same exact `baseUrl` in the consent panel, and have no `Approved gateway`
select or empty-catalog blocker. The RPC test must prove two
owners can independently configure the same URL, one owner's key/config cannot
be read by the other, and the API key is absent from public tables and RPC
results.

- [ ] **Step 2: Run focused tests and capture RED**

```bash
pnpm vitest run tests/contract/model-gateway.test.ts tests/integration/model-gateway/runtime-resolver.test.ts tests/integration/model-gateway/settings-service.test.ts src/app/settings/model-gateway/model-gateway-settings.test.tsx
```

Expected: failure because `baseUrl` is not accepted and the UI still requires
`originId` from the administrator catalog.

- [ ] **Step 3: Add the append-only migration and regenerate types**

The migration must add immutable per-configuration transport fields for new
rows, keep legacy `origin_id` resolution, validate the same public exact HTTPS
origin and bounded path rules as the TypeScript schema, include those fields in
the existing fingerprint, and update service-only create/resolve/activate RPCs.
It must not expose the Vault UUID or decrypted key. Run:

```bash
pnpm db:reset
pnpm db:test
pnpm exec supabase gen types typescript --local --schema public,private > /tmp/popcorn-database.generated.ts
diff -u src/types/database.generated.ts /tmp/popcorn-database.generated.ts
```

Copy the generated result only after inspecting the diff; do not hand-edit a
generated signature.

- [ ] **Step 4: Implement the minimum Web and runtime changes**

Replace catalog selection in the create path with `baseUrl`. Replace the public
`origin` object and `origins` collection with the DTO frozen above; repository
queries must left-normalize legacy catalog rows and direct new transport fields
without an inner join that drops either representation. Preserve write-only key
clearing, exact-base-URL consent, one-active-config rule,
revision/fingerprint pinning, revoke/key-rotation behavior, fixture-first CI
resolver, and generic public errors. Do not add Provider presets or protocol
adapters.

- [ ] **Step 5: Run GREEN and contract-specific verification**

```bash
pnpm vitest run tests/contract/model-gateway.test.ts tests/integration/model-gateway/runtime-resolver.test.ts tests/integration/model-gateway/settings-service.test.ts src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm db:test
pnpm typecheck
pnpm exec eslint src/contracts/model-gateway.ts src/server/model-gateway src/server/repositories/model-gateway-settings-repository.ts src/app/settings/model-gateway
git diff --check
```

Expected: all exit 0. Repeat the existing two-session gateway concurrency
script once because this task changes gateway creation and fingerprinting; do
not repeat unrelated practice concurrency scripts.

- [ ] **Step 6: Review, hand off, and commit**

The independent reviewer must inspect baseline-to-HEAD migration and generated
types, legacy resolution, exact user URL behavior, key nonleakage, owner scope,
gateway pin compatibility, and GPL isolation. Commit only after PASS:

```bash
git add supabase/migrations/202608220015_user_configured_gateway_url.sql supabase/tests/model_gateway.sql supabase/tests/model_gateway_jobs.sql src/contracts/model-gateway.ts src/types/database.generated.ts src/server/model-gateway src/server/repositories/model-gateway-settings-repository.ts src/app/settings/model-gateway tests/contract/model-gateway.test.ts tests/integration/model-gateway docs/engineering/briefs/local-first/task-1.md docs/engineering/handoffs/local-first/task-1.md
git commit -m "feat: let users configure the model gateway URL"
```

### Task 2: Retire global OpenAI configuration and add a local job trigger

**Files:**

- Modify: `src/server/env.ts`
- Modify: `src/server/env.test.ts`
- Modify: `.env.example`
- Modify: `supabase/config.toml`
- Create: `scripts/process-local-jobs.mjs`
- Modify: `package.json`
- Test: `tests/integration/jobs/local-worker.test.ts`
- Document: `docs/engineering/briefs/local-first/task-2.md`
- Document: `docs/engineering/handoffs/local-first/task-2.md`

**Interfaces:**

- Consumes: `POST /api/internal/jobs/process`, `APP_URL`, and `INTERNAL_JOB_SECRET`.
- Produces: `pnpm worker:local`, which repeatedly makes one authenticated bounded process request and survives empty queues/transient request failures until SIGINT/SIGTERM.

- [ ] **Step 1: Write RED tests**

Assert `parseServerEnv` succeeds without `OPENAI_API_KEY` or `OPENAI_MODEL`,
still requires Supadata/service-role/job secrets for routes that consume them,
and rejects unknown fields. In the worker test, inject `fetch`, run one cycle,
and assert the exact request:

```ts
expect(fetch).toHaveBeenCalledWith(
  "http://127.0.0.1:3000/api/internal/jobs/process",
  expect.objectContaining({
    method: "POST",
    headers: { Authorization: "Bearer local-secret", "Content-Type": "application/json" },
  }),
);
```

- [ ] **Step 2: Capture RED**

```bash
pnpm vitest run src/server/env.test.ts tests/integration/jobs/local-worker.test.ts
```

Expected: environment parsing still requires the two retired OpenAI fields and
the local worker module/script is absent.

- [ ] **Step 3: Implement the minimal trigger**

`process-local-jobs.mjs` must export a testable one-cycle function, accept only
an `http:` or `https:` `APP_URL`, attach the bearer secret in a header, never
print a response body or secret, wait a fixed short interval after an empty or
failed cycle, and stop cleanly on SIGINT/SIGTERM. It must call the existing
route; it must not claim jobs or access Supabase directly.

Remove the retired OpenAI variables from `ServerEnvSchema`, `getServerEnv`, and
`.env.example`. Remove Supabase Studio's optional
`openai_api_key = "env(OPENAI_API_KEY)"` line from `supabase/config.toml`; Popcorn
does not use Studio AI. Do not remove `SUPADATA_API_KEY`.

- [ ] **Step 4: Run GREEN and commit after review**

```bash
pnpm vitest run src/server/env.test.ts tests/integration/jobs/local-worker.test.ts tests/integration/jobs/process-jobs.test.ts
pnpm typecheck
node --check scripts/process-local-jobs.mjs
git diff --check
git add .env.example supabase/config.toml package.json src/server/env.ts src/server/env.test.ts scripts/process-local-jobs.mjs tests/integration/jobs/local-worker.test.ts docs/engineering/briefs/local-first/task-2.md docs/engineering/handoffs/local-first/task-2.md
git commit -m "feat: add the local durable-job trigger"
```

Reviewer PASS requires proof that secrets are never printed, a failed cycle is
recoverable, no second queue implementation exists, and all routes now consume
only the environment fields they actually need.

### Task 3: Add the local email/password account path

**Files:**

- Modify: `src/app/sign-in/sign-in-form.tsx`
- Modify: `src/app/auth/sign-in/route.ts`
- Delete: `src/app/auth/callback/route.ts`
- Delete: `src/app/auth/extension/page.tsx`
- Delete: `src/app/api/v1/extension/session/exchange/route.ts`
- Delete: `src/app/api/v1/extension/session/refresh/route.ts`
- Modify: `src/server/auth/web-auth-flow.ts`
- Modify: `src/server/auth/web-auth-flow.test.ts`
- Delete: `src/server/auth/extension-session.ts`
- Modify: `src/server/env.ts`
- Modify: `src/server/env.test.ts`
- Modify: `.env.example`
- Modify: `extension/options.html`
- Modify: `extension/options.js`
- Modify: `extension/auth.js`
- Modify: `extension/background.js`
- Test: `extension/tests/auth.test.js`
- Test: `extension/tests/auth-worker.test.js`
- Delete: `tests/integration/extension/auth-exchange.test.ts`
- Create: `tests/integration/extension/password-auth.test.ts`
- Document: `docs/engineering/briefs/local-first/task-3.md`
- Document: `docs/engineering/handoffs/local-first/task-3.md`

**Interfaces:**

- Consumes: exact configured Supabase URL, public anon key, Supabase password
  token/refresh endpoints, trusted extension storage, existing bearer API calls.
- Produces: Web account creation/sign-in and extension options sign-in using the
  same email/password account; only access/refresh session data is stored.
- Retires: Google OAuth/Chrome Identity callbacks and
  `EXTENSION_REDIRECT_ORIGIN`; OAuth is not part of the reference product.

**Upstream reuse:** Continue adapting YouTube Digest `options.html`,
`options.js:createStorageAdapter`, and the existing Popcorn background router
from pinned commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7` under MIT. No
LLM Wiki material applies.

- [ ] **Step 1: Write RED authentication tests**

Cover successful sign-up/sign-in, wrong credentials, refresh, sign-out, worker
restart, and another account's pending events. Assert the password is cleared
from the form, never passed to `chrome.storage.*`, never returned to the Side
Panel/content script, and never logged. Assert saving still has no auth form.

- [ ] **Step 2: Capture RED**

```bash
node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js
pnpm vitest run src/server/auth/web-auth-flow.test.ts tests/integration/extension/password-auth.test.ts
```

Expected: the extension exposes only the current Google/PKCE begin command and
the Web form supports OTP only.

- [ ] **Step 3: Implement the minimum reference auth mode**

Use Supabase password sign-up/sign-in on the dedicated Web and extension
account surfaces. Keep tokens service-worker-owned, trusted-context storage,
serialized refresh/sign-out mutations, exact owner-bound pending events, and
generic failures. Do not add social OAuth configuration or store the password.
Delete the Google/PKCE extension callback routes and helpers, remove
`EXTENSION_REDIRECT_ORIGIN` from the runtime environment, and remove the unused
Chrome `identity` permission in Task 4.

- [ ] **Step 4: Run GREEN and commit after review**

```bash
node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js extension/tests/worker-restart.test.js
pnpm vitest run src/server/auth/web-auth-flow.test.ts tests/integration/extension/password-auth.test.ts src/server/env.test.ts
pnpm typecheck
pnpm exec eslint src/app/sign-in src/app/auth/sign-in src/server/auth
git diff --check
git add -A .env.example src/app/sign-in src/app/auth src/app/api/v1/extension/session src/server/auth src/server/env.ts src/server/env.test.ts extension/options.html extension/options.js extension/auth.js extension/background.js extension/tests/auth.test.js extension/tests/auth-worker.test.js tests/integration/extension docs/engineering/briefs/local-first/task-3.md docs/engineering/handoffs/local-first/task-3.md
git commit -m "feat: support local Popcorn account sign-in"
```

Reviewer PASS requires password nonpersistence, token isolation, no regression
to queue ownership/recovery, and no save-time form or navigation.

### Task 4: Generate an exact local unpacked extension

**Files:**

- Create: `extension/runtime-config.template.js`
- Create: `scripts/build-local-extension.mjs`
- Modify: `extension/manifest.json`
- Modify: `extension/background.js`
- Modify: `package.json`
- Test: `tests/release/local-extension-config.test.ts`
- Test: `extension/tests/auth.test.js`
- Document: `docs/engineering/briefs/local-first/task-4.md`
- Document: `docs/engineering/handoffs/local-first/task-4.md`

**Interfaces:**

- Consumes: `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the fixed public manifest key.
- Produces: `pnpm extension:local` and `dist/popcorn-extension/`, with exact
  App/Supabase host permissions and runtime configuration.

**Upstream reuse:** Adapt the pinned YouTube Digest manifest/package allowlist
shape. Preserve `third_party/youtube-digest/LICENSE` and
`extension/UPSTREAM.md`; do not copy upstream secrets or retired Provider
configuration.

- [ ] **Step 1: Write the package RED test**

Generate using `APP_URL=http://127.0.0.1:3000` and
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`. Assert the output manifest
has only YouTube plus those two exact hosts, retains the stable key and ID, and
the runtime file contains the public anon key but none of
`SUPABASE_SERVICE_ROLE_KEY`, `SUPADATA_API_KEY`, `INTERNAL_JOB_SECRET`, model
gateway keys, account passwords, or session tokens.

- [ ] **Step 2: Capture RED**

```bash
pnpm vitest run tests/release/local-extension-config.test.ts
```

Expected: no generator/template exists and the source worker still hardcodes
`https://app.popcorn.local`.

- [ ] **Step 3: Implement deterministic generation**

Copy only the explicit extension runtime allowlist into
`dist/popcorn-extension`, generate the runtime config and manifest from parsed
origins, reject credentials/query/fragments and non-loopback plain HTTP, and
leave `extension/` free of user values. Never modify the manifest `key`. Remove
the retired `identity` permission; retain only permissions used by the
password-authenticated runtime.

- [ ] **Step 4: Run GREEN and the local-first amendment gate**

```bash
pnpm vitest run tests/release/local-extension-config.test.ts
node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
pnpm test:provenance
pnpm typecheck
pnpm build
git diff --check
```

Expected: all exit 0. Do not run full pgTAP because Task 1 already owns the one
database gate and Tasks 2-4 do not change migrations.

- [ ] **Step 5: Review, commit, and checkpoint**

```bash
git add extension/runtime-config.template.js extension/manifest.json extension/background.js scripts/build-local-extension.mjs package.json tests/release/local-extension-config.test.ts docs/engineering/briefs/local-first/task-4.md docs/engineering/handoffs/local-first/task-4.md docs/engineering/checkpoints/local-first-amendments.md
git commit -m "build: generate the local Popcorn extension"
```

Reviewer PASS requires exact origins, stable identity, secret absence, MIT
attribution, queue recovery, and a loadable unpacked output.

## Exit Gate

- A user can enter gateway name, HTTPS base URL, model, and API key without an
  administrator catalog row.
- The worker resolves only the active owner's pinned configuration.
- Global OpenAI environment variables are absent.
- Local Web and extension accounts use the same email/password identity.
- `pnpm worker:local` triggers the existing durable processor over local HTTP.
- `pnpm extension:local` generates a stable-ID, exact-origin unpacked extension
  with no private credential.
- Task 1 database/gateway gate and Tasks 2-4 focused gates are independently
  reviewed and recorded in the execution ledger.
