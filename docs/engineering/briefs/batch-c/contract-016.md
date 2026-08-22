# CONTRACT-016 Source Deletion — Controller Brief

## Assignment

- Plan: `docs/superpowers/plans/2026-08-22-popcorn-batch-c-school-demo-revision.md`
- Gate: Batch C Task 4 controller pre-task contract gate (CONTRACT-016)
- Baseline commit: `a5c45fd`
- Worktree: `/private/tmp/popcorn-youtube-learning`
- Owner: main Implementation Controller; migration, pgTAP, generated types, and final integration may not be delegated.

## File boundary

Allowed:

- Create `supabase/migrations/202608220016_source_deletion.sql`
- Create `supabase/tests/source_deletion.sql`
- Regenerate `src/types/database.generated.ts`
- Create this brief and `docs/engineering/handoffs/batch-c/contract-016.md`
- After independent PASS, update `docs/engineering/execution-ledger.md`

Forbidden:

- Application routes, repositories, components, account deletion, archive/undo, analytics, provider adapters, root configuration, lockfile, or any earlier migration.

## Frozen interface

Consumes the source/save/artifact/job/draft/canonical-learning graph and immutable practice-promotion receipt. Produces only the service-role RPC:

```text
delete_video_source(p_user_id, p_video_source_id, p_mode, p_now)
  -> { deleted, retained_user_expression_count }
```

Modes are exactly `remove_unpracticed_source` and `remove_source_keep_evidence`. The first refuses promoted evidence. The second retains canonical sense semantics, user expression, tasks, attempts, mastery events, review tasks, due-completion receipts, promotion replay IDs, and scrubs every source identity/body/locator. Both modes lock and re-evaluate the owned source and terminalize/delete its durable job graph atomically.

## TDD and verification

Expected RED: focused `source_deletion.sql` fails because the migration, tombstone state, and RPC do not exist.

Required GREEN:

```bash
supabase db reset
supabase test db supabase/tests/source_deletion.sql
supabase test db
supabase gen types typescript --local --schema public,private
pnpm typecheck
git diff --check
```

The test must cover both modes, wrong-mode refusal, cross-owner/unknown source, retained canonical IDs, exact promotion replay after deletion, absence of source text/URL/video/time/segment locators, service-role-only execution, terminalized source jobs that cannot publish, and transaction rollback under a forced final source-delete failure.

## Upstream and license

- YouTube Digest pin `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`: not used; this contract is Popcorn-owned PostgreSQL lifecycle work.
- LLM Wiki pin `nashsu/llm_wiki@723e259309aea5e3850265b631f80224f66dd9f6`: not used; no GPLv3 code, tests, prompts, components, or assets may be copied.
- Preserve repository MIT notices and existing provenance boundaries.
