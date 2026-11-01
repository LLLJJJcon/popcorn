# Group 4B2 review revision service report

Status: implementation and self-tests complete; ready for A integration and independent D acceptance. No real model call, database operation, route/SQL change, commit or push was performed by B2.

## Authorized scope and interface

Only two implementation files were added: `src/server/domain/review-revisions.ts` and `src/server/domain/review-revisions.test.ts`. This report is the approved third handoff document. A owns contracts, repository, service delegation, routes, runtime, SQL and generated types.

Export: `createReviewRevisionService(deps).revise(userId, reviewTaskId, input: ReviewRevisionInput): Promise<ReviewRevisionResponse>`. Also exports the dependency type `ReviewRevisionDependencies`.

Dependencies are exactly the frozen `repository: ReviewPracticeRepository`, `gatewayResolver: StructuredJsonGatewayResolver`, `fixtureGateway: StructuredJsonGateway` (evaluation fixture), `ci: boolean`, and `now: () => string`. No ID generator, new model endpoint or dependency was added.

## Behavior and invariants

- Parse the actual strict revision input, validate owner/review UUIDs, require the owner's completed review and exact official attempt. Request task/version/fingerprint must match both prepared task and review-state identity; the official receipt's review/task/attempt identities must match as well. Missing, foreign, cancelled, unanswered and stale contexts stop before request lookup/claim or gateway work.
- `lookupRevision` is the repository's pure signature-checked receipt lookup. Cached success returns immediately with zero new gateway lookup/model calls/claims. Pending requests return `REQUEST_IN_PROGRESS` and the original ID. Known failed IDs return their recorded failure; a new explicit retry UUID may start a new cycle. Same UUID with a changed signature is rejected by the repository's `IDEMPOTENCY_CONFLICT`.
- Resolve gateway setup before claiming a cycle, so zero-call missing-gateway failures do not persist a failed request or force a new ID. CI uses the supplied evaluation fixture with a null gateway pin.
- Modern prepared tasks require a valid current card and stored structured situation, and use accepted `evaluate-practice-v5` without changing its rubric. Already-ready legacy tasks use accepted `evaluate-practice-v4` with targetExpression/promptChinese/learnerResponse only. Malformed modern metadata never silently falls back to v4; this service does not generate any legacy task or classify missing metadata.
- One claimed evaluation uses the shared existing `completeWithFormatRetries`: initial plus at most three format attempts. Each uses existing scoring budget 1844 tokens and 30000 ms. Transport retry policy remains in the provider. Invalid optional coaching is omitted without throwing away valid scores; targetless coaching is omitted; all-five results have no coaching, including legacy compatibility.
- Revision assistance initially derives from current persisted `reviewState.examplesOpenedAt`, rather than the official first answer's historical assistance. The repository's publication response is returned unchanged. A confirmed that SQL publication rederives assistance/passed/independentUse from the latest marker under its final review lock, so another tab opening examples during evaluation can authoritatively upgrade revision assistance. B does not reject that valid change or substitute an earlier pure read for the SQL fence.
- Publication calls only `publishRevision` with scores/coaching, model/pin/version and request/context identity. The service has no official completion, promotion, mastery, scheduling or Progress write path. Official first answer/receipt and next schedule stay unchanged.
- Known failed cycles carry `{operation:{kind:"revision",requestId,state:"failed"}}`; pending cycles carry `in_progress`. After a publication or model failure, `failRevision` must return true before B labels it a known failed cycle. A false/unknown failure write triggers pure receipt recovery: ready replays, pending stays in progress, recorded failure is explicit, unresolved outcome keeps the same request identity without a false `failed` marker. This handles commit-then-response-loss safely and never exposes raw persistence/provider errors.

## Verification evidence

- TDD baseline: new service tests failed because `review-revisions.ts` was absent. Initial implementation then passed 27 behavior tests after correcting the test fixture to the repository's strict scenario shape.
- Added uncertain-publication regressions first: four tests failed against the simple failure path (lost committed result, false known failure, pending handling and raw persistence error). The receipt-recovery implementation made them pass.
- Final owned service coverage: 41 cases, including input/owner/completed/official receipt/task-version-hash boundaries, success replay and signature conflict, zero-call setup recovery, known pending/failed, new retry ID, simultaneous same-ID submissions, claim publication race, four format attempts, transport failure, optional rewrite/full-five, current examples, authoritative SQL assistance return, legacy v4 and CI fixture execution.
- Final focused command passed four suites / 63 tests:

  `pnpm exec vitest run src/server/domain/review-revisions.test.ts src/server/domain/review-practice.test.ts src/server/domain/review-practice-http.test.ts tests/contract/review-practice.test.ts`

- `pnpm exec tsc --noEmit --incremental false` exited 0. ESLint on both B2 implementation/test files exited 0. `git diff --check` exited 0.
- Full project `pnpm test` exited 0: unit 76 suites / 739 tests; contract 9 / 231; integration 30 / 562; prompt-golden 4 / 63; total 1595. Full output: `/private/tmp/group4-revisions-full-test.log`. Two final test-only cases (authoritative publisher assistance and CI fixture path) were subsequently added and passed in the focused 63-test run; no production change followed the full test run.

## Integration and remaining acceptance

A will delegate the review service's revision method to this module with the **evaluation** fixture. Repository signature verification, claims, RLS, immutable official-attempt binding, final lock fences, SQL assistance derivation and dedicated revision/receipt persistence remain A's SQL/repository responsibilities. The in-memory repository boundary tests here do not claim database RLS or transaction acceptance.

D must independently accept the integrated group and its SQL/browser gates. The separate real twenty-question generation review remains pending; B2 performed zero real model calls and adds no product-quality acceptance claim.
