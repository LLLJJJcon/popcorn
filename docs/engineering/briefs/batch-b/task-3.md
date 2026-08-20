# Batch B Task 3 brief — source-grounded candidate confirmation

## Assignment

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 3.
- Baseline: `f17044b`; integration worktree: `/private/tmp/popcorn-youtube-learning`.
- Isolated worktree: `/private/tmp/popcorn-batch-b-3`.
- Dependencies satisfied: Batch B Tasks 1 and 2 are independently accepted. Task 3
  consumes Task 1's durable analysis registrar and Task 2's Saved detail data. It calls
  the frozen Task 4 activation HTTP contract but does not duplicate Task 4 logic.

## Allowed files

- Create: `src/features/saved/candidate-expression.tsx`
- Create: `src/features/saved/candidate-list.tsx`
- Modify: `src/features/saved/api.ts` only to expose owner-filtered artifact identity
  needed by candidate presentation
- Modify: `src/app/(app)/saved/[videoSourceId]/page.tsx` only to render candidate UI
- Create: `src/server/domain/confirm-candidate.ts`
- Create: `src/server/repositories/expression-repository.ts`
- Create: `src/app/api/v1/saved-items/[savedItemId]/candidates/route.ts`
- Create: `src/features/saved/candidate-list.test.tsx`
- Create: `tests/integration/knowledge/source-traceability.test.ts`
- Modify: `tests/integration/saved/video-library.test.ts` only if the extended artifact
  DTO needs a directly related Task 2 regression update
- Create: `docs/engineering/handoffs/batch-b/task-3.md`

All other paths are forbidden, especially Task 1 jobs/handlers, Task 4 practice files,
shared contracts, migrations/generated types, gateway/runtime code, root config,
lockfile, ledger, and upstream/vendor files.

## Frozen inputs and produced interfaces

- Parse only `saved_item_analysis` content with `CandidateExpressionListSchema` (one to
  three). Preserve each candidate byte-for-byte and keep ambiguous candidates distinct.
- Extend `SavedArtifactView` minimally with exact `artifactId` and `savedItemId`; preserve
  existing Saved DTO/query behavior and owner/source validation.
- `GET /api/v1/saved-items/[savedItemId]/candidates` is read-only: cookie-authenticate,
  owner-filter exact YouTube saved item and latest immutable `saved_item_analysis`, and
  return either the bounded candidate artifact or a safe processing state.
- `POST` on the same route is an idempotent recovery trigger only when the artifact is
  absent. Require exact same origin and empty/strict bounded JSON. Resolve owner/source/
  saved item/snapshot/transcript hash through the repository, then call the already
  frozen `createSupabaseSavedItemAnalysisRegistrar` with
  `ANALYZE_SAVED_ITEM_PROMPT_VERSION`. It registers a durable job and never calls a
  Provider synchronously. No active gateway returns the standard gateway-required state
  while leaving the raw save untouched.
- Candidate selection sends exactly
  `{savedItemId,candidateArtifactId,candidateIndex}` to
  `POST /api/v1/practice/tasks`, consumes its schema-valid `PracticeTask`, and navigates
  to `/practice/[taskId]`. It sends no candidate body, user ID, source, model, scores,
  mastery state, due date, URL, or arbitrary input.

## Product behavior

- Every card displays exact Simplified Chinese expression, English meaning/explanation,
  tone, communicative function, register, exact source evidence, timestamp, and a
  canonical YouTube time link.
- Render at most three candidates in artifact order. Do not show numeric confidence;
  when confidence is below `0.7`, show `Needs your confirmation`.
- Semantically ambiguous candidates remain separate cards/actions. Do not silently merge
  or ask AI to decide duplicate identity.
- One `Use It Now` action per candidate. Selection itself only invokes Task 4 draft
  activation; Task 3 never writes `user_expressions`, canonical practice/attempts,
  mastery, or review rows.
- Candidate processing is progressive: raw Saved material remains visible. Missing
  artifact can register/replay a background job and shows a concise processing/retry or
  gateway-configuration state; it does not block/delete/replace the original save.
- Only YouTube source records are accepted. Add no text, generic URL, image, screenshot,
  file, or other input path.

## Required TDD evidence

RED must prove missing behavior before implementation for at least:

- three candidates render exact evidence/English metadata/timestamp/video link, with
  confidence hidden and low confidence confirmation copy;
- ambiguous candidates remain distinct and `Use It Now` posts only the three IDs;
- malformed/more-than-three/cross-owner/cross-save/cross-source artifact data fails
  closed without activation;
- GET is owner-filtered and read-only; POST invokes the real Task 1 registrar with exact
  owner/source/save/snapshot/hash/prompt version and performs zero Provider/fetch calls;
- absent/revoked gateway leaves raw save unchanged and returns a safe configuration state;
- replay returns the existing job; existing artifact causes zero registration;
- production Supabase repository filters every query by owner and exact save/source;
- selecting/registration paths expose no API key, Vault ID, origin, headers, private job
  input, raw provider output, mastery, or due-date authority;
- existing Saved grouping/timeline/progressive behavior remains green after DTO/page wiring.

## Verification

```bash
./node_modules/.bin/vitest run \
  src/features/saved/candidate-list.test.tsx \
  tests/integration/knowledge/source-traceability.test.ts \
  tests/integration/saved/video-library.test.ts \
  tests/integration/jobs/process-jobs.test.ts
./node_modules/.bin/tsc --noEmit --pretty false
git diff --check
```

This task changes no database/auth-secret/queue/shared contract. Do not run DB reset/full
pgTAP/full app/build/browser unless a concrete task-local risk appears.

## Upstream reuse and license

- YouTube Digest `zarazhangrui/youtube-digest` at pinned MIT commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`: reuse the already-adapted exact timestamp
  and stable transcript evidence produced by Task 1; do not create a parallel extractor.
- LLM Wiki v0.6.9 at GPLv3 commit
  `723e259309aea5e3850265b631f80224f66dd9f6`: adapt only the documented source
  traceability and async human-confirmation methods. Copy no GPLv3 code, tests, prompts,
  components, assets, Markdown/wiki, vector, queue, or runtime implementation.

## Handoff

Commit only allowed files. Report RED/GREEN, commit SHA, DTO/route/repository/UI contracts,
Task 1 registrar reuse, Task 4 activation boundary, upstream/license record, focused tests,
and remaining risks in `docs/engineering/handoffs/batch-b/task-3.md`. Do not self-approve;
the controller assigns a fresh read-only review Agent.
