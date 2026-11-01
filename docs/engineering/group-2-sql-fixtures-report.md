# Group 2 SQL fixtures and concurrency integration

This is an implementation/integration task, **not the independent Group 2 acceptance gate**. Controller assigned the six test paths below after the backend owner paused editing them. No runtime/server/schema/migration file, personal database, commit or push was changed by this task.

Worktree: `/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度`, branch `codex/phase1-groups2-4`.

## Isolated database boundary

Every SQL invocation used `python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py` and the explicit CLI `--workdir /private/tmp/popcorn-phase1-test-stack`. The wrapper checks project `popcorn-phase1-groups24`, API 54331, DB 54332 and private credential-file permissions, then passes credentials only through the child environment. No bare `db:test` or reset command was used. No connection values, model credentials or status keys were printed.

Read-only final migration check returned 024/025/026/027. The backend owner applied 026 (durable open-round reuse requests) and 027 (independent scenario-deduplication hash normalization) while this integration work was in progress; this owner did not edit or apply those migrations.

The initial managed run could not write the CLI's local telemetry cache. The same authorized isolated test command was rerun with local tool permissions; the actual SQL RED log below is the resulting database test failure, not the cache-permission error.

## RED evidence

```sh
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py \
  node_modules/.bin/supabase test db \
  --workdir /private/tmp/popcorn-phase1-test-stack
```

- Log: `/private/tmp/group2-sql-fixtures-red.log`.
- Result: **FAIL, 14 files / 633 executed assertions**, four files stopped early at old `practice_drafts.status = 'active'`. The promotion cross-owner negative probe also received 23514 from that obsolete status instead of its intended owner-FK 23503.
- A separate concurrency RED run, using the wrapper and setting `POPCORN_TEST_DATABASE_URL` from the child's isolated `DATABASE_URL`, failed at the same obsolete draft `active` fixture. Log: `/private/tmp/group2-concurrency-red.log`.

## Test-only changes and preserved semantics

| Owned path | Integration change |
| --- | --- |
| `supabase/tests/practice_drafts.sql` | Draft fixtures now use `open`; lifecycle update expects `promoted`; the authenticated-write negative uses `removed`. Gateway-origin `active` and all unrelated statuses remain unchanged. Separate valid-live and unused-probe artifact identities prevent a second-open-round unique constraint from masking the intended provenance/owner/future-identity failures. |
| `supabase/tests/promote_practice_attempt.sql` | The failed-original, revision-only and forced-rollback cases now each reference an independent server-owned legacy artifact/index identity. Exact replay, modified replay arguments and wrong-owner probes still use the original candidate and attempt. Draft lifecycle expectations use `open`/`promoted`. |
| `supabase/tests/source_deletion.sql` | Only the draft fixture's old `active` value changes to `open`. Source-deleted promotion-receipt replay and source-deletion atomicity checks remain intact. |
| `supabase/tests/learning_card_practice_bounds.sql` | Only the draft fixture's old status changes to `open`. The accepted 300/10k target, 3k/10k evidence, 6k/10k answer, uncompressible index-key, no-confidence compatibility and source-deleted replay assertions remain intact. |
| `supabase/tests/practice_rounds.sql` | Extends the backend owner's 12 schema/RPC/ACL checks to **88 real database assertions** covering lifecycle, migration backfill, server assistance, identity, ownership and due shared behavior. |
| `tests/contract/practice-promotion-concurrency.sh` | Requires an explicit isolated test URL rather than silently defaulting to personal port 54322; updates only draft statuses; preserves the original dual-connection same-attempt test and adds a true dual-connection same-candidate cross-round stale-writer race. |

Original rejection semantics were not weakened: invalid original/revision promotion, exact receipt replay, changed replay inputs, cross-owner/source provenance, immutable gateway metadata, append-only attempts and late-receipt rollback still use their original expectations. Independent legacy fixtures are separated by actual artifact identity; no forged candidate keys bypass the database trigger. Cross-round and cross-artifact tests deliberately retain one stable highlight identity.

## New database coverage

- Unanswered round 1 remains open/New and reuses its original task. A reuse request gets a durable request receipt; retrying that request after round 2 exists still recovers round 1 rather than creating another round.
- A failed first answer automatically becomes `retry_scheduled` with its submitted timestamp +24h. Same-text first-answer replay is idempotent; different text reports the existing authoritative result without appending evidence.
- Server assigns revision order within the round; first and latest answers/coaching remain distinct. Passing revisions neither promote nor reset the default retry time.
- Whitespace/punctuation-only duplicate scenarios are rejected by SQL uniqueness. Failed publication leaves the old retry round intact. Scenario hashing stays separate from historical mastery context hashes.
- A retained highlight in a new analysis artifact keeps the same candidate key. Incoming forged keys are replaced by server identity; new round 2 inherits retry time, and its independent revision 1 promotes with `entry_round = 2`, mastery `tried` and first review +24h from that round's submitted time. All-five coaching is durably null.
- An already promoted candidate returns its canonical destination; even a privileged stale third-round writer cannot produce a second candidate promotion receipt.
- Examples are durable and idempotent, derive `model_answer` on the server despite a client `none` claim, and route perfect assisted originals to retry. Opening examples after a recorded independent answer does not rewrite its assistance or independent evidence on replay.
- Removal excludes immediately; Undo expiry is exactly five seconds after server removal; timely Undo restores the original state/time; expired Undo is rejected and preserves removal. Reactivation opens a fresh round with its own assistance marker.
- Due shared scope only: owner-checked examples persistence, server-derived assistance, no mastery advancement after assisted success, +1-day scheduling and stable official-attempt replay despite changed client assistance claims. No generation, regeneration or due-revision implementation is introduced.
- Actual authenticated roles exercise owner row RLS and server-only RPC denial; request-receipt table RLS and direct-read denial remain checked.

## Non-empty legacy backfill rehearsal

Five independent pre-024 cases are created inside the test's rollback transaction: old active + failed first answer, completed + actual promotion receipt, abandoned without first answer, unanswered active, completed without receipt. The test temporarily broadens only its transactional status constraint so those old literal values can exist, then runs the **original two UPDATE statements from migration 024 verbatim** and reinstates the five-state constraint. A source-level comparison confirmed the test's marked DML block equals those migration bytes exactly.

Assertions establish round 1; receipt → promoted; first answer without receipt → retry_scheduled at original submission +24h; all other rows (including old abandoned and completed-without-receipt) → open, as the confirmed spec states. Server candidate keys and real scenario hashes are reconstructed. Counts of expression senses, occurrences, user expressions, canonical practice tasks, attempts, mastery events, review tasks and promotion receipts remain unchanged. The outer rollback removes all test data and temporary DDL; no database reset or applied-migration editing was needed.

## Real concurrency cases

Both tests run real separate `psql` transactions. A third connection holds a gate; the first transaction completes promotion but waits before commit, the second starts and is observed waiting on an actual database lock, then the gate is released.

1. **Same attempt:** first returns `created=true`, second returns `created=false`, every canonical receipt ID matches, and each graph table/receipt has one row. Original text and revision remain intact; draft is promoted.
2. **Same candidate, different rounds:** round 2 has the same artifact/index identity and its own passing revision-1 staged attempt. Its stale privileged writer tries to make it current while round 1's promotion is still uncommitted, waits for that transaction, then promotion is rejected with SQLSTATE 40001 by the candidate receipt fence. There is one candidate key, one receipt and one canonical graph; round 1 is promoted, stale round 2 remains open with no canonical evidence, and official `entry_round=1` remains unchanged. The test does not split this race into independent candidate identities.

The shell exits if no explicit test database URL is supplied. In this run the wrapper mapped the isolated DB URL in memory, without printing it:

```sh
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py python3 -c \
  'import os; os.environ["POPCORN_TEST_DATABASE_URL"]=os.environ["DATABASE_URL"]; os.execvp("bash",["bash","tests/contract/practice-promotion-concurrency.sh"])'
```

## GREEN evidence

- Old four fixtures corrected, before expanded lifecycle coverage: **14 files / 748 assertions passed**. Log: `/private/tmp/group2-sql-fixtures-after-old-state.log`.
- New lifecycle SQL final focused run: **1 file / 88 assertions passed**. Log: `/private/tmp/group2-round-lifecycle-final.log`.
- Whole dedicated SQL suite: **14 files / 824 assertions passed**. Final log: `/private/tmp/group2-sql-fixtures-green.log` (refreshed after adding canonical practice-task count to backfill invariants).
- `bash -n tests/contract/practice-promotion-concurrency.sh` passed; real same-attempt and same-candidate-cross-round races both passed. Log: `/private/tmp/group2-concurrency-green.log` contains both success markers.
- Final read-only cleanup check: zero reserved concurrency auth users, zero `popcorn_practice_promotion_*` database sessions. Test migrations reported 027/026/025/024.

No implementation defect was hidden by adjusted expectations, and no additional runtime fix was required by these tests. Final independent group acceptance, full application checks and browser suites remain the controller's separate gate.
