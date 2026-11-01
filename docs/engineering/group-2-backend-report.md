# Group 2 backend implementation report

Task 2A, 2026-11-01. Worktree: `/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度`. No commits or pushes by this worker. Group 3/4 product work was not started.

## Product behavior and compatibility

- Published `group-2-contracts.md` before UI work: structured situation, complete roundState, persisted original/latest revision coaching, Saved card practice state, Vault redirect and typed conflicts.
- Production runtime now uses `createRoundPracticeServices` through `createPracticeServerServices`; legacy service builders remain for reading old contracts and regression harnesses, and no production route uses the old client-assistance implementation.
- Candidate identity preserves `(owner,saved item,highlightKey)` across analysis artifacts; legacy candidates retain artifact/index identity. SQL independently derives keys and serializes candidate mutations. New draft rows own independent revision numbering, future expression IDs and situations.
- New transaction paths persist default retry at first answer +24h, inherit pending retry time into a fresh unanswered round, make original submission/replay atomic with promotion or retry scheduling, and keep revisions out of promotion/scheduling. Different first answers return FIRST_ANSWER_EXISTS with the authoritative round state. Natural coaching is stored with staged answers and survives refresh/replay.
- Round requests persist receipts even when they return an existing unanswered open round. Request replay returns the original task. The database enforces one current open/retry round and one promotion per stable candidate. Scenario deduplication has its own NFKC/punctuation/whitespace/case hash; historical mastery context hashes are untouched.
- Remove is immediate; restore checks a server five-second deadline, current candidate state and newer-round/promotion fences. Repeated remove does not extend Undo. Examples markers persist before disclosure, only examples produce model_answer, and server commit derives assistance. Old stored hint values are unchanged.
- Due shared scope adds persisted examples, server assistance derivation under the review lock, replay-safe completion and authoritative public evaluation. Its existing generation/templates, mastery and 1/7/30-day schedule remain unchanged for group 4.
- New activation uses v3 structured inputs and scoring uses v5 only with complete stored metadata; old tasks keep the v4 builder. Format retry budget is initial +3 for new generation/evaluation; transport policy is unchanged. **Latest user decision overrides §8.7 and the earlier fallback approval request: no runtime generic fallback is integrated.** A generation error leaves the current round intact and permits retry. CI's deterministic fixture is test data, not a product fallback.
- Immediate material no longer fabricates pre-Vault mastery; it includes round state, structured situation and rich learning-card fields. Due material reads persisted rich card fields when available. Saved detail candidates receive unpracticed/practicing/removed/promoted state and the relevant task/expression ID.

## Database changes and validation boundary

Only additive migrations were created and applied, only to the explicitly isolated project `popcorn-phase1-groups24` (API54331/DB54332), using `--workdir /private/tmp/popcorn-phase1-test-stack --local`. No reset or mutation of the personal54321/54322 stack.

| Migration | Purpose |
| --- | --- |
| 024 | Round metadata/status/constraints, persisted coaching/assistance/entry round; actual legacy backfill; candidate promotion fence; atomic round/answer/state/remove/restore/examples RPCs |
| 025 | Server-derived direct-insert identity; candidate-before-row promotion locking; due completion wrapper deriving assistance from the locked review |
| 026 | Private round request receipts with RLS/owner FK; service-only replay lookup; server candidate-key derivation before publication lock |
| 027 | Independent scenario hash normalized identically to prompt validation; no historical mastery hash recomputation |

The effective promotion implementation is patched, retaining the original public source-deletion replay wrapper, 022's10000-character bounds and 023's confidence-free modern-card compatibility. Round fields use integer rather than the proposed smallint to avoid adding an accidental32767-round product ceiling; no business cap is enforced. New request receipts have RLS, no direct browser/service grants, and are accessed only through owner-scoped service-only definer functions.

Generated types came from the actual isolated database after027, including public/private schemas. Kept the existing six nullable mutate_saved_item_highlight argument refinements and added two Insert optional refinements for trigger-computed practice_drafts.candidate_key/scenario_fingerprint. Generated TypeScript ends with one newline.

The dedicated stack was empty of legacy drafts before024; migration-up success alone is **not** represented as backfill acceptance. The separate SQL integration owner has now executed five synthetic nonempty legacy cases and replayed the actual024 DML verbatim inside rollback transactions, preserving all eight canonical graph counts. Receipt → promoted, first answer/no receipt → retry_scheduled at original +24h, remaining legacy rows (including abandoned) → open. Actual lifecycle/concurrency/RLS checks also passed. Personal-library read-only projection evidence remains 7 promoted/1 retry/3 open, described in preflight. Independent acceptance must rerun these tests against the final checkpoint.

## Verification so far

- Contract TDD: new schemas absent/old null-mastery restriction produced6 RED failures, then6 GREEN. Candidate identity/input/scenario unit tests pass; punctuation-only scenario repeat added a new RED regression, fixed to GREEN.
- New schema SQL: failed on missing columns/RPCs before024, then12/12 GREEN after migration. Later behavioral SQL/old fixtures are owned by Task2B; source-deletion/mastery/rollback assertions are retained rather than weakened.
- New runtime/HTTP boundary tests cover no-model unanswered resume, v5 explicit meaning/intent metadata, spoofed assistance, persisted coaching replay, different-first-answer conflict, examples opened during scoring, authentication/origin/body/ID validation,201/200 replay statuses and typed promotion conflicts.
- Targeted backend/invariant run reached194 cases; the only two failures were old due-RPC mocked shapes after introduction of the server-assistance wrapper. Updated those fixtures to the new wrapper while preserving canonical timestamp/replay assertions; due-transfer25/25 GREEN.
- Full `pnpm test` first stage: **unit551/551 GREEN**. Contract's frozen error taxonomy exposed the two intentional new error codes; updated its expected enum. Remaining contract/integration/prompt-golden combined rerun: **38 files /761 tests GREEN**. Logs: `/private/tmp/group2-backend-suite.log` (first run and original taxonomy RED), `/private/tmp/group2-backend-followup-suite.log` (all remaining GREEN).
- Backend-file ESLint: exit0, no warnings (`/private/tmp/group2-backend-lint.log`). Whole-worktree TypeScript: exit0 after integration. `git diff --check`: clean at this checkpoint.
- Separate SQL integration owner evidence, logs inspected by backend owner: **14 files/824 assertions PASS** (`/private/tmp/group2-sql-fixtures-green.log`), focused lifecycle **88/88 PASS** (`/private/tmp/group2-round-lifecycle-final.log`), and two real concurrent promotion scenarios PASS (`/private/tmp/group2-concurrency-green.log`). Covered modern highlight identity across artifacts, round2 entry/24h due, failed/assisted/revised answers, Undo expiry/reactivation, marker races, request replay, canonical graph rollback/ownership and nonempty backfill. Details: `group-2-sql-fixtures-report.md`. This is integration verification, not the final independent acceptance gate.

Final integrated seed, browser suites, full verification and separate acceptance belong to the controller/designated other agents. This report does not claim those gates have passed yet. No real-model semantic quality is claimed from deterministic fixtures.
