# Task Handoff

- Status: DONE
- Plan and task: Controller contract gate triggered by Batch A Task 2 review; atomic durable transcript-job transitions
- Worktree and branch: `/private/tmp/popcorn-resolve-job-atomic-contract`; `codex/popcorn-resolve-job-atomic-contract`
- Baseline SHA: `e9f3d292da3dd7ff352d8ba4ea232831ded9cc85`
- Commit SHA: this task commit (reported to the controller after creation)

## Implemented

- Added `register_resolve_snapshot_job(...)`, a service-role-only source-level
  registration RPC. It validates explicit owner/source, lowercase SHA-256
  dedupe key, bounded Provider ID, and finite clock. Only the inserting call
  creates `knowledge_job_internal`; all dedupe replays return the existing job
  status without updating existing private input or result in any lifecycle
  state.
- Added `transition_resolve_snapshot_failure(...)`, an exact
  `(user, job, leased status, lease expiry, attempt count)` CAS transition.
  Retry transitions use the frozen 1/2/4/8-minute bounded backoff and can attach
  only a missing Provider reference. Terminal transitions clear private input.
  Public state and private attach/preserve/clear commit in one database
  transaction, and a lost fence returns `false` without mutation.
- Added `complete_resolve_snapshot_job(...)`, which locks the exact leased
  `resolve_snapshot` row, verifies snapshot owner and source, then atomically
  writes `succeeded`, strict `{ "snapshotId": <uuid> }` private result, clears
  private input, and moves the exact linked saved item to `ready`.
- Added catalog, privilege, ownership, replay, lifecycle, lost-fence,
  byte-for-byte preservation, and atomic-success pgTAP coverage.

## Upstream provenance used

- YouTube Digest: no persistence primitive applies; no source, tests, names, or
  structure were copied.
- LLM Wiki `v0.6.9` / `723e259309aea5e3850265b631f80224f66dd9f6`:
  method-level durable processing inspiration only. No GPLv3 code, SQL, tests,
  prompts, components, assets, names, or structure were copied.
- The migration and pgTAP cases are original Popcorn transaction and
  lease-fencing work.

## Interfaces consumed and produced

- Consumed frozen tables and constraints: `video_sources`, `video_snapshots`,
  `saved_items`, `knowledge_jobs`, `knowledge_job_internal`; maximum five
  operational attempts; five-minute leases; exact owner-bearing rows.
- Produced service-role-only PostgREST RPCs:
  - `register_resolve_snapshot_job(uuid,uuid,text,text,timestamptz)`
  - `transition_resolve_snapshot_failure(uuid,uuid,timestamptz,integer,text,timestamptz,text,text,boolean,timestamptz)`
  - `complete_resolve_snapshot_job(uuid,uuid,timestamptz,integer,uuid,timestamptz)`
- Every RPC is `SECURITY DEFINER`, fixes `search_path = pg_catalog`, accepts an
  explicit user, and performs no global work discovery. Generated database
  types intentionally remain controller-owned and unchanged.

## Files changed

- `docs/engineering/briefs/batch-a/contract-resolve-job-atomicity.md`
- `supabase/migrations/202608160006_resolve_job_atomicity.sql`
- `supabase/tests/rls.sql`
- `docs/engineering/handoffs/batch-a/contract-resolve-job-atomicity.md`

## TDD evidence

### RED

- Command: `pnpm db:test`
- Exit: 1
- Evidence: pgTAP tests 250-252 failed because all three expected functions
  were absent; the first behavior call stopped with
  `function public.register_resolve_snapshot_job(...) does not exist`.
- No migration implementation existed for this run.

### GREEN

- Commands: `pnpm db:reset`, then `pnpm db:test`
- Exit: 0 for both final runs.
- Evidence: migration 006 applied from a recreated database and pgTAP reported
  `Files=1, Tests=280`, `All tests successful`, `Result: PASS`.
- During the cycle, two test-fixture defects were corrected: psql variables are
  not expanded inside a dollar-quoted `DO` block, and seeded saved evidence is
  protected by a composite occurrence FK. Dedicated completion fixtures now
  isolate the atomic behavior under test.

## Broader verification

- `CI=true pnpm test:contract`: 1 file, 128 tests passed.
- `CI=true pnpm typecheck`: exit 0.
- `CI=true pnpm build`: exit 0; Next.js compiled and generated all routes.
- `git diff --check`: exit 0 before handoff creation and rerun immediately
  before commit.

## Contract or migration changes requested

- Controller should integrate migration 006, regenerate
  `src/types/database.generated.ts`, and update the Batch A Task 2 consumer to
  use these RPCs instead of split public/private mutations.

## Risks and follow-up

- PostgREST generated types are intentionally stale in this task worktree;
  controller regeneration is required immediately after integration.
- This gate stores an already-created snapshot UUID atomically with job/result/
  saved state. Snapshot and transcript row creation remains upstream of the
  completion RPC and must finish before invoking it.
- Local dependency verification briefly encountered a concurrent pnpm
  `node_modules` self-check race. Dependencies were restored serially from the
  content-addressable store; all mandatory gates were then rerun successfully.
