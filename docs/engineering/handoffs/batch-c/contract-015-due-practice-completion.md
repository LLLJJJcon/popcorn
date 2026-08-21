# CONTRACT-015 due Practice completion handoff

- Plan dependency: Batch C Task 2 atomic completion prerequisite; Batch C Task 3 typed-schema prerequisite.
- Baseline: `8d4ec2c`; controller brief commit: `9bcd42b`.
- Scope: migration 014, focused pgTAP, generated database types, brief clarification, and this handoff only.

## RED evidence

- Initial focused pgTAP: 6/6 assertions failed because the review lifecycle columns, task linkage/fingerprint, private receipt, and `complete_due_practice` RPC did not exist.
- Strengthened replay test exposed that a reused request key with a changed response payload was accepted; the RPC now compares the persisted attempt payload and complete evaluation provenance before replay.
- First full regression exposed two over-broad unique indexes and a required link on legacy due-task fixtures. The contract was narrowed to the RPC boundary: review row locking plus the private receipt guarantee a single due completion without masking existing owner/provenance FK checks or rejecting pre-materialized legacy due tasks.

## GREEN evidence

- Clean local reset applied migrations 001–014 successfully.
- Focused `due_practice_completion.sql`: 30/30 PASS.
- Full database suite: 8 files, 621/621 PASS.
- Two-session race: session A returned `created=true`; concurrent session B blocked and returned `created=false` with the same attempt, mastery-event, and next-review IDs; final attempt/event/receipt counts were `1/1/1`.
- Generated Supabase types include the new lifecycle fields, task relationship/fingerprint, and service RPC. The repository-normalized file matches fresh generator output after trimming trailing blank lines.
- `./node_modules/.bin/tsc --noEmit`: PASS.
- `git diff --check`: PASS.

## Contract notes

- The RPC is executable only by `service_role`; `anon` and `authenticated` have no execute grant.
- It accepts evaluation provenance but never performs Provider work or reads a model API key.
- Exact replay requires the same request key, response/evaluation payload, timestamp, and provenance. Conflicting replays fail.
- Mastery is limited to `tried -> reused -> owned`; failed/assisted work cannot advance it; `owned` is absorbing.
- No YouTube video bytes, prompts, provider responses, or API credentials are stored in the private receipt.

## Remaining review focus

- Review migration security-definer boundaries, ownership joins, lock ordering, exact-replay comparisons, persisted-evidence threshold query, and rollback behavior.
- Confirm the compatibility relaxation is limited to legacy task creation: `complete_due_practice` still rejects an unlinked or mismatched due task.

## Review repair 1

Repair baseline: `11d80bc`; repair brief commit: `08e4eb3`. The final repair
commit SHA accompanies this handoff in the controller result because a commit
cannot contain its own stable SHA.

### RED

The focused command was run after adding the two regression fixtures and before
changing migration 014:

```bash
./node_modules/.bin/supabase test db supabase/tests/due_practice_completion.sql
```

It failed 3 of 33 assertions for the intended reasons:

- an unlinked same-owner/same-expression/same-due legacy task raised no
  exception instead of SQLSTATE `22023`;
- that call left `completed|reused|1|1|1` rather than the expected
  `pending|tried|0|0|0` review/mastery/attempt/event/receipt state; and
- under `America/New_York`, the one-day result was 90,000 seconds instead of
  86,400 seconds across the 2026 fall DST transition. The same fixture asserts
  fixed 86,400-second days for the 1/7/30-day schedules.

### Minimal repair

- The task/review graph comparison now uses `IS DISTINCT FROM`, so a NULL
  legacy-compatible `review_task_id` cannot satisfy atomic completion.
- Scheduling now constructs `hours => interval_days * 24` rather than a
  calendar-day interval, exactly matching the frozen TypeScript millisecond
  arithmetic regardless of the PostgreSQL session TimeZone.
- Function signature, grants, tables, columns, generated API shape, Provider
  boundary, and legacy due-task creation compatibility are unchanged.

### GREEN and verification

- Clean local reset recreated the database and applied migrations 001–014.
- Focused due-completion pgTAP: 33/33 PASS.
- Full pgTAP: 8 files, 624/624 PASS.
- Fresh local Supabase type generation matched
  `src/types/database.generated.ts` exactly after repository-standard trailing
  newline normalization; the generated file was not modified.
- Project TypeScript and final diff/allowlist checks are run immediately before
  the repair commit.

Review repair changed only:

- `supabase/migrations/202608160014_due_practice_completion.sql`;
- `supabase/tests/due_practice_completion.sql`; and
- `docs/engineering/handoffs/batch-c/contract-015-due-practice-completion.md`.

No additional product or security scope was introduced. The remaining risk is
the existing frozen CONTRACT-015 review surface; Batch C Task 2 must continue
to consume this RPC rather than reproduce transaction or scheduling logic.
