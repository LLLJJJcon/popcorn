# Group 4B official-completion coordinator report

Status: new coordinator implementation and self-tests complete; ready for A wiring and separate D acceptance.

## Scope and frozen ports

B added only `src/server/domain/review-completion.ts`, `src/server/domain/review-completion.test.ts` and this approved report. B did not modify `complete-due-practice.ts`, repositories, contracts, SQL, runtimes, routes, UI, E2E or seed files. No real model, database operation, commit or push was performed for this task.

Export: `createReviewCompletionService(deps).complete(userId, reviewTaskId, input: ReviewCompletionInput): Promise<OfficialReviewCompletion>`, plus `ReviewCompletionDependencies`.

Dependencies match A's actual frozen interface: `repository: ReviewPracticeRepository`, `gatewayResolver: StructuredJsonGatewayResolver`, `fixtureGateway: StructuredJsonGateway` (evaluation fixture), `ci: boolean`, `now: () => string`.

The service consumes only A's published `lookupCompletion`, source-free `completionState`, `read`, `resolveActiveGatewayPin`, `claimCompletion`, `publishCompletion` and `failCompletion` methods. A owns their real SQL/adapter implementation. No alternate repository port or completion transaction was invented.

## Behavior

- Strict UUID/input validation precedes repository work. Signature-checked lookup then returns cached success, pending or known failure before material/source reads, gateway resolution or a new claim. Reusing an ID with changed input preserves `IDEMPOTENCY_CONFLICT` from that lookup.
- Source-free official state is checked before pending material reads. Matching task/version/hash and the original response return the immutable first receipt with `created:false`, original evaluation/coaching, and full current first/latest review state. No material or source lookup is required. Changed response returns `REVISION_CONFLICT`; stale identity or foreign review cannot use that receipt. Later examples/revisions remain visible in state without rewriting the original answer's assistance, result or schedule.
- Only a currently pending owned review may score. The prepared task, material task, expression, prompt/instruction/goal and structured situation must describe the same immutable scenario identity. Future, unavailable, foreign, cancelled, completed-without-recoverable-receipt or stale contexts stop before gateway/claim/model work.
- Modern tasks require valid modern card and stored situation, and reuse accepted v5 builder/normalizer/parser. Already-ready legacy tasks reuse accepted v4 without inventing modern metadata. Missing modern fields never silently downgrade. No rubric, passing threshold or mastery/schedule function was copied or changed.
- Missing/unavailable gateway prerequisites precede a persistent claim, so setup can reuse the same unclaimed ID. Once claimed, same-ID pending duplicates cannot start another scoring call; a claim-time ready/pending race also avoids scoring.
- Each claimed cycle uses shared `completeWithFormatRetries` (initial plus three format attempts), unchanged scoring budget 1844 and timeout 30000 ms. Existing provider transport retry policy is untouched. Terminal format exhaustion is persisted; replay of that ID does not open a new cycle. Explicit fresh retry ID may score again.
- Original `submittedAt` is captured once in canonical UTC before scoring, preserving the original submission-based schedule convention. Claim/publication/failure use separately read current clocks for lease fencing; publication does not pass the old submission time as its current lease clock.
- Evaluation decisions come from the existing accepted parser/derive path, with server examples markers as assistance. Reveal alone does not assist. Invalid or targetless optional coaching is discarded; all-five coaching is null for v5 and legacy v4.
- Publication delegates scores/coaching/provenance/submission time and exact request/snapshot identity to A's official atomic SQL path. The returned authoritative receipt/evaluation/state are accepted unchanged, including a valid late-example assistance upgrade. The coordinator computes no mastery transition, interval, owned threshold or next due date.
- A publisher's `SCENARIO_CHANGED`/`ALREADY_SUBMITTED` conflicts are preserved rather than rescoring or submitting the old answer to a new question. The real regeneration/completion lock race remains A/D's SQL integration gate.
- On uncertain publication, lookup runs **before** any failure write. A committed result replays without writing failure. Only a confirmed failed receipt or `failCompletion=true` labels a cycle failed. An unconfirmed failure write rechecks ready/pending/failed; unresolved outcomes retain the same ID and do not expose private error payloads or falsely authorize a new cycle.

All actual successful completion responses include required `reviewState` with first/latest data, supplied by A's `OfficialReviewCompletion` port. This includes source-free restoration; new official writes remain solely in the accepted atomic SQL transaction.

## Tests and evidence

- Test-first baseline failed because the new completion module was absent. The first implementation ran 43 cases: 42 passed and one test incorrectly expected a generic internal error despite an authoritative pending recovery state; the expectation was corrected to the frozen `REQUEST_IN_PROGRESS` same-ID protocol. A separate case now explicitly covers both recovery reads being unknown, retaining the original ID without a terminal failure marker.
- Final owned coverage: **48 tests**, including true same-ID overlapping service calls with a blocked fixture evaluation, pending/cached/failed zero-extra-scoring behavior, request signature conflicts, source-free first/latest restore, immutable late-example first result, stale/foreign/unavailable context, claimed publication races, four format attempts, terminal replay/fresh explicit retry, transport failure, submission versus publication clock, modern/legacy scoring, coaching handling, late-example publisher authority, commit-then-response-loss, unconfirmed failure recovery and CI fixture-only mode.
- Focused regression command passed **4 suites / 132 tests**:

  `pnpm exec vitest run src/server/domain/review-completion.test.ts src/server/domain/review-revisions.test.ts src/server/domain/complete-due-practice.test.ts tests/contract/review-practice.test.ts`

- Whole-project `pnpm exec tsc --noEmit --incremental false` exited 0. ESLint on the two new B files exited 0. `git diff --check` exited 0.
- Full project `pnpm test` exited 0: unit 77 suites / 798 tests; contract 9 / 231; integration 31 / 570; prompt-golden 4 / 63; **1662 total**. Log: `/private/tmp/group4-completion-full-test.log`.

The initial whole-project typecheck briefly reported two unrelated in-progress seed type imports; the controller fixed them, and the final whole-project typecheck passed. B did not edit those files.

## Handoff and limits

A will wire this coordinator into the existing completion endpoint/runtime and implement the frozen ports through its actual repository and SQL. Source-free recovery here is demonstrated against the dedicated source-free port while the material read is unavailable; A/D must verify the real deletion/receipt adapter and database graph. Unit publisher doubles demonstrate coordinator behavior at the lock-fence boundary, not database transaction acceptance.

D remains the independent final reviewer and acceptance owner. No real-model or twenty-question human-quality gate is claimed by this report.
