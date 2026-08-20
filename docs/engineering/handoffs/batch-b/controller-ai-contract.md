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

## Independent review repair 1

- Repair baseline: `8b74df6`; reviewed contract candidate: `31a923c`.
- Repair brief:
  `docs/engineering/briefs/batch-b/controller-ai-contract-fix-1.md`.
- Worktree: `/private/tmp/popcorn-batch-b-ai-contract-fix-1`; branch:
  `codex/popcorn-batch-b-ai-contract-fix-1`.

The review identified two PostgreSQL provenance gaps. A populated practice or
attempt group missing only its fingerprint evaluated its `CHECK` expression to
`NULL`, which PostgreSQL accepts, while the default `MATCH SIMPLE` foreign key
skipped validation. Separately, the immutable provenance key and foreign keys
did not include `model`, so a row could name an invented model beside a real
owner/config/revision/fingerprint tuple.

Focused tests now prove that both `practice_tasks` and `attempts` reject a group
missing only fingerprint and reject a model that differs from the exact gateway
configuration revision. Two related queue regressions also prove that initial
analysis registration rejects a same-owner saved item attached to another
YouTube source, and that revoking the pinned gateway terminalizes pending
`analyze_saved_item` work while atomically clearing its private input.

Review-repair RED:

```text
supabase test db supabase/tests/batch_b_ai_contract.sql
Files=1, Tests=26, Failed=4, Result: FAIL
```

Only the four new provenance assertions failed: practice and attempt each
accepted a missing fingerprint and an invented model (`caught: no exception`).
The same-owner/different-source and revocation cleanup regressions passed against
the existing queue implementation, confirming those paths were preserved rather
than reimplemented.

The minimal unpublished migration-010 repair makes all five fields explicitly
non-null in each populated branch while retaining the unchanged all-null legacy
branch. It extends the existing immutable configuration unique key and both
practice/attempt foreign keys with `model`; there is no trigger, RPC, column, or
generated-type change.

Review-repair GREEN:

```text
supabase test db supabase/tests/batch_b_ai_contract.sql
Files=1, Tests=26, Result: PASS
```

The local database already contained the earlier unpublished migration 010, so
the five modified constraints were transactionally replaced in place before the
focused GREEN run. No reset, full pgTAP, typecheck, or build was run, as required
by the risk-calibrated repair brief. The controller should exercise one clean
migration replay at the later shared-contract integration gate.

This repair changes only migration 010, its focused pgTAP file, and this handoff.
It stores no API key, Vault ID, origin, URL, header, prompt/request body, or other
transport secret. It uses no upstream code and copies no LLM Wiki GPLv3 material.
Independent re-review remains required; this repair does not self-approve.

## Independent review repair 2

- Repair baseline: `f48ac13`; contract repair ancestor: `446e145`.
- Repair brief:
  `docs/engineering/briefs/batch-b/controller-ai-contract-fix-2.md`.
- Worktree: `/private/tmp/popcorn-batch-b-ai-contract-fix-2`; branch:
  `codex/popcorn-batch-b-ai-contract-fix-2`.

The second re-review found one mechanical consistency blocker: migration 010's
repaired practice and attempt provenance foreign keys contain five columns, but
the committed generated TypeScript still described their earlier four-column
forms.

RED was captured by generating TypeScript directly from the repaired local
schema into a temporary file and diffing it against the committed contract. The
only semantic differences were:

- `attempt_evaluation_gateway_fk` needed
  `evaluation_model -> user_model_gateway_configs.model`;
- `practice_task_activation_gateway_fk` needed
  `activation_model -> user_model_gateway_configs.model`.

The generator also emitted one extra final blank line. The generated output was
copied mechanically to `src/types/database.generated.ts`; only that final blank
line was normalized. No hand-authored type, migration, SQL test, application,
root configuration, or lockfile change was made.

GREEN regenerated the same schema into a fresh temporary file, applied the same
documented final-blank-line normalization, and compared it with the committed
type:

```text
diff -u src/types/database.generated.ts <normalized generated file>
exit 0; no output

git diff --check
exit 0
```

Per the focused repair brief, no database reset, pgTAP, full suite, typecheck, or
build was run. This change has no runtime behavior, egress, API-key, RLS, queue,
prompt, UI, or license effect. The controller still owns the later clean
migration replay and full shared-contract integration gate. Independent
re-review remains required; this repair does not self-approve.

## Controller freeze gate

Independent final re-review passed after fix 2. The controller then ran the one
shared-contract integration gate required by the risk-calibrated verification policy:

```text
pnpm db:reset
PASS; cleanly applied migrations 001 through 010 and seed

pnpm db:test
Files=4, Tests=487, Result: PASS

supabase gen types typescript --local | normalized-final-newline | diff
exit 0; committed generated types exactly match the clean local schema

CI=true pnpm typecheck
exit 0

fixed-test-environment CI=true pnpm build
exit 0; 19/19 routes/pages generated

git diff --check
exit 0
```

This contract is frozen for Batch B Tasks 1 and 4. Those consumers should run
focused TDD and directly related regression tests; they must not repeat reset/full
pgTAP/build unless they introduce a concrete shared-contract, secret, queue, or
integration risk.
