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

## Frozen semantics

- A draft is bound by database constraints to the same owner, YouTube source, saved item, and `saved_item_analysis` candidate artifact; candidate indexes are 0–2.
- `future_user_expression_id` is preallocated and retained without creating a Vault/user-expression, canonical practice task/attempt, mastery, or review row.
- Activation and evaluation provenance is either entirely null for deterministic fixtures or exactly five-field bound to one immutable owner gateway revision, fingerprint, and model.
- Evaluated learner responses are append-only revisions. Chinese response, separate 1–5 scores, English feedback, assistance, and independence rules are enforced at persistence.
- Authenticated users may only read their own rows. Service-role writes are deliberately narrow: drafts may be selected/inserted/updated; draft attempts may only be selected/inserted.
- No API key, Vault identifier, origin, URL, header, prompt, request body, provider raw output, or log is stored in either table.

## Consumer rules

- Task 4 creates and updates only draft rows and appends draft-attempt revisions. It must not create canonical practice, Vault, mastery, or review state.
- Task 4 must resolve live activation/evaluation through the frozen structured gateway immediately before egress, then persist the exact returned gateway provenance; fixture rows use the all-null form.
- Task 5 owns one atomic promotion and must use the draft's exact `future_user_expression_id` when creating the canonical user expression and dependent evidence.
- Every service-role operation remains explicitly owner-filtered even though service role bypasses RLS.

## Remaining risk and review

- Atomic promotion and deletion ordering are intentionally not implemented by this migration; they remain Task 5 and Batch C/Delivery responsibilities.
- This candidate still requires independent read-only review from the recorded baseline before the contract can be frozen and consumed.
- No upstream implementation applies; no YouTube Digest or GPLv3 LLM Wiki code, prompts, tests, components, or assets were copied.
