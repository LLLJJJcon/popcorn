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

## Corrective review follow-up

This review pass is a new commit on top of baseline `781b595f55c1fe1bc7485c6e7bf96ece247c6282`. It remains within the Foundation Task 3 schema, RLS, seed, pgTAP, generated-type, and handoff files; no Task 4 application or worker code was started.

### Independent RED/GREEN evidence

The review concerns were first reproduced against the baseline implementation:

```text
$ node_modules/.bin/supabase test db
exit 1
Files=1, Tests=196
23 failed
```

The 23 RED assertions covered five authenticated server-state forgery/rewrite/delete paths, four missing occurrence traceability/segment checks, nine missing relational-language checks, and five nondeterministic seed hash/timestamp checks.

After the corrective implementation, the focused schema/RLS suite reached 198/198. Two intermediate failures were then diagnosed and corrected: a test fixture segment UUID collided with the deterministic seed, and PostgreSQL default table privileges still exposed 27 authenticated server-table DML grants despite the RLS policy restrictions. The migration now explicitly revokes those grants. Additional grant-matrix and exact seed assertions expanded the final suite:

```text
$ node_modules/.bin/supabase test db
exit 0
Files=1, Tests=211
All tests successful.
Result: PASS
```

### Corrected security and traceability decisions

- Authenticated learners have CRUD only on `profiles`; SELECT/INSERT only on raw learner-owned `video_sources`, `video_snapshots`, `transcript_segments`, and `saved_items`; and SELECT only on the nine server-controlled tables. Explicit table grants and RLS policies enforce both layers.
- `saved_items` now links to a snapshot under the same user and source through a composite foreign key.
- Every expression occurrence has non-null source and saved-item links. Composite foreign keys require its source, sense, snapshot, and saved item to agree on user/source/snapshot identity.
- An invoker-security trigger with a fixed `pg_catalog` search path rejects duplicate stable segment IDs and IDs not present in the occurrence's own snapshot. PUBLIC execute is revoked.
- Frozen relational language checks now cover transcript, expression sense, occurrence evidence, practice-task, and attempt fields. Tests also prove exact source strings survive unchanged.
- The seed uses a fixed, known non-secret bcrypt fixture hash and exact timestamps for both auth/profile users and all source, snapshot, and segment rows. It contains no runtime hash or clock generation.

The service-role boundary remains intentional: server workers bypass RLS and therefore must always supply and scope by explicit `user_id`. Delete behavior remains `RESTRICT`; an account-erasure flow still requires an explicit audited dependency order.

Generated types were regenerated from the corrected local database with the same mechanical command documented above; only the CLI-added final blank line was removed.

### Final independent audit correction

The final read-only audit found that the first SQL Chinese detector used overly broad CJK ranges and therefore did not exactly match Task 2's frozen ECMAScript `\p{Script=Han}` contract. Focused pgTAP regressions proved that U+2FF0 `⿰` and U+31C0 `㇀` were incorrectly accepted:

```text
$ node_modules/.bin/supabase test db
exit 1
Files=1, Tests=213
2 failed (assertions 190 and 195)
```

The SQL detector now uses the exact contiguous code-point intervals derived locally from the repository runtime's `\p{Script=Han}` regex. After a clean reset, both non-Han symbol regressions and the full suite pass:

```text
$ node_modules/.bin/supabase db reset
exit 0

$ node_modules/.bin/supabase test db
exit 0
Files=1, Tests=213
All tests successful.
Result: PASS
```

### UTF-16 length-boundary review correction

This corrective iteration is based on commit `416a72fcb70015f7f30e293c69559cad45a86fb7`. The frozen Task 2 Zod limits count JavaScript UTF-16 code units, while PostgreSQL `length(text)` counts Unicode code points. Consequently, supplementary Han characters were undercounted by the SQL validator.

Focused relational pgTAP assertions first proved that 100 copies of U+20000 (exactly 200 UTF-16 code units) were accepted and that 101 copies (202 UTF-16 code units) were incorrectly accepted:

```text
$ node_modules/.bin/supabase test db
exit 1
Files=1, Tests=215
Failed test 190: expression text rejects supplementary Han above 200 UTF-16 code units
Failed 1/215 subtests
Result: FAIL
```

`private.is_target_chinese` now scans the entire value, counts BMP code points as one UTF-16 unit and supplementary code points as two, rejects the value once it exceeds the supplied maximum, and independently tracks whether the value contains a character in the exact frozen `Script=Han` intervals. Existing nonblank behavior and the separate ASCII-English validator are unchanged.

```text
$ node_modules/.bin/supabase db reset
exit 0

$ node_modules/.bin/supabase test db
exit 0
Files=1, Tests=215
All tests successful.
Result: PASS
```

The change affects validator behavior only and does not change any database row, relationship, or enum shape, so generated TypeScript types were intentionally not regenerated in this iteration.
