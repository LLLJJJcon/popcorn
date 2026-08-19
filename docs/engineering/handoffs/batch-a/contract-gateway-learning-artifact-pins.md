# CONTRACT-009 Gateway Learning Artifact Pin Handoff

## Scope and baseline

- Brief: `docs/engineering/briefs/batch-a/contract-gateway-learning-artifact-pins.md`
- Implementation baseline: `b3ba8e3`
- Product baseline recorded by the brief: `1d65431`
- Worktree: `/private/tmp/popcorn-youtube-learning`
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

GREEN:

```text
supabase/tests/model_gateway_jobs.sql .. ok
Files=1, Tests=40
Result: PASS

model gateway artifact lock invariant passed
```

## Verification evidence

- Clean `supabase db reset --local`: migrations 001 through 009 applied.
- Full pgTAP before final permission tightening: 447/447 passed; focused test
  after tightening: 40/40 passed. The controller must rerun full pgTAP at the
  candidate HEAD before review.
- Existing model gateway catalog concurrency: passed.
- New gateway artifact publication concurrency: passed in both transaction
  orderings.
- Vitest broad suite: 24 files, 398/398 passed.
- ESLint: passed with zero warnings.
- TypeScript: passed with `--noEmit`.
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
