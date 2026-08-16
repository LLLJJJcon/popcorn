# Batch A Controller Database Contract Handoff

## Baseline and scope

- Baseline: `b258e49fb745eac0309de3fcb6848e87ef43979f`
- Worktree: `/private/tmp/popcorn-batch-a-db-contract`
- Contract: `CONTRACT-003`
- Changed only the controller-owned migration, pgTAP contract, generated database types, and this task's brief/handoff.

## RED

`pnpm exec supabase test db` failed against migrations 001-003 with 8 failures: the `knowledge_job_internal` table/RLS/CRUD boundary and the `capture_saved_item(...)` function were absent. The run stopped at the missing RPC after 222 pgTAP assertions, as expected.

## GREEN

- Migration 004 adds a directly owned, RLS-enabled `knowledge_job_internal` companion. Direct clients have no table grants or policies; `service_role` receives explicit CRUD and no schema/trigger privileges.
- Migration 004 makes service-role CRUD explicit across all 15 owner-bearing application tables. BYPASSRLS alone did not supply PostgREST table privileges; this is necessary for the durable workers specified by Batch A.
- `capture_saved_item(...)` derives `auth.uid()`, canonicalizes the YouTube URL, atomically creates/reuses the source, writes the exact raw payload, enqueues one `resolve_snapshot` job, and returns immediately. It accepts no user/status/job/hash input.
- Same-user event replay returns the original IDs without overwriting payload or duplicating the job; the same timestamp with a new event remains distinct; the same event ID under another user remains isolated.
- Dedupe keys are lowercase SHA-256 over a tagged JSON-array identity owned by the server.
- The RPC is `SECURITY DEFINER`, has `search_path=pg_catalog`, uses fully qualified relations, and grants execution only to `authenticated`.

## Verification evidence

- Clean local reset applied migrations 001-004 and deterministic seed successfully twice after the final behavior change.
- `pnpm exec supabase test db`: 237/237 passed.
- Mechanically regenerated types match `node_modules/.bin/supabase gen types typescript --local` except the CLI's final blank line.
- `pnpm verify`: lint, typecheck, unit 76/76, contract 128/128, integration no-spec, provenance 11/11, and production build passed.
- `git diff --check`: passed.

## Risks and follow-up

- Service-role repositories must still include `user_id` in every read/mutation even though the role bypasses RLS; independent review must treat any missing owner filter as blocking.
- The internal metadata JSON schema intentionally enforces only bounded relational/object shape here. Task A2 owns Provider-specific parsing and must validate the frozen contract before persistence/return.
- Deployment must apply migration 004 before A2 or A4 routes are released.

## License

No upstream code, tests, SQL, prompts, components, or assets were copied. LLM Wiki remains method-only under the frozen GPLv3 isolation policy.
