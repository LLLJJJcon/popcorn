# Batch B Task 4 handoff — learner-first Use It Now

## Scope and task head

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 4.
- Baseline: `3778e47`.
- Worktree: `/private/tmp/popcorn-batch-b-4`; branch: `codex/popcorn-batch-b-4`.
- Task HEAD: the commit returned to the controller with this handoff (the commit cannot embed its own SHA).
- Changed only the Task 4 allowlist: practice feature/UI, two private prompts, activation domain, draft-attempt repository, three POST routes, the task page, two focused tests, and this handoff.

## RED / GREEN evidence

RED was observed before implementation in two stages:

- The first focused run failed both suites because the new practice modules did not exist.
- After compile-only stubs were added, the behavioral run executed 16 tests and failed all 16: activation/persistence, exact candidate ownership, malformed candidate, CI zero-egress, live pin/revocation, response validation, invalid output, provenance, failed-attempt retention, append-only revision, and learner-first UI were all demonstrably absent.
- Two subsequently added HTTP-boundary tests first failed because the route handler factories were absent.

GREEN candidate:

```text
./node_modules/.bin/vitest run \
  src/features/practice/practice-session.test.tsx \
  tests/integration/practice/attempts.test.ts
Test Files 2 passed; Tests 18 passed

./node_modules/.bin/tsc --noEmit --pretty false
exit 0

git diff --check
exit 0
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
  no-store envelopes, authenticated ownership, and generic non-secret failures.
- `PracticeSession` contains no model answer/example before first submission, preserves
  the learner's Chinese on recoverable failure, renders the three feedback dimensions,
  and resubmits revisions against the previous attempt identity.

## Gateway and provenance behavior

- CI chooses task-local deterministic activation/evaluation fixtures before active-pin
  lookup, Vault resolution, or fetch. Fixture draft and attempt provenance is all null.
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
- No database reset, full pgTAP, application-wide suite, production build, or browser
  test was repeated, as required by the focused Task 4 brief and the already-frozen
  533-test shared migration gate.
- This handoff is not self-approval; an independent read-only review is still required.
