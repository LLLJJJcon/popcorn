# Batch B Task 1: durable processor and saved-item analysis

## Assignment

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 1.
- Baseline: `1e0d254` (includes frozen CONTRACT-010/011).
- Worktree: `/private/tmp/popcorn-batch-b-1`; branch: `codex/popcorn-batch-b-1`.

## Allowed files

- `src/server/jobs/job-types.ts`
- `src/server/jobs/process-jobs.ts`
- `src/server/jobs/handlers/resolve-snapshot.ts`
- `src/server/jobs/handlers/generate-overview.ts`
- `src/server/jobs/handlers/analyze-saved-item.ts`
- `src/server/jobs/provider-cache.ts`
- `src/server/ai/prompts/analyze-saved-item.v1.ts`
- `src/app/api/internal/jobs/process/route.ts`
- `tests/integration/jobs/process-jobs.test.ts`
- `tests/integration/jobs/recovery.test.ts`
- `tests/integration/jobs/resolve-snapshot.test.ts` only if an existing snapshot
  behavior requires a directly related regression assertion
- `docs/engineering/handoffs/batch-b/task-1.md`

Every other path is forbidden. In particular, do not edit contracts, migrations,
generated types, root config/lockfile, `src/server/ai/{provider,model-gateway,
openai-compatible-provider,structured-json-gateway}.ts`, runtime resolver, Task 2/4
files, ledger, upstream notices, or provenance allowlists.

## Frozen inputs

- CONTRACT-010: `analyze_saved_item` gateway-aware registration/failure/completion,
  exact `saved_item_id`, `saved_item_analysis`, revoke cleanup, and generated types.
- CONTRACT-011: `StructuredJsonGatewayResolver`; supply a deterministic task-local CI
  fixture, resolve live by claimed job owner and immutable pin, never read/API-call on
  the save request path.
- Existing `CandidateExpressionListSchema`, `createJobResultKey`, lease/backoff rules,
  sole `claim_knowledge_jobs` discovery RPC, transcript normalization, and existing
  Overview/translation/explanation handlers.

## Interfaces to produce

- `processJobBatch({limit, now})`/the existing processor remains bounded and reports
  counts only. Internal endpoint authenticates exact `INTERNAL_JOB_SECRET` and leases
  at most five jobs.
- Existing snapshot/Overview/translation/explanation handlers keep working.
- `analyze_saved_item` reads the claimed owner, exact saved item/source/snapshot and
  bounded transcript evidence; returns one to three source-grounded candidates with
  exact Chinese evidence, stable segment IDs, timestamp range, English meaning/
  explanation, tone, function, register, and bounded confidence.
- Validate `CandidateExpressionListSchema` plus domain grounding: every segment is
  persisted owner evidence, `evidenceText` occurs in referenced Chinese context, and
  timestamps match referenced segments. Invented/reversed/cross-owner evidence fails.
- Complete only through `complete_gateway_learning_artifact_job`; retry/terminalize
  only through the frozen transition RPC. Raw saves remain untouched on every error.
- Deterministic result keys include source/transcript, saved-item snapshot, prompt
  version, and gateway fingerprint. Replays cannot double-publish or retarget.
- Provider cache, if used, is bounded to one processor call/exact owner+pin and stores
  no secret in DB/log/result. Revocation before a future outbound request still wins.

## TDD RED/GREEN

Write the two planned tests first. RED must demonstrate missing behavior, not only
missing modules, for:

- max-five bounded claim/count-only internal response and exact bearer rejection;
- expired lease recovery, no double apply, exact owner scope, retry backoff and raw
  save survival after terminal failure;
- one-to-three grounded candidates, malformed/invented evidence rejection, and
  deterministic replay;
- CI fixture zero runtime-resolver/Vault/fetch calls; live resolver receives claimed
  owner and job pin; key never enters logs/errors/input/artifact/body.

GREEN:

```bash
./node_modules/.bin/vitest run \
  tests/integration/jobs/process-jobs.test.ts \
  tests/integration/jobs/recovery.test.ts \
  tests/integration/jobs/resolve-snapshot.test.ts \
  tests/integration/model-gateway/structured-json-gateway.test.ts
./node_modules/.bin/tsc --noEmit --pretty false
git diff --check
```

Do not reset DB/run full pgTAP/full app/build. The shared DB/gateway gates already
passed; this task runs focused queue/handler regressions. Controller runs Batch B gate.

## Upstream reuse and license

- YouTube Digest: `zarazhangrui/youtube-digest` commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT.
- Retain the existing adaptation of `background.js:pollTranscriptJob` in
  `resolve-snapshot.ts`: completed/failed/queued/active and expiry-aware polling.
- Adapt timestamp validation ideas from `background.js:validateAndFixTimestamps` for
  generated candidate evidence; cite exact target functions in the handoff and
  `docs/engineering/UPSTREAM_EXECUTION_LOG.md` only via controller later (that ledger
  file is forbidden to this Agent).
- LLM Wiki v0.6.9 commit `723e259309aea5e3850265b631f80224f66dd9f6`
  is method-only: Raw Source -> Structured Knowledge -> Learning Evidence. Copy no
  GPLv3 code, tests, prompts, components, assets, Markdown/wiki/vector implementation.

## Handoff

Commit only this task. Return commit SHA, RED/GREEN evidence, exact upstream reuse,
test results, risks, and `docs/engineering/handoffs/batch-b/task-1.md`. Do not self-review.
