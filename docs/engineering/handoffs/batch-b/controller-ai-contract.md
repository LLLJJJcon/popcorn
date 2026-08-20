# Batch B controller AI contract handoff

## Scope

- Plan dependency: Batch B Tasks 1 and 4.
- Controller baseline: `d973536`.
- Added migration `202608160010_batch_b_ai_contract.sql`, its focused pgTAP contract, and mechanically regenerated database types.
- No application handler, UI, prompt, provider adapter, root configuration, or lockfile changed.

## Contract produced

- `analyze_saved_item` now uses the existing durable learning-artifact registration, lease-fenced failure, and atomic completion RPCs.
- Registration verifies the exact saved item belongs to the job owner and YouTube source; idempotent replay preserves the first private input.
- Completion publishes `saved_item_analysis` against that exact saved item, succeeds the job, and clears private input atomically.
- The existing gateway wrapper remains the only model-backed registration/completion entry point, so the immutable user gateway revision pin and the pre-completion active-consent check apply unchanged.
- Practice activation and attempt evaluation accept nullable legacy provenance or a complete non-secret provenance group: prompt version, model, user gateway config, revision, and fingerprint. A composite foreign key rejects cross-owner or invented gateway revisions.
- No API key, Vault reference, gateway origin, request body, or headers are copied to public learning tables.

## TDD evidence

RED, before migration 010:

```text
./node_modules/.bin/supabase test db supabase/tests/batch_b_ai_contract.sql
Result: FAIL
12/12 initial assertions failed because the ten provenance columns were absent and
the learning-artifact RPCs rejected analyze_saved_item/saved_item_analysis.
After repairing an unrelated invalid subtitle fixture, execution stopped at the
expected analyze_saved_item registration rejection.
```

GREEN after the minimal migration:

```text
./node_modules/.bin/supabase test db supabase/tests/batch_b_ai_contract.sql
Files=1, Tests=20, Result: PASS

pnpm db:test
Files=4, Tests=480, Result: PASS

CI=true pnpm typecheck
exit 0

NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon \
SUPABASE_SERVICE_ROLE_KEY=test-service SUPADATA_API_KEY=test-supadata \
OPENAI_API_KEY=test-openai OPENAI_MODEL=test-model \
APP_URL=https://popcorn.example \
EXTENSION_REDIRECT_ORIGIN=https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org \
INTERNAL_JOB_SECRET=test-internal CI=true pnpm build
exit 0; 16/16 pages generated

git diff --check
exit 0
```

The first build attempt without required environment variables failed only during
prerender environment parsing; the documented fixed test environment passed. One
database reset and one full pgTAP pass were run because this task changes a shared
migration. Downstream Batch B consumers that do not alter database contracts should
use focused tests and do not need to repeat those broad database gates.

## Consumer guidance

- Task 1 must register analysis through `register_gateway_learning_artifact_job`,
  use the job owner/pin for runtime gateway resolution, and complete through
  `complete_gateway_learning_artifact_job`.
- Fixture mode must branch before any Vault/API-key resolution. Live worker mode may
  resolve and use the API key from the user's active config only immediately before
  an outbound request; never log, serialize, or return it.
- Task 4 must resolve the active owner gateway immediately before activation and
  evaluation outbound calls, then persist the returned non-secret revision fields
  in the new columns.
- Revocation continues to stop future outbound requests. The personal-use risk
  calibration does not require an additional post-response lock protocol for Task 4.

## Residual risks

- No real model gateway is contacted in CI. Live egress remains a Delivery-only
  manual check after local product acceptance.
- Nullable provenance is retained for legacy and deterministic fixture-created rows;
  model-backed Task 4 writes must always provide the complete group.
