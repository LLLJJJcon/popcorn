# Foundation Task 3 Implementation Brief

## Controller assignment

- Plan and task: `docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md`, Task 3.
- Baseline commit: `fdd29126ce745a7b77f06446b6af2e8f65c154b8`.
- Worktree: `/private/tmp/popcorn-foundation-3`.
- Branch: `codex/popcorn-foundation-3`.
- Execution order: Foundation Task 2 is accepted and frozen; implement only Task 3. Do not begin Task 4.

## Allowed and forbidden files

Allowed to create or modify:

- `supabase/config.toml`
- `supabase/migrations/202608160001_schema.sql`
- `supabase/migrations/202608160002_rls.sql`
- `supabase/seed.sql`
- `supabase/tests/rls.sql`
- `src/types/database.generated.ts`
- `docs/engineering/handoffs/foundation/task-3.md`
- this controller-created brief must be committed unchanged
- `supabase/.gitignore` only if the pinned Supabase CLI creates it and it is required for local-state exclusion; document why

Forbidden:

- every frozen file under `src/contracts/**`
- `package.json`, `pnpm-lock.yaml`, and all other root configuration
- extension/vendor/provenance files, application routes/components, Task 4 domain code, Cron, CI, plans/specs, execution ledger, and user artifacts
- dependency or lockfile changes; Supabase CLI `2.114.0` is already lockfile-pinned

## Frozen interfaces consumed

Use the exact Task 2 names, enums, hashes, ownership, timestamps, and lifecycle meanings. Every public user-owned table must duplicate non-null `user_id`, including child rows, so RLS never requires a deep ownership join. The database must support the frozen entities and direct relationships: profiles; video sources/snapshots/segments; six-kind exact saved items; generated artifacts and five-kind durable jobs; expression senses/occurrences/user mastery; bilingual practice tasks; attempts with dimensional evaluation; append-only mastery events; review tasks with `pending|completed|cancelled`.

Database naming is snake_case, with a clear mechanical mapping to Task 2 camelCase. Preserve exact learner/source text; do not normalize saved quotes/selections or mutate immutable transcript evidence. Use JSONB only for genuinely variant bounded payload/evaluation/artifact content, while keeping ownership, identity, source linkage, timestamps, status, idempotency, hash, queue lease/retry, and indexed retrieval fields relational and constrained.

## Required RED evidence

Write `supabase/tests/rls.sql` before production migrations and capture a failing local DB test proving the schema/policies do not yet exist. Tests must create or use two deterministic auth identities and prove authenticated user B cannot select, insert, update, or delete user A rows across source, snapshot, segment, save, artifact, job, expression, occurrence, user-expression, practice, attempt, mastery event, and review ownership. Prove `mastery_events` cannot be updated or deleted by client roles. Add positive user-A access/ownership checks so a blanket-deny policy cannot pass.

Also test the required unique/check/hash/language/lifecycle constraints, direct `user_id not null` ownership, append-only raw source/evidence behavior, and that all public tables have RLS enabled. Test the exact required indexes by name or catalog shape. Service-role behavior must not be represented as ordinary client access; document that application workers must still query by explicit job `user_id` despite service-role RLS bypass.

## Schema acceptance details

- Use lowercase 64-hex checks for transcript/result/dedupe hashes and exact enum/check values frozen by Task 2.
- Enforce canonical YouTube identity fields and direct ownership. No generic URL/text/image source tables, pgvector, graphs, chat retrieval, export, or advanced Progress schema.
- Enforce unique `(user_id, youtube_video_id)`, `(user_id, client_event_id)`, `(video_source_id, transcript_hash)`, `(snapshot_id, stable_id)`, `(user_id, artifact_type, result_key)`, and `(user_id, job_type, dedupe_key)`.
- Include job `next_attempt_at`, `lease_expires_at`, attempts, and error category so Task 4 can implement recoverable leasing without a migration rewrite.
- Include the exact retrieval/index requirements in the extracted task below, including pg_trgm but never vector.
- Foreign-key ownership must not allow a child row for user A to reference a parent owned by user B. Enforce this with composite ownership foreign keys or an equally direct database constraint, and test it.
- Choose safe explicit delete behavior. Raw save/transcript and mastery history must not be silently cascaded away in conflict with the design; record the decision in the handoff.

## Verification commands

- `node_modules/.bin/supabase db reset`
- `node_modules/.bin/supabase test db`
- `node_modules/.bin/supabase gen types typescript --local` to mechanically regenerate `src/types/database.generated.ts`
- `CI=true pnpm typecheck`
- `CI=true pnpm test:contract`
- `git diff --check`

Docker was read-only checked by the controller (server `29.3.1`), and the pinned local Supabase CLI reports `2.114.0`. Supabase/Docker commands may need normal host access to the local Docker socket and the CLI user cache. Do not weaken or skip database tests because of sandbox access; report the exact command if escalation is needed.

## Upstream reuse and license treatment

- YouTube Digest is pinned at `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`. Task 3 consumes no upstream file or function; do not copy or regenerate any extension implementation.
- LLM Wiki is method-reference-only at v0.6.9 / `723e259309aea5e3850265b631f80224f66dd9f6`. The only relevant allowed ideas are immutable raw sources, schema-governed structured knowledge, content hashes, and a persistent queue. Do not copy GPLv3 code, SQL, tests, prompts, components, or assets.
- All SQL and tests must be original Popcorn implementation. No new third-party artifact or license file is expected.

## Commit and handoff

Commit only the allowed Task 3 files. Write `docs/engineering/handoffs/foundation/task-3.md` with actual RED/GREEN commands and results, generated-type command, schema/RLS decisions, changed files, risks, and follow-up. Return the commit SHA, test results, risks, and report path.

## Extracted authoritative task

### Task 3: Create the database schema, indexes, and RLS

**Files:**

- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608160001_schema.sql`
- Create: `supabase/migrations/202608160002_rls.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/rls.sql`
- Create: `src/types/database.generated.ts`

**Interfaces:**

- Consumes: Task 2 field names and enums.
- Produces: `profiles`, `video_sources`, `video_snapshots`, `transcript_segments`, `saved_items`, `generated_artifacts`, `knowledge_jobs`, `expression_senses`, `expression_occurrences`, `user_expressions`, `practice_tasks`, `attempts`, `mastery_events`, and `review_tasks`.

- [ ] **Step 1: Write failing RLS and constraint assertions**

Create two deterministic users. Assert user B cannot select, insert, update, or delete user A source, snapshot, segment, save, artifact, job, expression, attempt, or review task. Assert a client cannot update or delete `mastery_events`.

Run:

```bash
pnpm exec supabase init
pnpm db:reset
pnpm db:test
```

Expected: FAIL because tables and policies do not exist.

- [ ] **Step 2: Implement schema invariants**

The migration must include these exact uniqueness and status rules:

```sql
create extension if not exists pg_trgm;

create unique index video_sources_user_video_unique
  on video_sources (user_id, youtube_video_id);
create unique index saved_items_user_event_unique
  on saved_items (user_id, client_event_id);
create unique index video_snapshots_source_hash_unique
  on video_snapshots (video_source_id, transcript_hash);
create unique index transcript_segments_snapshot_stable_unique
  on transcript_segments (snapshot_id, stable_id);
create unique index generated_artifacts_user_result_unique
  on generated_artifacts (user_id, artifact_type, result_key);
create unique index knowledge_jobs_user_dedupe_unique
  on knowledge_jobs (user_id, job_type, dedupe_key);

alter table user_expressions add constraint mastery_state_check
  check (mastery_state in ('tried', 'reused', 'owned'));
alter table saved_items add constraint saved_item_status_check
  check (status in ('saved', 'resolving_source', 'organizing', 'ready', 'unsupported', 'failed'));
alter table knowledge_jobs add constraint knowledge_job_status_check
  check (status in ('pending', 'leased', 'succeeded', 'retryable_failed', 'terminal_failed'));
alter table knowledge_jobs add constraint knowledge_job_type_check
  check (job_type in ('resolve_snapshot', 'generate_overview', 'translate_segments',
    'explain_selection', 'analyze_saved_item'));
```

Every user-owned table has `user_id uuid not null`, `created_at timestamptz not null default now()`, and appropriate updated timestamps. `transcript_segments` stores ordinal, stable ID, original text, start/end seconds, language, and snapshot ID. `generated_artifacts.result_key` and `knowledge_jobs.dedupe_key` are non-null hashes over the documented source/payload/prompt/model inputs. Raw source and mastery history are append-only from client roles.

- [ ] **Step 3: Add retrieval and job indexes**

Add indexes for `saved_items(user_id, video_source_id, start_seconds)`, `knowledge_jobs(status, next_attempt_at, lease_expires_at)`, `review_tasks(user_id, due_at, status)`, normalized expression text, and a GIN trigram index over Simplified Chinese expression text. Do not enable `vector`.

- [ ] **Step 4: Implement RLS**

Enable RLS on every public table. Duplicate `user_id` on child records so policies use `(select auth.uid()) = user_id` without deep joins. Apply `to authenticated` and explicit `with check` clauses. Service-role workers are server-only and must still filter every operation by job `user_id`.

- [ ] **Step 5: Seed fixtures and generate types**

Seed two users, one Chinese YouTube source/snapshot for user A, three timestamped transcript segments, and no data for user B.

```bash
pnpm db:reset
pnpm db:test
pnpm exec supabase gen types typescript --local > src/types/database.generated.ts
pnpm typecheck
```

Expected: reset succeeds, RLS assertions pass, and generated types compile.

- [ ] **Step 6: Commit**

```bash
git add supabase src/types/database.generated.ts package.json pnpm-lock.yaml
git commit -m "feat: add secure YouTube learning schema"
```
