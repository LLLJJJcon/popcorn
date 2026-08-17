# Controller Contract Gate — Atomic durable transcript-job transitions

## Identity

- Trigger: Batch A Task 2 independent review of `21ee0e1..3740908`.
- Baseline: `e9f3d292da3dd7ff352d8ba4ea232831ded9cc85`.
- Worktree: `/private/tmp/popcorn-resolve-job-atomic-contract`.
- Plans: Batch A Task 2 plus frozen Foundation queue/ownership contracts.

## Scope

Allowed:

- create `supabase/migrations/202608160006_resolve_job_atomicity.sql`
- modify `supabase/tests/rls.sql`
- this brief and create
  `docs/engineering/handoffs/batch-a/contract-resolve-job-atomicity.md`

Forbidden: application/extension code, prior migrations, generated database
types, root config, dependencies/lockfile, ledger/checkpoints, and other files.
The controller regenerates and verifies generated types after integration.

## Required interfaces

All functions are `security definer`, fixed `search_path = pg_catalog`, execute
revoked from `public`, `anon`, and `authenticated`, and granted only to
`service_role`. Every function takes an explicit expected user and verifies all
related rows belong to that user.

1. Atomically register a source-level `resolve_snapshot` job plus bounded private
   Provider reference after an HTTP 202. Concurrent/replayed calls with the same
   `(user, job_type, dedupe_key)` return the existing Popcorn job and must never
   overwrite its existing `knowledge_job_internal.input` or `result`, regardless
   of pending/leased/retryable/terminal/succeeded state. The function returns the
   database job ID/status and whether this call created/attached the reference.
   Validate owner/source, 64-lowercase-hex dedupe key, Provider ID length 1..200,
   and non-null canonical clock.

2. Atomically transition a leased job to a frozen retryable or terminal failure
   state under a CAS fence `(user_id, job_id, status='leased', exact
   lease_expires_at)`. In the same transaction it can attach one bounded private
   input (for first Provider 202), preserve existing input, or clear input for a
   terminal outcome. It must not expose or return private input. Reject invalid
   status/attempt/clock/error combinations and reject attach+clear together.
   A lost fence returns false with no public or private mutation.

3. Atomically complete a `resolve_snapshot` job under the same lease fence. It
   verifies the snapshot belongs to the expected user and the job's source, then
   in one transaction sets job `succeeded`, writes strict bounded internal result
   `{ "snapshotId": <uuid> }`, clears internal input, and, when present, moves
   the exact owner/source saved item to `ready` with that snapshot. A lost fence,
   wrong owner/source, or wrong job type leaves every job/internal/saved row
   unchanged and returns false (or raises before mutation).

Function names and signatures may be chosen for clear generated PostgREST RPC
use, but must remain narrow and typed. Do not add global scans, client execution,
Provider calls, triggers, or alternate queue semantics.

Consumes: frozen `knowledge_jobs`, `knowledge_job_internal`, snapshots, saved
items, lease rules, attempt maximum five. Produces the sole mutation paths Task 2
will consume for 202 registration, retry/terminal transition, and success commit.

## Mandatory pgTAP RED/GREEN evidence

Add tests first and run `pnpm db:test` to capture a meaningful missing-function
RED. Cover at minimum:

- exact function existence/signatures, SECURITY DEFINER/search path/privileges;
- same-user registration creates exactly one job/internal reference;
- concurrent/replay-equivalent registration returns existing and cannot replace
  Provider input or clear a result for every non-new state;
- wrong source owner and malformed bounded inputs fail without rows;
- lease-fenced transition attaches Provider ID and retry state together;
- lost/wrong-user fence leaves job and internal rows byte-for-byte unchanged;
- terminal transition clears Provider input in the same call;
- completion updates succeeded/result/input/saved-ready together;
- wrong snapshot owner/source and lost fence leave all rows unchanged;
- no authenticated/anonymous execution and no new public table access.

Then run fresh:

- `pnpm db:test`
- `CI=true pnpm test:contract`
- `CI=true pnpm typecheck`
- `CI=true pnpm build`
- `git diff --check`

Commit migration/tests/brief/handoff only and report SHA, pgTAP totals, other
gates, risks, and handoff path.

## Provenance and license

This is original Popcorn database transaction/lease work. YouTube Digest has no
persistence primitive to copy. LLM Wiki contributes method-level inspiration
only; copy no GPLv3 code, SQL, tests, names, or structure.
