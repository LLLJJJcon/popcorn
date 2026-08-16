# Batch A Controller Database Contract Correction

## Trigger and baseline

- Triggering plans: Batch A Task 2 (persist private asynchronous Provider reference/result without public leakage) and Task 4 (one atomic idempotent capture transaction).
- Baseline/checkpoint: `b258e49fb745eac0309de3fcb6848e87ef43979f`; frozen implementation head `c790118dc89297af965dee8048a2722a98bee802`.
- Branch/worktree: `codex/popcorn-batch-a-db-contract` at `/private/tmp/popcorn-batch-a-db-contract`.
- Controller-owned contract proposal `CONTRACT-003`; feature Agents remain forbidden from editing migrations, RLS, or generated types.

## Allowed files

- `supabase/migrations/202608160004_batch_a_job_capture.sql`
- `supabase/tests/rls.sql`
- `src/types/database.generated.ts`
- `docs/engineering/briefs/batch-a/controller-db-contract.md`
- `docs/engineering/handoffs/batch-a/controller-db-contract.md`

No other file may change.

## Required interfaces

1. Add a private-to-clients, service-worker-accessible relational companion for durable job input/result metadata. It must carry direct non-null `user_id`, composite job ownership, JSON-object checks, timestamps, RLS, no anon/authenticated privileges or policies, explicit service-role CRUD, and restrictive deletion. Provider job IDs/payloads/results must never become readable through authenticated direct PostgREST selection of `knowledge_jobs`.
2. Add `public.capture_saved_item(...)` as one atomic RPC for authenticated callers. It derives the user exclusively from `auth.uid()`, derives the canonical YouTube URL, upserts the `(user_id,youtube_video_id)` source, inserts the exact validated saved-item payload, coalesces exactly one pending `resolve_snapshot` job for a newly inserted event, and returns `{video_source_id,saved_item_id,status:'saved'}`. Replay of the same `(user,client_event_id)` returns the original logical IDs without rewriting raw payload or creating a second job; a new event ID at the same timestamp creates a distinct save.
3. The RPC uses `SECURITY DEFINER` only because authenticated clients cannot forge server-controlled jobs. It must have fixed `pg_catalog` search path, fully qualified objects/functions, no caller-supplied user ID/status/job type/hash, PUBLIC/anon execute revoked, authenticated execute granted, and explicit bounded parameters enforced by existing table validators.
4. Job dedupe is lowercase SHA-256 over a tagged, unambiguous server-owned identity containing user/source/saved-item/job type. No Provider/AI call occurs in SQL.

## Strict TDD and verification

- First extend the existing `no_plan()` pgTAP suite. Capture RED against the baseline: missing internal metadata table/RLS/privilege boundary and missing capture RPC/behavior.
- GREEN must prove catalog security, service-role-only metadata, authenticated non-disclosure, user-derived ownership, atomic source/save/job creation, exact payload persistence, replay idempotency, deliberate same-time distinct save, no cross-user reuse, and job lifecycle/hash shape.
- Apply a clean reset twice, run full pgTAP, regenerate TypeScript types mechanically, confirm only the CLI trailing blank-line difference if any, then run typecheck/contract/verify and `git diff --check`.

## License/scope

No upstream code applies. LLM Wiki contributes only the already approved durable-queue/source-traceability methods; copy no GPLv3 code/test/SQL/prompt/structure. Add no dependency, generic source, vector, graph, chat, export, or Provider behavior.
