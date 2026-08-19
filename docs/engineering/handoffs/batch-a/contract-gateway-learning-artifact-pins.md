# CONTRACT-009 Gateway Learning Artifact Pin Handoff

## Scope and baseline

- Brief: `docs/engineering/briefs/batch-a/contract-gateway-learning-artifact-pins.md`
- Implementation baseline: `b3ba8e3`
- Product baseline recorded by the brief: `1d65431`
- Independent review repair baseline: `92eee4293052829aa49dc0dd9161ccadb9589db2`
- Repair worktree: `/private/tmp/popcorn-contract-009-fix`
- Controller-owned files only; no upstream source was copied.

## Delivered contract

- Added the private, insert-once `learning_artifact_gateway_pins` table with
  exact job/owner and config/owner foreign keys.
- Added a non-secret active gateway pin resolver that never reads decrypted
  Vault material.
- Added atomic gateway-aware registration and completion RPCs with exact owner,
  config revision, semantic fingerprint, model, lease, attempt, source, and
  result-key fences.
- Replaced gateway revocation so pending, retryable, and leased pinned jobs are
  terminalized with `MODEL_GATEWAY_REVOKED`, private inputs are cleared, and the
  actual Vault secret is destroyed. Succeeded artifacts remain immutable and
  replay repairs stray credential mappings.
- Added a two-session regression for both lock orderings between completion and
  revocation and wired it into CI.
- Regenerated `src/types/database.generated.ts` from a clean local database.

## Independent review repair

- Replaced `activate_user_model_gateway_config` in migration 009 so replacing
  an active config now locks and revokes the old config before terminalizing
  all pending, retryable, and leased pinned jobs, clearing their private input,
  and deleting both the credential mapping and actual Vault secret.
- Explicit revoke and activation replacement now call the same private cleanup
  helper. The helper is executable by no runtime role and assumes its caller
  already holds the config lock, preserving the config-to-job lock order.
- Replacement leaves succeeded jobs and artifacts unchanged, and it also
  revokes a corrupt old active config whose secret mapping is already missing
  before activating the new target.
- Strengthened the concurrency regression with a job-row blocker, an identified
  completion backend confirmed waiting in `pg_stat_activity`, and a short
  `lock_timeout` config-update probe. The probe proves completion retains its
  config lock after gateway validation and before the old publication RPC can
  obtain its job lock. Both completion-first and revoke-first final outcomes
  remain covered.

## TDD evidence

RED 1, before migration:

```text
relation "private.learning_artifact_gateway_pins" does not exist
Failed test 1: gateway learning-artifact pins are stored in a private table
Failed test 2: gateway pins have RLS enabled
Result: FAIL
```

RED 2, permission hardening:

```text
Failed test 3: gateway pins are service-only and immutable after insertion
Looks like you failed 1 test of 40
Result: FAIL
```

Independent review repair RED, active-config replacement:

```text
Failed test 46: replacement terminalizes every recoverable old pin and clears private input
have: (leased,leased,...,{"request":"replacement-leased"})
want: (leased,terminal_failed,...,MODEL_GATEWAY_REVOKED,{})
Failed test 52: activation revokes a corrupt old active row without requiring its secret mapping
died: 23505 duplicate key value violates unique constraint user_model_gateway_one_active_idx
Failed test 53: corrupt old active config is revoked and the target becomes active
Result: FAIL (3/53)
```

Independent review repair RED, config-lock mutation:

```text
completion released its config lock before publication
Result: exit 1
```

This RED was produced after temporarily replacing the local database function
definition without `FOR SHARE OF config, origin`; no source migration was
changed for the mutation.

GREEN:

```text
supabase/tests/model_gateway_jobs.sql .. ok
Files=1, Tests=54
Result: PASS

model gateway artifact lock invariant passed
```

## Verification evidence

- Clean `supabase db reset --local`: migrations 001 through 009 applied.
- Repair candidate focused pgTAP: 54/54 passed.
- Repair candidate full pgTAP: 461/461 passed.
- Existing model gateway catalog concurrency: passed.
- New gateway artifact publication concurrency: passed in both transaction
  orderings.
- ESLint: passed from the dependency-bearing integration toolchain; it emitted
  only the expected dependencyless-worktree React detection notice.
- TypeScript: passed with `--noEmit` using a temporary external config that
  resolves dependencies from the integration worktree without creating a
  forbidden `node_modules` symlink.
- Broad Vitest could not be run faithfully inside the dependencyless repair
  worktree because Vite resolves packages relative to source importers. The
  direct binary run failed before tests on unresolved package imports; the
  controller must rerun application tests after integrating the SQL-only
  repair into the dependency-bearing worktree.
- Generated type snapshot: byte-identical to clean local output after removing
  the generator's extra final blank line.
- Next.js webpack production build: passed; 15 routes/pages generated.
- `git diff --check`: passed.

## Security and compatibility notes

- The pin stores no API key, Vault UUID, origin, base path, request payload, or
  model response.
- `service_role` can only select and insert pins; it cannot update or delete
  them. PostgreSQL/migration administration remains responsible for fixture
  teardown.
- Existing CONTRACT-007 RPCs remain available for their frozen compatibility
  surface. Batch A Task 3 must use only the gateway-aware registration and
  completion RPCs for model-backed learning artifacts.
- Key rotation does not change the semantic config fingerprint; changing
  adapter/origin/base path/model creates a new immutable config revision.

## Upstream and license

- YouTube Digest MIT code was not touched.
- LLM Wiki GPLv3 code, tests, prompts, components, assets, and naming were not
  copied. Only the already-approved general durable-queue method informed the
  contract design.
