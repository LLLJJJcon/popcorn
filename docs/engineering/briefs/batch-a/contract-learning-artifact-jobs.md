# Controller Contract Gate — Durable learning-artifact jobs

## Identity

- Requested by: Batch A Task 3 dependency audit after Tasks 1, 2, and 4 passed.
- Baseline: `920bccd`.
- Worktree: `/private/tmp/popcorn-artifact-job-contract`.
- Consumes: migrations 001–006, frozen result-key/lease rules, and the sole
  `claim_knowledge_jobs` discovery RPC.

## Scope

Allowed only:

- create `supabase/migrations/202608160007_learning_artifact_jobs.sql`
- modify `supabase/tests/rls.sql`
- this brief and create
  `docs/engineering/handoffs/batch-a/contract-learning-artifact-jobs.md`

Forbidden: prior migrations, application/extension code, generated DB types,
root config, dependencies/lockfile, ledger/checkpoints, and all other files.
The controller regenerates types after review/integration.

## Required interfaces

All RPCs are original Popcorn SQL, `SECURITY DEFINER`, fixed
`search_path=pg_catalog`, execute revoked from `public`/`anon`/`authenticated`,
and granted only to `service_role`. Each takes explicit `p_user_id`; no global
scan is allowed. Only `claim_knowledge_jobs` may discover work globally.

### 1. Replay-safe registration

Create one atomic RPC that registers a source-level learning-artifact job plus
its private bounded input.

- Allowed job types only: `generate_overview`, `translate_segments`,
  `explain_selection`.
- Validate same-user video source, lowercase 64-hex dedupe key, finite clock,
  JSON object input, and encoded input size at most 65,536 bytes.
- Insert `knowledge_jobs` with `saved_item_id=null`, pending/attempt zero and the
  supplied clock; insert `knowledge_job_internal.input` in the same transaction.
- On `(user_id, job_type, dedupe_key)` conflict, return the existing job/status
  and `created=false` without changing its source, input, result, lifecycle, or
  timestamps. A dedupe key tied to another source/non-null save is rejected.
- Return exactly the Popcorn job UUID, status, and created flag; never return
  private input.

### 2. Lease-fenced failure transition

Create one atomic RPC for the same three AI job types.

- CAS on exact user, job, allowed type, `status='leased'`, lease expiry, and
  attempt count.
- Accept only frozen `retryable_failed` or `terminal_failed` transitions.
  Attempts 1–4 retry at exact 1/2/4/8-minute clocks; attempt 5 cannot retry.
  Attempts 1–5 may terminalize a non-retryable failure.
- Retry preserves private input/result byte-for-byte. Terminal clears private
  input in the same transaction and preserves any result.
- Lost/wrong owner/type/lease/attempt fence returns false with no public/private
  mutation. Invalid status/clock/error/clear combination fails before mutation.

### 3. Atomic artifact completion

Create one atomic completion RPC for the same job types.

- CAS/lock the exact owner/job/type/lease/attempt before mutation.
- Enforce the job→artifact mapping:
  `generate_overview→overview`,
  `translate_segments→segment_translation`,
  `explain_selection→selection_explanation`.
- Accept one bounded JSON object content (maximum 262,144 encoded bytes),
  prompt version/model each 1–100 trimmed characters, a lowercase 64-hex result
  key equal to the job dedupe key, and a finite completion clock before lease
  expiry.
- In one transaction insert the owner/source artifact idempotently, set learner
  language context exactly `native_language='en'` and
  `target_language='zh-CN'`, set the job succeeded, write strict private result
  `{ "artifactId": <uuid> }`, and clear private input. These language columns
  describe the English-native learner and Mandarin target; artifact content
  itself remains grounded Chinese evidence with English explanations.
- Same result replay preserves the first artifact rather than overwriting it.
  Lost fence or wrong mapping/owner/source leaves artifact/job/internal rows
  unchanged. Return the artifact UUID on success and null on a lost fence; do
  not return content/private input from the RPC.

Do not add Provider calls, client execution, alternate claim logic, generic URL
or non-YouTube inputs, pgvector, export, or chat/retrieval behavior.

## Mandatory pgTAP RED/GREEN

Write tests first and capture missing-function RED. Cover:

- exact signatures/catalog security/search path/service-only privileges;
- each of three job types registers with private input and exact owner/source;
- replay in pending/leased/retryable/terminal/succeeded preserves every existing
  public/private field; wrong owner/source/hash/input shape/size/clock rejected;
- failure CAS, attempts 1–4 backoff, attempt-5 retry rejection, attempts 1–5
  terminal clearing, wrong fence byte-for-byte preservation;
- each exact job/artifact mapping completes atomically and returns an owner
  artifact; content/prompt/model/result key/language/result/input/job state are
  exact; duplicate result does not overwrite;
- wrong mapping/result key/source/owner/lost lease leaves all rows unchanged;
- authenticated/anonymous roles cannot execute or gain new table writes.

Run fresh:

- `pnpm db:reset`
- `pnpm db:test`
- `CI=true pnpm test:contract`
- `CI=true pnpm typecheck`
- `CI=true pnpm build`
- `git diff --check`

Commit only allowed files and return SHA, RED/GREEN totals, risks, and handoff.

## Upstream and license

YouTube Digest has no persistence primitive to reuse here. LLM Wiki contributes
method-level durable processing inspiration only. Copy no GPLv3 code, SQL,
tests, names, prompts, components, or assets.
