# Foundation Task 3 Handoff

## Scope and baseline

- Baseline: `fdd29126ce745a7b77f06446b6af2e8f65c154b8`
- Branch: `codex/popcorn-foundation-3`
- Scope: Foundation Task 3 only — local Supabase configuration, schema, RLS, seed, pgTAP acceptance tests, and mechanically generated database types.
- Upstream treatment: all SQL and tests are original Popcorn work. No YouTube Digest or LLM Wiki implementation, SQL, test, prompt, component, or asset was copied.

## TDD evidence

The acceptance test was written before either production migration.

Initial RED:

```text
$ node_modules/.bin/supabase db reset
exit 0; no migrations applied; seed file not yet present

$ node_modules/.bin/supabase test db
exit 1
Failed tests 1-14: profiles through review_tasks do not exist
ERROR: relation "profiles" does not exist
Result: FAIL
```

Review-driven regression RED/GREEN cycles:

```text
# Invalid six-kind saved payloads before the kind-aware validator
$ node_modules/.bin/supabase test db
exit 1; 3/105 failed because malformed subtitle_selection,
key_quote, and player_moment payloads unexpectedly succeeded

# Invalid occurrence segment IDs before element validation
$ node_modules/.bin/supabase test db
exit 1; 2/107 failed because whitespace-padded and null IDs
unexpectedly succeeded

# Invalid Chinese/English variant text before exact content validation
$ node_modules/.bin/supabase test db
exit 1; 4/171 failed because non-Han Chinese fields, non-ASCII English,
letterless English, and non-Chinese context unexpectedly succeeded
```

Final GREEN database evidence:

```text
$ node_modules/.bin/supabase db reset
exit 0; both migrations applied, seed loaded, containers restarted

$ node_modules/.bin/supabase test db
exit 0
Files=1, Tests=171
All tests successful.
Result: PASS
```

## Schema and security decisions

- All 14 application tables carry a direct non-null `user_id` and `created_at`; all 14 enable RLS.
- Child-to-parent ownership is enforced by composite foreign keys containing `user_id`, not by RLS-only joins. pgTAP exercises every public parent edge with a cross-owner failure.
- All parent and auth foreign keys use explicit `ON DELETE RESTRICT`. Raw transcript/save evidence and mastery history cannot disappear through cascades.
- Authenticated owner policies use `(select auth.uid()) = user_id` and explicit `WITH CHECK` clauses. The suite proves owner-positive operations and user-B denial of user-A SELECT/INSERT/UPDATE/DELETE across all tables.
- `video_sources`, `video_snapshots`, `transcript_segments`, `saved_items`, and `mastery_events` are append-only for authenticated clients: SELECT/INSERT are allowed, UPDATE/DELETE have no policy. Both forbidden mutations are tested for each table.
- The six saved-item variants retain their exact source text and variant fields in bounded JSONB, guarded by a kind-aware immutable validator. Identity, ownership, source/snapshot links, idempotency, status, timestamps, and indexed time remain relational.
- Expression occurrence segment arrays enforce the frozen stable-ID element rules as well as the 1..32 cardinality bound.
- Attempt evaluation dimensions are relational columns rather than opaque JSONB.
- Hashes are lowercase 64-hex, languages are fixed to `en`/`zh-CN`, and job state-dependent lease/retry/error fields follow the frozen lifecycle.
- `pg_trgm` is enabled for the required Simplified Chinese expression GIN index. The `vector` extension is neither enabled nor present.
- Service-role workers bypass RLS by design. They are server-only and must still include the explicit job `user_id` in every read and mutation; a schema comment records this requirement.

## Seed and generated types

- Seed identities: deterministic user A and user B.
- Seed domain data: one user-A Chinese YouTube source, one immutable snapshot, and three timestamped transcript segments. User B has no source/snapshot/segment data.
- Types were generated mechanically from the green local database:

```text
$ node_modules/.bin/supabase gen types typescript --local > src/types/database.generated.ts
exit 0; Connecting to db 5432
```

Only the CLI's extra trailing blank line was removed so `git diff --check` remains clean; type content is otherwise the direct generated output.

## Verification

```text
$ CI=true pnpm typecheck
exit 0; tsc --noEmit

$ CI=true pnpm test:contract
exit 0; 1 file passed, 128 tests passed

$ git diff --check
exit 0
```

## Changed files

- `docs/engineering/briefs/foundation/task-3.md` — controller brief, committed unchanged.
- `supabase/config.toml` — CLI-generated local project configuration; vector storage explicitly disabled.
- `supabase/.gitignore` — retained from the pinned CLI because it excludes branch/temp state and local dotenv key material.
- `supabase/migrations/202608160001_schema.sql` — schema, constraints, indexes, ownership FKs, and bounded validators.
- `supabase/migrations/202608160002_rls.sql` — RLS enables, grants, owner policies, and append-only boundaries.
- `supabase/seed.sql` — deterministic two-user and Chinese transcript seed.
- `supabase/tests/rls.sql` — 171 pgTAP acceptance assertions.
- `src/types/database.generated.ts` — mechanically generated local database types.
- `docs/engineering/handoffs/foundation/task-3.md` — this append-only handoff record.

## Risks and Task 4 follow-up

- Task 4's leasing worker must preserve the database job lifecycle constraint and always scope service-role queries by `user_id`; RLS cannot enforce that scope for a bypass role.
- `updated_at` columns are explicit application/worker responsibilities in this foundation migration; no generic update trigger was introduced.
- Delete behavior is intentionally restrictive. A future account-erasure workflow must perform an explicit, audited dependency-order deletion rather than relying on cascades.
- Task 4 may consume the generated types and leasing columns, but Task 4 domain code, Cron, and worker behavior were not started here.
