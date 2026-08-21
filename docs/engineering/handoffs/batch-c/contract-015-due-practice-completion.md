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
