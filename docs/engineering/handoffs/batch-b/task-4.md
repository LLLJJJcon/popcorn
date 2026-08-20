# Batch B Task 4 handoff — learner-first Use It Now

## Scope, review-fix baseline, and task head

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 4.
- Original implementation baseline: `3778e47`; independent-review fix baseline:
  `6ed81efe96bdbd0685729e5a08ef373016e74cd9`.
- Fix worktree: `/private/tmp/popcorn-batch-b-4-fix`; branch:
  `codex/popcorn-batch-b-4-fix`.
- Task HEAD: the commit returned to the controller with this handoff (the commit cannot embed its own SHA).
- Changed only the Task 4 allowlist: practice feature/UI, two private prompts, activation domain, draft-attempt repository, three POST routes, the task page, two focused tests, and this handoff.

## RED / GREEN evidence

Original implementation RED was observed before implementation in two stages:

- The first focused run failed both suites because the new practice modules did not exist.
- After compile-only stubs were added, the behavioral run executed 16 tests and failed all 16: activation/persistence, exact candidate ownership, malformed candidate, CI zero-egress, live pin/revocation, response validation, invalid output, provenance, failed-attempt retention, append-only revision, and learner-first UI were all demonstrably absent.
- Two subsequently added HTTP-boundary tests first failed because the route handler factories were absent.

The independent-review repair used additional focused RED evidence before changing
production behavior:

- An exact structured source-grounding response was rejected because the activation
  schema did not yet accept grounding echoes (`PROVIDER_FAILED` instead of a task).
- A wrong byte-level grounding echo and a schema-valid completed answer both incorrectly
  created drafts (two tests resolved instead of rejecting).
- Missing, `text/plain`, and `application/problem+json` Content-Type requests all
  incorrectly reached the action and returned 201 (three failures); the UTF-8 JSON
  control remained accepted.
- A second frozen candidate exposed that the CI activation fixture echoed a parallel
  fixed identity instead of the selected candidate (three mismatched fields).

Repository mapping/conflict, five-field provenance, and three real POST-route wiring
assertions were added to close review coverage gaps. They characterize already-intended
production behavior rather than claiming a new security framework.

GREEN candidate:

```text
./node_modules/.bin/vitest run \
  src/features/practice/practice-session.test.tsx \
  tests/integration/practice/attempts.test.ts
Test Files 2 passed; Tests 32 passed

./node_modules/.bin/tsc --noEmit --pretty false
exit 0

git diff --check
exit 0

fixed-env ./node_modules/.bin/next build --webpack
compiled, TypeScript, 21/21 static pages, and route collection succeeded; exit 0
```

## Produced interfaces and behavior

- `createPracticeTaskService.activate(userId, {savedItemId,candidateArtifactId,candidateIndex})`
  owner-filters the exact `saved_item_analysis` artifact, parses the frozen candidate
  list, uses only the indexed candidate, and persists a complete `practice_drafts` row
  before returning a frozen `PracticeTask` view.
- A deterministic draft UUID plus the database primary key makes concurrent selection
  replay fail closed to the already-persisted draft and retain one preallocated future
  expression identity.
- `createPracticeAttemptService.submitOriginal` validates original Chinese before
  Provider use. `submitRevision` resolves the exact owner/original/draft, derives the
  next positive revision, and appends without updating prior history. The database
  revision unique key converts concurrent collisions into `REVISION_CONFLICT`.
- Every schema-valid evaluation, including `passed=false`, is stored in
  `practice_draft_attempts`. Schema-invalid/network results create no attempt.
  Assistance is fixed to `none`; output that invents assistance or removes independent
  use is rejected.
- Both successful attempt paths return the frozen `AttemptRecorded` view with the
  draft's `future_user_expression_id`; it is not a canonical persistence event yet.
- Cookie-only Web POST routes enforce exact same origin, bounded strict JSON, standard
  no-store envelopes, authenticated ownership, and generic non-secret failures. Missing
  or non-JSON Content-Type is rejected with 400 before the task/evaluation action;
  `application/json` and its explicit UTF-8 charset form are accepted.
- `PracticeSession` contains no model answer/example before first submission, preserves
  the learner's Chinese on recoverable failure, renders the three feedback dimensions,
  and resubmits revisions against the previous attempt identity.

## Gateway and provenance behavior

- CI chooses task-local deterministic activation/evaluation fixtures before active-pin
  lookup, Vault resolution, or fetch. The activation fixture parses the same selected
  frozen candidate embedded in the private prompt and echoes that candidate's exact
  identity instead of carrying a parallel fixed expression. Fixture draft and attempt
  provenance is all null.
- Live activation output must echo `targetExpression`, `evidenceText`, and
  `communicativeFunction` byte-for-byte. The service rejects a mismatched echo, a prompt
  containing the complete target expression, or a prompt that is not a learner question
  ending in `?`/`？`, and persists zero drafts for those failures. This is deliberately a
  structured exact-echo plus learner-first rule, not a claim of general semantic
  detection.
- Live activation and every live evaluation resolve the current exact owner pin
  immediately before egress through `StructuredJsonGatewayResolver`. Revocation or pin
  mismatch prevents the next transport call.
- Live rows store the exact prompt version, resolved gateway model, config ID, revision,
  and fingerprint for that single egress. The consumer never receives an API key,
  origin, URL, header, Vault ID, or raw provider response.
- Provider/network/schema failures are normalized to a bounded public error; no prompt,
  learner text, secret, raw output, or exception message is logged or returned.

## No-premature-Vault proof

- The repository writes only `practice_drafts` and `practice_draft_attempts`, and reads
  only the exact artifact, those staged tables, and the active gateway pin RPC.
- It exposes no operation for `user_expressions`, canonical `practice_tasks`/`attempts`,
  `mastery_events`, or `review_tasks`; Task 4 therefore cannot create Vault, mastery,
  or due-Practice evidence.
- Focused tests cover zero attempt state after invalid Provider output, persisted failed
  learner history without mastery fields, and append-only revision preservation.
- Task 5 remains the sole owner of atomic promotion into canonical learning evidence.

## Upstream reuse and license record

- YouTube Digest, MIT, `zarazhangrui/youtube-digest` commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`: adapted only the method specified by the
  plan from `prompts/explain.md` and `prompts/note-cleanup.md`—source-bounded context,
  explicit JSON fields, and validation before persistence. The Popcorn prompts were
  written independently for Mandarin production with English feedback; no upstream
  prompt or implementation text was copied.
- LLM Wiki v0.6.9, GPLv3, `nashsu/llm_wiki` commit
  `723e259309aea5e3850265b631f80224f66dd9f6`: used only the abstract sequence Raw Source
  -> Structured Knowledge -> Learning Evidence. No GPLv3 code, prompt, test, component,
  asset, Markdown/wiki, vector, queue, or runtime implementation was copied.

## Remaining risks and next ownership

- Real Provider egress was intentionally not exercised; it remains a Delivery-only
  manual check with the user's configured gateway and API key.
- Task 3 must wire its confirmed candidate action to the activation POST payload.
- Task 5 must promote a valid staged attempt atomically using the preallocated future
  expression ID and must own all canonical Vault/mastery/review writes.
- No database reset, full pgTAP, application-wide suite, or browser test was repeated,
  as required by the focused Task 4 brief and the already-frozen 533-test shared
  migration gate. One fixed-environment production build was run because the new Route
  module tests were a concrete task-local build risk; it passed.
- This handoff is not self-approval; an independent read-only review is still required.
