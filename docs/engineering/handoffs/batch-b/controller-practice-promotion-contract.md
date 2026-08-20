# Batch B controller handoff — atomic practice promotion

## Scope and baseline

- Contract: `docs/engineering/briefs/batch-b/controller-practice-promotion-contract.md`
- Recorded baseline: `4b5d9f5`
- Implementation worktree: `/private/tmp/popcorn-youtube-learning`
- Consumer: Batch B Task 5 `record-valid-attempt`
- No YouTube Digest code applies. No LLM Wiki GPLv3 code, tests, prompts,
  components, or assets were copied.

## Delivered contract

- Migration `202608160012_promote_practice_attempt.sql` adds a service-role-only,
  `SECURITY DEFINER` RPC that atomically promotes one exact owner draft attempt.
- Only passed revision 1 is accepted. The supplied first-review schedule must be
  exactly one day after `submitted_at` with interval 1.
- The transaction creates one new sense, exact occurrence evidence, the draft's
  preallocated user-expression ID at `tried`, canonical task/attempt identities,
  one mastery event, one pending review task, and then completes the draft.
- A private immutable receipt makes exact retries return the same seven IDs with
  `created=false`. Changed deterministic inputs fail closed.
- The staged attempt survives every failure. A test-only final receipt trigger
  proves that even failure after all canonical writes and the draft update rolls
  the whole statement back.
- The row lock on the staged attempt serializes concurrent calls. A two-session
  contract proves the first call returns `created=true`, the blocked second call
  returns `created=false`, and exactly one graph/receipt remains.
- The receipt is inaccessible to anon, authenticated, and service-role callers
  outside the definer RPC. It stores no API key or gateway destination. Public
  rows copy only non-secret config IDs, revisions, models, and fingerprints.

## TDD evidence

RED:

- Before the migration, the focused pgTAP test failed 2/2 because the receipt and
  RPC did not exist.
- The first malformed-output regression caught SQL three-valued logic allowing a
  missing candidate field to reach a later `23502` constraint instead of the RPC's
  fail-closed `22023` boundary. The migration now uses `is distinct from` for all
  required JSON types; the regression remains.

GREEN and verification:

- Clean seeded migration reset: migrations 001–012 plus `supabase/seed.sql`, PASS.
- Focused promotion pgTAP: 37/37, PASS.
- Two-session promotion concurrency contract: PASS.
- Full database pgTAP: 6 files, 570/570, PASS.
- CI/provenance freeze test: 6/6, PASS.
- Generated TypeScript type output: exact after the repository's trailing-blank
  normalization.
- `tsc --noEmit --pretty false`: PASS.
- Fixed-environment Next production build: PASS, 21/21 pages.
- `git diff --check` and shell syntax: PASS.

The first full pgTAP attempt was intentionally not accepted because the preceding
reset used `--no-seed`; its 10 failures were all missing/exact-seed assertions.
The database was rebuilt with the project seed and the complete 570-test gate then
passed.

## Task 5 interface

Call:

```text
promote_valid_practice_draft_attempt(
  user_id,
  practice_draft_attempt_id,
  normalized_expression_text,
  submitted_at + 1 day,
  1
)
```

The server owns normalization and the frozen `scheduleReview(first_tried)` result.
The client must not submit mastery state or an arbitrary due date. Task 5 should
surface exact/trigram sense suggestions for confirmation but must not silently
merge the new sense.

## Remaining risk

- No live Provider call is part of this database contract; Task 5 remains
  fixture-backed and final Delivery owns live gateway verification.
- Application wiring must retry this RPC after a staged-attempt replay so a worker
  or request termination between staging and promotion can recover.
- Independent read-only review is still required before the contract is frozen.
