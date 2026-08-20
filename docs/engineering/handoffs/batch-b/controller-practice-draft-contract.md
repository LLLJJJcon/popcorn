# Controller practice-draft contract handoff

## Scope

- Baseline: `cb20d89`
- Contract: durable pre-Vault practice activation and evaluated revision staging for Batch B Tasks 4 and 5.
- Files: migration 011, its pgTAP contract, generated database types, and the controller brief/handoff only.

## TDD evidence

- RED: before migration 011, the focused pgTAP contract failed because `practice_drafts` and `practice_draft_attempts` did not exist.
- GREEN: focused `practice_drafts.sql` passed 25/25 after the minimal schema, constraints, grants, and RLS policies were added.
- Regression gate: clean migration reset applied migrations 001–011; full pgTAP passed 512/512.
- Generated database types exactly match the local schema after normalizing the generator's final blank line.
- `tsc --noEmit`, fixed-environment webpack production build (19 generated pages), and `git diff --check` passed.

## Review-fix TDD evidence

- Review-fix baseline/candidate: `e42363a`.
- RED: the expanded focused pgTAP contract failed 12 of 46 tests against the reviewed candidate. It admitted mismatched and missing artifact candidates, allowed future-expression reuse and immutable service-role updates, capped revision 101, and exposed broader service-role update privileges.
- GREEN: after the minimal migration changes, a clean reset applied migrations 001–011 and the focused contract passed 46/46.
- Generated database types remained an exact match to the reset local schema; `tsc --noEmit` and `git diff --check` passed.
- The workspace `pnpm` shim refused the intentionally symlinked dependency directory before invoking the script, so the clean reset and focused test were run through the same checked-in Supabase CLI binary directly. No dependency installation or lockfile change was made.

## Frozen semantics

- A draft insert is bound to the same owner, YouTube source, saved item, and `saved_item_analysis` artifact. The database reads `content.candidates[candidate_index].expression`, rejects missing/non-string candidates, and requires exact equality with `target_expression`.
- `future_user_expression_id` is preallocated and retained without creating a Vault/user-expression, canonical practice task/attempt, mastery, or review row.
- `future_user_expression_id` is globally unique across owners while the three-column draft/owner/future key remains available to bind every staged attempt to its draft.
- Activation and evaluation provenance is either entirely null for deterministic fixtures or exactly five-field bound to one immutable owner gateway revision, fingerprint, and model.
- Evaluated learner responses are append-only positive-numbered revisions without an artificial upper bound. Chinese response, separate 1–5 scores, English feedback, assistance, and independence rules are enforced at persistence.
- Authenticated users may only read their own rows and cannot insert, update, or delete staged state. Service-role draft updates are column-limited to `status` and `updated_at`; all activation/source/content/identity fields are immutable. Draft attempts remain select/insert-only for service role.
- No API key, Vault identifier, origin, URL, header, prompt, request body, provider raw output, or log is stored in either table.

## Consumer rules

- Task 4 inserts complete draft rows, updates only draft lifecycle state, and appends draft-attempt revisions. It must not create canonical practice, Vault, mastery, or review state.
- Task 4 must finish activation before inserting a live draft so the exact five-field provenance is immutable at rest. Deterministic fixture inserts use the all-null form; fixture provenance is not backfilled later.
- Task 4 must resolve live activation/evaluation through the frozen structured gateway immediately before egress, then insert the exact returned gateway provenance.
- Task 5 owns one atomic promotion and must use the draft's exact `future_user_expression_id` when creating the canonical user expression and dependent evidence.
- Every service-role operation remains explicitly owner-filtered even though service role bypasses RLS.

## Remaining risk and review

- Atomic promotion and deletion ordering are intentionally not implemented by this migration; they remain Task 5 and Batch C/Delivery responsibilities.
- This candidate still requires independent read-only review from the recorded baseline before the contract can be frozen and consumed.
- No upstream implementation applies; no YouTube Digest or GPLv3 LLM Wiki code, prompts, tests, components, or assets were copied.
