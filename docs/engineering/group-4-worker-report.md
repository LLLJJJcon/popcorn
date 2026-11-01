# Group 4B transfer-preparation worker report

Status: isolated handler implementation and self-tests complete; ready for A registry/store integration and independent D acceptance.

## Scope and actual interface

Only `src/server/jobs/handlers/prepare-transfer-task.ts`, its `.test.ts` and this approved report were added. B did not modify job registry, lease policy, SQL, repository, runtime, routes, Saved/artifact logic or existing handlers. No database, real model, commit or push was used for this task.

Export: `createPrepareTransferTaskHandler({store,service,now?,wait?}): JobHandler`. `store` is actual `DurableJobStore`; `service` is the actual review coordinator's `prepareInBackground` subset. Optional injected clock/wait make lease/poll tests deterministic. Default clock reads fresh UTC time; default wait uses the standard timer.

The handler reads only `store.readPrivateInput` and writes only the optional fenced `store.finishReviewPreparationJob(expectedOwner, originalLeasedJob, outcome, currentTime)`. Input is exactly `{kind:"prepare_transfer_task",reviewTaskId:UUID}`. It does not read source/video/subtitle/Analyze evidence or use any client-supplied owner/model configuration.

## Behavior

- Claimed owner, job type and leased state are checked before input reads or writes. Invalid type/owner/state fails without store/model activity. Already expired/invalid lease returns deferred without input or preparation work.
- Missing fenced-finish capability returns deferred before preparation, avoiding generation without an owned completion fence. Unknown input-reader errors also defer. Invalid decoded input is a fenced `terminal_failed/VALIDATION_FAILED` outcome with no fabricated review UUID and no service call.
- Every service call uses the claimed owner, private review UUID, and the **same original** `{jobId,attemptCount,leaseExpiresAt}`. A pending response's request ID never replaces the job ID or starts another generation cycle.
- Ready results must belong to that review and carry a real UUID task ID; success is reported only after fenced finish returns true. False/stale or uncertain finish returns deferred. Fresh time is checked again after preparation so a result cannot finish under an expired lease.
- `GATEWAY_REQUIRED`/`LEGACY_METADATA_REQUIRED`, or a confirmed `prepare` failure for this exact job request ID, may terminally finish only the job. Unconfirmed provider/persistence errors, foreign failure IDs and unavailable context defer without declaring a terminal cycle outcome. Raw error messages/details are never persisted or logged.
- `preparing` and `REQUEST_IN_PROGRESS` poll the same service identity, at most 300 calls with one-second waits, bounded further by remaining lease time (including a shorter final fractional wait). Expiry or the engineering polling bound defers without a fake failure. The handler neither generates retry UUIDs nor invokes generic five-attempt failure/backoff paths.
- Other job retry limits and the database's one-durable-execution policy for `prepare_transfer_task` remain A's registry/lease/SQL responsibility. The handler itself performs no direct model call or format-retry loop; it consumes the coordinator's existing single persisted cycle.

## Verification

Test-first RED: the new test suite failed because the handler module was absent. Implementing the frozen behavior yielded 29 passing cases; the remaining-fractional-lease assertion brought final coverage to **30 tests**.

Coverage includes strict input/owner/type/state negatives, zero-service invalid input, missing finish capability, ready and confirmed failure outcomes, unconfirmed outcome deferral, pending/in-progress same-fence polling, engineering bound, lease expiry before/during work, fractional final wait, final-write rejection/uncertainty, foreign returned review, and no source/Saved/artifact operations.

The coalescing test uses the **actual `createReviewPracticeService`** with its deterministic transfer fixture: a GET owns a blocked model cycle, the worker joins through its own job-ID alias, then pure polling observes the published ready task. Exactly one fixture model call occurs. A subsequent ready observation plus rejected stale job finish performs no extra model cycle or claim. This is stronger than merely stubbing the preparation method; it remains fixture/unit boundary evidence, not a live worker/database concurrency claim.

- Owned worker test: **30/30**.
- Worker + actual review coordinator + existing lease tests: **3 suites / 84 tests** passed.
- Actual job-processor integration suite plus worker: **2 suites / 70 tests** passed, using `tests/integration/jobs/process-jobs.test.ts`.
- Whole-project `pnpm exec tsc --noEmit --incremental false`: exit 0.
- ESLint on both new files: exit 0 after removing one unused test-only type import. `git diff --check`: exit 0.
- Full `pnpm test`: exit 0; unit 78 suites / 828 tests, contract 9 / 232, integration 31 / 576, prompt-golden 4 / 63; **1699 total**. Full output: `/private/tmp/group4-worker-full-test.log`.

## Handoff

A owns registration, actual `finishReviewPreparationJob` storage, the additive job/outbox SQL, lease/attempt policy and real runtime wiring. SQL owner/lease/version fences and actual worker/GET races must still pass their independent integration acceptance; this report does not replace them or the separate real twenty-question human review. D remains the independent final acceptance owner.
