# Batch B controller contract — atomic practice promotion

## Assignment

- Shared dependency for Batch B Task 5.
- Baseline: `4b5d9f5`; integration worktree: `/private/tmp/popcorn-youtube-learning`.
- Controller-owned migration and generated types. Feature Agents may consume but not edit.

## Contract gap

Task 4 deliberately persists a valid evaluation as a durable draft attempt while Task 5
must create an expression sense, exact source occurrence, the preallocated user expression,
canonical practice/attempt evidence, `tried` mastery event, and initial due Practice in one
transaction. Existing tables have the needed constraints but no atomic/idempotent service
boundary. Split service-role inserts could expose partial Vault/mastery state after failure.

## Allowed files

- Create: `supabase/migrations/202608160012_promote_practice_attempt.sql`
- Create: `supabase/tests/promote_practice_attempt.sql`
- Create: `tests/contract/practice-promotion-concurrency.sh`
- Modify: `src/types/database.generated.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/provenance/no-llm-wiki-code.test.ts`
- Create: `docs/engineering/handoffs/batch-b/controller-practice-promotion-contract.md`

All other paths are forbidden, including application/domain code, existing migrations/tests,
contracts, root config/lockfile, Task 3/4 files, and ledger.

## RPC

Create service-role-only:

```text
promote_valid_practice_draft_attempt(
  p_user_id uuid,
  p_practice_draft_attempt_id uuid,
  p_normalized_expression_text text,
  p_due_at timestamptz,
  p_interval_days integer
)
```

Return all canonical IDs plus `created boolean`. A replay returns the original IDs with
`created=false`. Use a private immutable promotion receipt keyed by exact owner/draft attempt;
authenticated/anon receive no receipt access or RPC execute permission.

## Required semantics

- Lock and select exact owner draft attempt, draft, same owner/source/save/artifact candidate,
  saved-item snapshot, and candidate JSON. Only `revision=1` and `passed=true` qualify.
- Use the draft's exact globally preallocated `future_user_expression_id` for the canonical
  `user_expressions.id`. Canonical `practice_tasks.id` equals the draft ID and canonical
  `attempts.id` equals the staged draft-attempt ID, giving stable replay identities.
- Create one new expression sense rather than silently merging an ambiguous existing sense.
  Persist the server-supplied bounded normalized expression key for exact/trigram suggestion
  workflows; Task 5 application code owns normalization and user-confirmed future merge UX.
- Copy all expression metadata and exact occurrence evidence from the indexed immutable
  candidate artifact; bind occurrence to the exact source, saved item, snapshot, segment IDs,
  timestamp range, and confidence.
- Copy task content plus all-null-or-exact activation provenance and attempt evaluation plus
  all-null-or-exact evaluation provenance into canonical tables.
- Create `user_expressions(mastery_state='tried')`, one append-only mastery event with
  `prior_state=null`, `new_state='tried'`, `evidence_kind='valid_original_attempt'`, and one
  pending review task at `tried`.
- First-tried scheduling is deterministic: `p_interval_days` must be `1` and `p_due_at` must
  equal the staged attempt's `submitted_at + interval '1 day'`. This verifies the server's
  frozen `scheduleReview({kind:'first_tried'})` result without accepting client authority.
- Mark the draft `completed` only inside the same transaction. Keep the staged draft attempt
  immutable. Any late failure rolls back every new canonical/receipt/status write while the
  already-committed draft attempt remains available for retry.
- Concurrent/replayed calls create exactly one canonical graph and return the same IDs.
- Store no API key, Vault ID, gateway origin/URL/header, prompt body, request body, raw
  Provider output, log, arbitrary mastery target, or arbitrary due date.

## Required pgTAP RED/GREEN

RED first proves the RPC/receipt are absent. GREEN must prove at least:

- save, draft, invalid Provider output, `passed=false`, and revision 2 alone create no
  expression/Vault/mastery/review graph;
- one valid passed revision 1 creates the full graph with exact IDs, owner/source/evidence,
  copied activation/evaluation provenance, `tried`, and deterministic due date;
- replay and two-session concurrency return one graph/one receipt/same IDs;
- wrong owner, cross-source/save/artifact, malformed candidate, changed normalized input,
  wrong interval/due date, failed attempt, and revision 2 fail closed;
- a deliberately late canonical conflict rolls back sense/occurrence/user-expression/
  mastery/review/receipt/draft-status changes while preserving the staged attempt;
- authenticated/anon cannot execute the RPC or access the private receipt; owner RLS reads
  only its canonical rows; service role cannot bypass owner parameters through the RPC.

## Verification

```bash
pnpm db:reset
./node_modules/.bin/supabase test db supabase/tests/promote_practice_attempt.sql
tests/contract/practice-promotion-concurrency.sh
pnpm db:test
./node_modules/.bin/supabase gen types typescript --local
./node_modules/.bin/tsc --noEmit --pretty false
fixed-test-environment ./node_modules/.bin/next build --webpack
git diff --check
```

One clean reset/full pgTAP/type/build gate is justified because this is a shared atomic
database boundary. Task 5 must not repeat it unless it changes shared files.

## License

- No upstream implementation applies to this Popcorn transaction/RLS contract.
- Copy no YouTube Digest implementation.
- LLM Wiki is method-only; copy no GPLv3 code/tests/prompts/components/assets.

## Handoff

Record RED/GREEN, transaction/idempotency/rollback evidence, exact consumer inputs/outputs,
remaining risks, and the independent-review requirement. Commit only allowed files.
