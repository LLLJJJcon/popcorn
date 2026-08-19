# CONTRACT-009 Gateway Learning Artifact Pin Brief

## Task, baseline, and workspace

- Plan: `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`,
  Task 4 prerequisite for Batch A Task 3.
- Baseline: `1d65431`.
- Worktree: `/private/tmp/popcorn-youtube-learning`.
- Controller-owned contract task; feature Agents may not edit these files.

## Allowed files

- `supabase/migrations/202608160009_gateway_learning_artifact_pins.sql`
- `supabase/tests/model_gateway_jobs.sql`
- `src/types/database.generated.ts`
- `tests/contract/model-gateway-artifact-concurrency.sh` if a real two-session
  regression is needed
- `.github/workflows/ci.yml` only to run that exact regression
- this brief, its handoff, and `docs/engineering/execution-ledger.md`

Every other path is forbidden.

## Required interfaces

Add `private.learning_artifact_gateway_pins` with an exact job+owner foreign key,
config+owner foreign key, positive revision, lowercase SHA-256 fingerprint, and
service-role-only access. It must not store a key, Vault UUID, origin, base path,
model response, or public user data.

Add service-role-only RPCs:

1. `resolve_active_user_model_gateway_pin(p_user_id)` returns only config ID,
   revision, fingerprint, and model for the user's unique active, exactly
   consented, active-catalog config with an existing credential mapping. It must
   not join `vault.decrypted_secrets`.
2. `register_gateway_learning_artifact_job(...)` locks and revalidates the exact
   active config/origin/consent/credential, calls the frozen artifact registration
   atomically, inserts the strong pin for a new job, and requires exact pin match
   on replay. No unpinned or mismatched replay may succeed.
3. `complete_gateway_learning_artifact_job(...)` locks and validates the exact
   active config/origin/consent and strong pin before calling the frozen artifact
   completion in the same transaction. Its lock order is config, origin/pin,
   then job/internal through the frozen function so revocation cannot occur
   between validation and artifact publication.
4. Replace `revoke_user_model_gateway_config` without changing its signature.
   It must lock config first, mark it revoked, terminalize pinned pending,
   retryable-failed, or leased jobs with a fixed sanitized error, clear their
   lease/retry clock and private input, then delete the secret mapping and actual
   Vault row. Replay remains idempotent and also finishes cleanup for a corrupt
   already-revoked row. Succeeded artifacts remain immutable.

All exact owner/config/revision/fingerprint/source/job/lease/attempt/result-key
fences remain mandatory. Existing CONTRACT-007/008 RPCs stay available but Task
4 must consume the new gateway-aware registration/completion paths.

## Required RED/GREEN evidence

RED must show the pin table and three new RPCs are absent and old revoke leaves
pinned work possible. GREEN must prove:

- private table grants/RLS and service-only function privileges;
- active lookup excludes missing secret, wrong owner, pending/revoked config,
  disabled origin, stale consent, and never returns secret material;
- registration creates one exact pin, replay is idempotent only for the same
  pin, and stale/mismatched/revoked pins fail atomically without an orphan job;
- completion publishes only with the exact current pin and consent; revoke
  before completion yields no artifact and a lost fence;
- revoke terminalizes and clears pending/retryable/leased inputs, destroys the
  actual Vault row, preserves succeeded work, and is idempotent;
- consistent locking prevents revoke from interleaving between publish
  validation and publication;
- generated types exactly match the clean local database.

## Verification

```bash
./node_modules/.bin/supabase db reset --local
./node_modules/.bin/supabase test db supabase/tests/model_gateway_jobs.sql
./node_modules/.bin/supabase test db
./node_modules/.bin/supabase gen types typescript --local
./node_modules/.bin/vitest run src tests/contract tests/integration tests/provenance --passWithNoTests
./node_modules/.bin/eslint src tests --max-warnings 0
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build --webpack
git diff --check
```

## Upstream and license

No upstream implementation applies. YouTube Digest remains MIT and untouched by
this database task. LLM Wiki is GPLv3 method-only inspiration; copy no code,
tests, SQL, prompts, components, names, or assets.
