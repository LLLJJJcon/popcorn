# Group 4 frozen contracts

2026-11-01, A4; branch codex/phase1-group4-confirmed. Independent group3 engineering PASS precedes this isolated implementation. `group-4-preflight.md` records all four7.8 checks. Missing legacy metadata remains a product decision in `group-4-legacy-decision.md`; its unapproved prompt must not be implemented. Modern contracts proceed independently. No production generic fallback exists.

## Actual importable client contracts

A owns `src/contracts/review-practice.ts`. Missing-module RED→GREEN3 tests established the initial exports before C began wiring. C's `features/practice/review-schema.ts` reexports the shared schemas/types; it does not create a second DTO definition.

```ts
DueScenarioIdentitySchema; type DueScenarioIdentity = {
  taskId:string; scenarioVersion:number; scenarioFingerprint:string;
};
ReviewMutationInputSchema; type ReviewMutationInput = DueScenarioIdentity & {requestId:string};
ReviewCompletionInputSchema; type ReviewCompletionInput = ReviewMutationInput & {responseChinese:string};
ReviewRevisionInputSchema; type ReviewRevisionInput = ReviewCompletionInput & {attemptId:string};
```

All IDs are UUIDs, version is a positive integer, fingerprints lowercase SHA256, response is nonempty Chinese up to10000. Inputs are strict: no client assistance, mastery, schedule or arbitrary metadata. attemptId on revision is the **official first answer's attempt ID**, never the latest revision ID. Unlimited revisions may keep that same official base.

```ts
DueCompletionReceiptSchema; // original result IDs/states/schedule/created/transition, unchanged
DueReviewAnswerSchema; type DueReviewAnswer = {
  attemptId:string; responseChinese:string; evaluation:EvaluationResult;
  coaching:PracticeCoaching|null; naturalVersion:string|null; submittedAt:string;
  result:DueCompletionReceipt;
};
ReviewRevisionSchema; type ReviewRevision = {
  id:string; requestId:string; attemptId:string; taskId:string;
  scenarioVersion:number; scenarioFingerprint:string; responseChinese:string;
  evaluation:EvaluationResult; coaching:PracticeCoaching|null;
  naturalVersion:string|null; createdAt:string;
};
DueReviewStateSchema; type DueReviewState = {
  reviewTaskId:string; identity:DueScenarioIdentity; regenerated:boolean; canRegenerate:boolean;
  expressionRevealedAt:string|null; examplesOpenedAt:string|null;
  firstAnswer:DueReviewAnswer|null; latestRevision:ReviewRevision|null;
};
```

The official result retains reviewTaskId,practiceTaskId,attemptId,masteryEventId,nextReviewTaskId,priorState,newState,nextDueAt,intervalDays,created,transition. A changed state requires the matching transition; maintenance requires null. `DueCompletionSchema` keeps those existing flat fields plus evaluation/coaching, with **optional reviewState for compatibility of group3 callbacks/readers**; new server completions always provide it. First/latest/coaching and the original receipt restore on GET without rescoring. A later examples opening does not rewrite the official first answer's assistance or result.

```ts
DueTransferSchema; type DueTransfer = {
  status:'ready'; id:string; reviewTaskId:string; targetExpression:string;
  promptChinese:string; instructionsEnglish:string; goalEnglish:string;
  material:PracticeMaterialView; scenarioVersion:number; scenarioFingerprint:string;
  situationEn:string|null; interlocutor:string|null; taskEn:string;
  targetFunction:FunctionCategory|null; targetSetting:UsageSetting|null;
  transferType:'near'|'far'|null; metadataMode:'modern'|'legacy';
  scenarioSource:'model'|'legacy'; canRegenerate:boolean; expressionRevealed:boolean;
  reviewState:DueReviewState;
};
DuePreparationPendingSchema; type DuePreparationPending = {
  status:'preparing';reviewTaskId:string;requestId:string;retryAfterMs:number;
};
DueReviewGetResponseSchema; // discriminated union of ready and preparing
ReviewMarkerResponseSchema; // {reviewState:DueReviewState}
ReviewRevisionResponseSchema; // {revision:ReviewRevision,reviewState:DueReviewState}
ReviewOperationFailureDetailsSchema; // below
```

Modern ready material carries existing task.situation and learningCard. Top id equals identity.taskId and material.task.id; versions/hash and review IDs agree. A ready pre-group4 task retains old text/instruction/goal, has independently derived scenario hash/version1, nullable unavailable structured fields and metadataMode/scenarioSource legacy. This is a **read compatibility representation**, not permission to generate new legacy questions or infer labels. transferType null means historical direction unknown; actual new model inputs are only near/far. None of these DTOs puts learner answer/coaching in a model's situation-generation input.

## HTTP and exact retry lifecycle

All envelopes use existing ApiSuccess/ApiFailure; authenticated owner only, no-store. Mutation endpoints additionally apply the existing Origin/JSON/bounded-body safeguards. GET params are awaited and validated.

| Endpoint | Input | Success data |
| --- | --- | --- |
| GET `/api/v1/practice/due/[reviewTaskId]` | optional single `retryRequestId=UUID`; no other query |200 DueTransfer or202 DuePreparationPending |
| POST same review path | ReviewCompletionInput | DueCompletion |
| POST `.../regenerate` | ReviewMutationInput | DueTransfer |
| POST `.../reveal-expression` | ReviewMutationInput | ReviewMarkerResponse |
| POST `.../examples-opened` | ReviewMutationInput | ReviewMarkerResponse |
| POST `.../revisions` | ReviewRevisionInput | ReviewRevisionResponse |

Ready GET returns before gateway lookup/claim/model work, including when its gateway is disabled. A cold first GET creates/joins one persisted preparation cycle; polling GET without a new ID reads that cycle, including its known failure. Explicit user Try again after a **known terminal domain/provider failure** creates one fresh retryRequestId. Network uncertainty retries the same ID. Passing a known ID reads/replays that operation; it cannot open another model cycle. Concurrent IDs join/alias an active cycle, so polling a previously joined ID cannot start a new cycle after the active one fails.

Only cold preparation uses202. C polls after retryAfterMs (normally1000), preserving the same ID and one UI flight; after8s shows the exact `Preparing a new situation…`.202 is not a failed generation and never authorizes a new ID/model cycle.

Every GET containing retryRequestId additionally requires `X-Popcorn-Review-Retry: 1`. An Origin, if present, must exactly match the configured origin (foreign and literal null rejected). Sec-Fetch-Site, if present, must be same-origin. Without Origin, accept a same-origin Referer or browser Sec-Fetch-Site=same-origin with the custom header, supporting no-referrer users; all missing proof is rejected before the service. A foreign/malformed supplied Referer is rejected. A URL token/navigation/image alone cannot authorize a fresh costly retry; ordinary first GET remains unchanged. Tests/CLI use an explicit same-origin Origin. C's id-bearing polling/retry helper adds the custom header.

Missing gateway/other zero-model prerequisites fail before a new persistent generation claim. Setup then plain GET can therefore prepare its first question; it cannot be trapped replaying a cached configuration failure. Already persisted real model failures replay on plain reload with zero model calls until an explicit fresh retry ID. Read-only operation lookup precedes gateway resolution and new claim creation.

New model operation failures include `details.operation={kind:'prepare'|'regenerate'|'complete'|'revision',requestId,state:'failed'|'in_progress'}`. Known provider/constraint exhaustion returns state failed. In-progress duplication returns409 REQUEST_IN_PROGRESS/state in_progress; retain the ID and retry the **same POST** after1s for regeneration/revision/completion. operation is optional in the shared details schema so a pre-model scenario/used/submitted conflict can carry only its authoritative current question. Missing operation on an unknown network/provider response is not proof of terminal failure and must not trigger a fresh ID automatically. GET during regeneration still returns the old prepared question, so it is not a regeneration-completion poll. No automatic durable retry secretly reopens four more model attempts.

Conflict codes: SCENARIO_CHANGED409 for stale task/version/hash; REGENERATE_USED409 for a different second successful-regeneration request; ALREADY_SUBMITTED409 for regeneration after official submission; IDEMPOTENCY_CONFLICT409 for reused request ID with changed input; LEGACY_METADATA_REQUIRED409 remains the conservative missing-metadata error pending product decision. If the owned current review is readable, SCENARIO_CHANGED/REGENERATE_USED/ALREADY_SUBMITTED details include complete `current:DueTransfer`; otherwise foreign/cancelled/unavailable returns the existing404 FORBIDDEN without information leakage. C refreshes a still-current question in place rather than treating scenario change as a missing queue item.

Same request ID after successful regeneration replays success; a new request ID gets REGENERATE_USED. Concurrent different regen requests share/wait the short claim; after the winner publishes, only that request succeeds and the other receives REGENERATE_USED. If a wait cannot finish yet it returns REQUEST_IN_PROGRESS, with no second model execution. Failure releases the claim but consumes no allowance; original text/hash/version/markers remain unchanged. A deliberate new user retry after known failure may use a fresh request ID; an uncertain network retry may not.

## Pure generation handshake — B owns these files

`domain/transfer-target.ts` exports TransferDirection='near'|'far', TransferTargetInput and:

```ts
selectTransferTarget({masteryState:MasteryState,
 functionCategories:readonly FunctionCategory[],usageSettings:readonly UsageSetting[],
 lastTransferType?:TransferDirection|null}): {
 transferType:TransferDirection;targetFunction:TargetFunction;targetSetting:TargetSetting;
}
```

Reject missing/invalid intention instead of manufacturing other for legacy. Valid modern []settings→casual_chat is explicitly required by4.8 (actual LearningCardFieldsSchema has max3, no min1); no card label is manufactured. Near uses primary intention/first setting; far uses secondary intention/second setting if present, otherwise primary/first while prompt varies topic/relationship. tried near, reused far, owned opposite last actual direction; no history near. Regeneration keeps that same review direction rather than toggling it.

`ai/prompts/transfer-scenario.v1.ts` exports TRANSFER_SCENARIO_PROMPT_VERSION, TRANSFER_SCENARIO_TASK_INSTRUCTION, TRANSFER_SCENARIO_MAX_TOKENS=400, TRANSFER_SCENARIO_TIMEOUT_MS=20000, TransferScenarioOutputSchema/Output, TransferScenarioInput, buildTransferScenarioPrompt, normalizeTransferScenarioWire, createTransferScenarioWireNormalizer, validateTransferScenarioOutput, createTransferScenarioFixtureGateway. Input is exactly8.6 card{expression,meaningHere,useItWhen,toneAndWho},targetFunction,targetSetting,transferType,previousSituations. Context normalizer takes{targetExpression,previousSituations}. Strict four output fields; check target leakage in all four, plus normalized scenario dedup. Fixture is test-only. No original source sentence or examples. Existing transport retries stay; one completeWithFormatRetries cycle permits initial+3 format attempts. A's shared budget adds transferScenario:400 directly without changing activation615/evaluation1844 or applying headroom again.

## Server/domain and publication design — A ownership

New `review-practice-runtime.ts` constructs owned repositories/gateway/service without UI imports. New `domain/review-practice.ts` exports createReviewPracticeService with methods `ensure(userId,reviewTaskId,{retryRequestId?})`, `regenerate(userId,reviewTaskId,ReviewMutationInput)`, `reveal(...)`, `examples(...)`, `revise(...,ReviewRevisionInput)`. Completion stays createDuePracticeCompletionService but consumes ReviewCompletionInput and exact server-loaded scenario snapshot; both HTTP and worker use the same preparation coordinator. No read of a prepared task invokes a model.

New repository/SQL functions provide short owner/expression/review claims, persisted operation idempotency and fenced publication. A claim carries owner,review ID,operation kind/token,expected scenario version,pending review state and lease expiry; a background caller also carries job ID/attempt/lease fence. No database row lock survives a model call. Models run after claim commit. Publishing takes short owned locks, rechecks the exact active claim/lease, still-pending review, expected version, owner and all-history duplicate hash. Stale worker/GET/regen writes fail or return the winner; they never overwrite a regenerated/submitted scenario.

Storage is additive migrations032 onward: practice_tasks gets structured metadata, actual near/far, provenance, independent scenario hash/version and regeneration state; an immutable owner-isolated review scenario history records every replaced version. Review-level reveal/examples markers are authoritative across regeneration (examples_opened_at already exists from group2). Official first coaching is persisted atomically with completion; separate review_revisions stores request/official-attempt/task/version/hash/evaluation/coaching/provenance and only learning revisions. Private operation/claim receipts are server-only. No old ready task text or mastery hash is rewritten.

Full generation history resolves winning promotion receipt→candidate key and reads **all** matching drafts, including failed/superseded/removed, all canonical first/due tasks and all archived regenerated versions for the owned expression. Scenario dedup uses027's normalized Chinese-only hash, rechecked at publish; the existing length-prefixed mastery context hash and all historical values remain unchanged.

Preparation job/outbox is inserted in the same scheduling transaction and becomes visible only after commit. Initial promotion and official due completion both enqueue the next owned pending review idempotently. Reuse only its real owned source FK, saved_item_id null allowed; never fabricate a source or mutate Saved status/old analysis artifacts. Deleted-source behavior stays the accepted unavailable boundary. Worker/GET claims coalesce. Prepare jobs execute at most **one durable model cycle** (up to4 format attempts) before terminal model failure; existing five-attempt behavior for unrelated jobs stays unchanged. A crashed/expired prepare execution is fenced, not automatically multiplied into5×4 model calls; explicit user retry starts a new operation. Existing job leases can still carry owner and attempt fencing.

Completion reads and scores an immutable snapshot containing task/version/scenario fingerprint. Its SQL wrapper rechecks that snapshot under the review/task lock **before** invoking the accepted atomic completion path; a regeneration that wins during scoring causes SCENARIO_CHANGED, never writes old scores onto a new task. If completion wins first, later regeneration gets ALREADY_SUBMITTED. The wrapper derives assistance from current server markers and replays completed assistance from the official receipt; reveal alone never assists.1/7/30, owned/context/date thresholds and Progress/Vault remain unchanged.

Revision request claims prevent duplicate network requests from rescoring/creating extra rows. They require this owner's completed official attempt, exact question snapshot and matching request signature. Revision publication writes only the separate learning revision and request receipt; official attempt/mastery/schedule/evidence are untouched. Latest revision is deterministic created_at/id order. Newer examples cannot change the official first answer or receipt replay.

## Ownership and acceptance boundaries

| Owner | Files/responsibility |
| --- | --- |
| A backend | All shared contracts including review-practice/api, output-budgets/learning-config, server runtimes/domain/repositories/jobs/process/lease/internal process route, complete-due/material/promotion/record wiring, public API routes, new SQL/tests/types and backend docs/tests. Sole server exception: B's new pure transfer-target.ts. No Review UI/client/shared material component edits. |
| B generation | transfer-scenario.v1.ts/tests, new pure transfer-target.ts/tests, transfer golden sets/test-only fixture/trial tool and review-artifact tooling. No shared budget/server integration/SQL/client edits. |
| C Review UI | ReviewPractice/DuePractice, shared material/evaluation/diff/UI/client API, Review schema reexport, relevant pages/session wiring and UI tests. Consume A's schemas; no server/SQL/contract edits. Preserve group3 onUnavailable and origin/sequence guards; GET restore and revisions do not call onCompleted. |
| Controller | Seed/E2E/legacy product question/content review coordination/checkpoints/release. Separate D acceptance after A/B/C self-tests. |

Meaningful tests must cover ready0calls; exact400/20s/four immediate attempts and no durable expansion; full failed-round/replaced-question history; owned alternation; owner/lease/version/pending fences; worker/GET/regen/complete two-connection races; one successful regen and failed regen retention; reveal/examples independence and immutable receipt replay; revision request replay/RLS and no official graph mutation; completed first/latest/coaching restore and all prior group3 origin/session invariants. Legacy decision and real20-question human semantic review remain explicit gates, not fixture claims.
