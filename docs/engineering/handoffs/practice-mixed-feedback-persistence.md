# Practice mixed-language feedback persistence handoff

## Scope

- Baseline: `fe5bc00e33e1869c9be3702f997de69fdb1ccfb6`.
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/进度/.superpowers/sdd/popcorn-practice-feedback-persistence`.
- Changed one new migration, the two existing focused pgTAP files, and this handoff only.
- No Practice UI or list-selection code changed.

## Diagnosis

The `基本款` report contained two requests. The first ended at the existing 30-second Provider timeout. The second reached `complete_due_practice` and failed with `due Practice graph mismatch` because the controller's temporary demo-data update stored a microsecond `review_tasks.due_at`, while application task creation canonicalized it to milliseconds. The controller realigned all five local pending reviews; the existing `基本款` task and review now have identical due instants.

The code fix closes a distinct confirmed persistence mismatch: TypeScript accepts English feedback containing quoted Chinese, but both database attempt constraints still used ASCII-only `private.is_basic_latin_english`.

## TDD evidence

RED before the migration:

- `due_practice_completion.sql` exited 1 at `attempt_feedback_check` when `complete_due_practice` attempted to persist `The use of “太离谱了” is accurate.`.
- `practice_drafts.sql` reported the corresponding `practice_draft_attempt_feedback_check` failure, the mixed feedback row was absent, and its new 501-character boundary test showed the old database incorrectly accepted oversized feedback.

The first GREEN attempt exposed a necessary permission edge: draft inserts run as `service_role`, so the private check predicate must be executable by that role. The migration now revokes all roles first and grants only `service_role`; `anon` and `authenticated` cannot execute it.

Initial review found that checking the trimmed length allowed a value such as one English letter followed by 500 spaces. A new pgTAP case reproduced that bypass and the predicate now checks the original length separately from trimmed nonblank content.

Final GREEN:

- Due Practice pgTAP: 36/36 PASS.
- Practice draft pgTAP: 51/51 PASS.
- Existing global-count assertions were scoped to their deterministic fixture owner so the focused tests remain valid against the populated local demo database.

## Contract

- New private immutable `private.is_practice_feedback_text(text, integer)` requires non-null, trimmed nonblank content, no more than the supplied 500-character boundary, and at least one ASCII Latin letter.
- Chinese learning text and Unicode punctuation may coexist with English prose.
- Only `attempt_feedback_check` and `practice_draft_attempt_feedback_check` now consume the new predicate.
- Both constraints are installed `NOT VALID`, so they immediately protect new writes without blocking an upgrade that contains historical 501–2000-character feedback. Each constraint is validated during migration when its existing rows already satisfy the new boundary; the checked local database validates both.
- The global ASCII-only helper is unchanged.
- Score, response, assistance, independent use, owner, provenance, atomic completion, replay, mastery, and scheduling constraints are unchanged.
- Existing local data was checked before migration: 5 canonical attempts and 7 draft attempts, with maximum feedback length 238.

## Residual risk

The English requirement intentionally remains a lightweight at-least-one-ASCII-letter check, matching the accepted TypeScript Practice contract. The Provider can still independently exceed the existing 30-second timeout; this task does not change gateway transport behavior.

No browser, extension, full application, or live Provider tests were run.
