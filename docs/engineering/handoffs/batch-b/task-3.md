# Batch B Task 3 handoff

## Scope

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 3.
- Task baseline: `b8a1cb56c3c365da6741a37eebf15386b82305b7`.
- Independent-review repair baseline:
  `948b59a63d9479874eddc983818587b577210791`.
- Repair worktree: `/private/tmp/popcorn-batch-b-3-fix`; branch:
  `codex/popcorn-batch-b-3-fix`.
- Only the Task 3 allowlist was changed. No migration, generated database type,
  shared contract, gateway transport/runtime, Task 1 processor, Task 4 practice
  implementation, root configuration, lockfile, or ledger was modified.

## TDD evidence

The first focused RED run exited 1. Both new suites failed import resolution because
`candidate-list`, `confirm-candidate`, and `expression-repository` did not exist; no test
was able to import. After the minimum UI/domain/repository/route implementation, 17/17
new tests passed.

Two narrower RED cycles then proved boundaries that the initial implementation did not
yet enforce:

- an artifact with `analyze-saved-item-v0` returned HTTP 200 instead of failing closed
  with 422;
- a Saved detail artifact that pointed outside the returned save set produced a detail
  DTO instead of `null`.

The minimum GREEN changes bound the artifact to the frozen
`analyze-saved-item-v1` prompt version and made Saved DTO validation require every
non-null artifact save identity to belong to the same returned source/save set.

Independent review then found three blocking gaps. The repair used two additional RED
cycles against production code:

- The production Saved page rendered the first analysis artifact for a save, so the page
  regression failed with the old expression visible and the old artifact ID wired to
  activation. A second page regression failed because a later wrong-version artifact
  still left a `Use It Now` action available. The Saved DTO now carries `promptVersion`,
  detail artifacts remain deterministically ordered by `createdAt` then ID, the production
  page selects the last artifact for the exact save, and `CandidateList` accepts only
  `ANALYZE_SAVED_ITEM_PROMPT_VERSION`. Raw Saved timeline content stays rendered even when
  the latest artifact is rejected.
- Missing/wrong media-type cases initially returned HTTP 200 and an undeclared chunked
  body over 256 bytes returned 400 only after consuming the whole stream without cancel.
  The body reader now requires `application/json` (optional parameters allowed), reads
  incrementally, cancels immediately when accumulated bytes exceed 256, and reaches
  neither repository nor registrar on validation failure.

Direct production-module tests now import/render the actual Saved page and import the
actual candidates route. They prove DTO-to-`CandidateList` wiring and latest artifact ID,
that the route exports only `GET`/`POST`, GET performs no RPC/write, and POST uses the real
`createSupabaseSavedItemAnalysisRegistrar` with a fake Supabase client to make the exact
active-pin and registration RPCs with zero Provider/fetch call.

Final fresh verification is recorded below. The controller should treat the branch HEAD
reported by the implementation Agent as the task commit; independent review remains
required before integration.

## Interfaces and behavior

- `createSupabaseExpressionRepository(client).read(userId, savedItemId)` resolves the
  exact owner/save first, then owner/source/YouTube, owner/source/snapshot, and latest
  owner/source/save/`saved_item_analysis` artifact. It performs SELECT queries only.
- `createCandidateService(repository, registrar, now)` validates the exact owner, source,
  save, snapshot, native YouTube identity, artifact type, prompt version, and strict one-
  to-three `CandidateExpressionListSchema` content before exposing candidates.
- GET `/api/v1/saved-items/[savedItemId]/candidates` cookie-authenticates, is read-only,
  returns a bounded ready artifact or safe processing state, and uses `no-store`.
- Same-origin POST accepts only a bounded strict `{}`. If a valid artifact already exists
  it performs zero registration. Otherwise it calls the real Task 1
  `createSupabaseSavedItemAnalysisRegistrar` with exact owner/source/save/snapshot/hash,
  `ANALYZE_SAVED_ITEM_PROMPT_VERSION`, and current time. A missing/revoked active gateway
  returns `gateway_required`; replay exposes the existing bounded job status. No Provider
  or fetch call occurs synchronously and the raw save repository is never mutated.
- The Saved DTO adds only `artifactId`, `savedItemId`, and `promptVersion`. The detail page
  retains the raw Saved timeline and progressively renders per-save candidate processing
  or candidate cards. For the same save it selects the deterministic latest immutable
  analysis artifact; an older artifact cannot be activated, and a latest artifact with a
  non-current prompt version fails closed rather than falling back to stale content. The
  production GET repository uses the matching descending `created_at`, then ID ordering.
- Cards preserve artifact order and exact Chinese/evidence text; display English meaning,
  explanation, tone, communicative function, register, timestamp, and canonical YouTube
  time link; hide numeric confidence; and show `Needs your confirmation` below 0.7.
  Ambiguous candidates remain separate.
- `Use It Now` sends exactly `{savedItemId,candidateArtifactId,candidateIndex}` to Task 4,
  parses a schema-valid `PracticeTask`, and navigates to `/practice/[taskId]`. It sends no
  candidate body, owner, source, model, score, mastery, due date, URL, or arbitrary input.

Tests cover malformed, over-three, wrong-owner/source/save/version artifacts; exact
production query filters; GET read-only behavior; absent/revoked gateway; idempotent job
replay; existing-artifact zero registration; strict same-origin recovery; response secret
exclusion; exact three-ID activation; ambiguity; confidence presentation; and Task 2 Saved
regressions. No API key, Vault ID, gateway origin/header, private job input, provider body,
mastery, or scheduling authority is returned by the candidate/recovery API.

## Upstream reuse and licensing

- YouTube Digest `zarazhangrui/youtube-digest` at pinned MIT commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`: this task reuses the already-adapted Task 1
  stable transcript evidence and exact timestamps. It does not add a parallel transcript
  extractor or normalization path.
- LLM Wiki v0.6.9 at GPLv3 commit
  `723e259309aea5e3850265b631f80224f66dd9f6`: only the Raw Source -> Structured Knowledge
  -> human-confirmed Learning Evidence method and asynchronous confirmation boundary were
  adapted. No GPLv3 code, tests, prompts, components, assets, Markdown/wiki, vector, queue,
  or runtime implementation was copied.

## Verification and residual risk

Final focused verification:

```text
4 focused test files: 57/57 passed (all original 48 retained)
TypeScript noEmit: exit 0
git diff --check: exit 0
fixed-environment Next production build: exit 0, 19/19 static pages generated
```

Per the personal-product verification calibration, no DB reset, full pgTAP, full suite,
or browser test was run because this task changes no database/shared contract. One
fixed-environment production build was run because the repair newly imports/renders the
production page and route and crosses a client/server bundle boundary.

Residual risk: CI uses only deterministic/fake gateway behavior, so a real configured
gateway and the Task 4 activation route remain Delivery/manual and downstream integration
surfaces. This task intentionally creates no Vault, canonical practice/attempt, mastery, or
review row; Task 4 owns draft activation and Task 5 owns canonical promotion.
