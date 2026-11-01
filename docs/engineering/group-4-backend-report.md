# Group 4 backend implementation report

Status: implementation checkpoint; independent final acceptance and the legacy-generation product decision are still pending. This report does not turn deterministic fixtures or module tests into semantic approval.

## Implemented behavior

The live due Review routes now share one owner-scoped repository and the claimed Review coordinator. Prepared GET returns before gateway lookup or generation. Modern generation uses the approved transfer-scenario-v1 contract, exactly400 completion tokens,20seconds, and at most4 format attempts in one persisted cycle. Historical prepared questions remain readable and score through v4. No legacy metadata is invented, no Analyze call is added, and there is no production generic fallback. The old four-template implementation has been removed; its old compatibility ensure method now only reads a prepared owned due task and returns typed NOT_FOUND when none exists.

Separate normalized scenario fingerprints use027's existing rule. Historical mastery context hashes,1/7/30 scheduling, mastery transitions, owned thresholds and Progress evidence algorithms are unchanged. The context RPC recovers the exact winning candidate, all its rounds including failed/removed/superseded, canonical first and due tasks, and regenerated archives. Valid canonical modern metadata takes priority over the exact linked historical card.

Preparation and replacement use short transactional owner/review/task locks, request signatures, leases and question versions. Models run outside transactions. Exact successful UUID replay is adjudicated before new-request stale-version rules. A losing regeneration waiter gets REGENERATE_USED, or ALREADY_SUBMITTED after official completion; it cannot borrow the winner's success. Cold prepare aliases can observe the successful prepared task. Known failures are cached; plain GET and background delivery never authorize a fresh model cycle. Only explicit user retry does. Unknown publication responses are recovered through read-only receipt lookup; only confirmed fail=true is reported as terminal.

Disclosure writes persist before disclosure. Reveal does not assist. Examples atomically persist reveal plus assistance, survive regeneration, and determine publication flags under the same review lock. Completed first-answer evidence and its assistance remain immutable after later examples. Revisions have separate owner-protected records, request claims and latest/coaching restore; they do not write official attempts, mastery events, canonical mastery, schedules or Progress.

Official completion claims before scoring, preventing repeated request UUIDs from opening duplicate model cycles. Publication binds the scored task/version/fingerprint and preserves the accepted underlying completion transaction. An intervening regeneration rejects old scores. Source-free replay retains the prior owner/snapshot/provenance/unique mastery-event/time/legal-transition/current-mastery-rank/schedule validations, while accepting a deleted display source. PostgreSQL offset timestamps are canonicalized only before calling the unchanged strict schedule validator. Missing provenance fields are rejected; recorded all-null fixture provenance remains supported.

The commit-time outbox schedules real owner/source Review jobs with saved_item_id=null. Jobs become visible only with the scheduling transaction. Review preparation has one durable attempt; unrelated jobs keep their existing five-attempt policy. Worker and GET share the current persisted cycle, including terminal failure. The dedicated worker only polls that cycle and finishes with an exact owner/attempt/lease fence. Transcript credentials are resolved only if a transcript handler actually needs them. Source deletion detaches the operational job FK and prevents stale publication without fabricating a source.

Retry GETs require the dedicated header and same-origin proof. Every supplied Origin, Referer and Sec-Fetch-Site is checked before accepting any proof; contradictory or malformed supplied proof fails closed. Trusted same-origin fetch metadata supports a legitimate no-referrer request.

## Applied migrations (isolated project only)

| Migration | Purpose |
| --- | --- |
|032|Scenario/version storage, learning revisions, private request receipts, owner-safe complete history projection.|
|033|Short preparation claims, model publication fences, disclosure markers.|
|034|Exact winning request replay before current-version rejection.|
|035|Separate revision persistence and version-bound official completion wrapper.|
|036|Losing regeneration waiters cannot adopt winner success.|
|037|Official completion model-cycle claims, atomic request receipt, event projection for source-free graph validation.|
|038|Scheduling outbox, one durable preparation execution, late-job observation, fenced worker finish, deletion-safe operational FK cleanup.|

All were applied only to project popcorn-phase1-groups24 on API54331/DB54332 through the guarded wrapper. Applied migrations were not edited. Latest generated types preserve the pre-existing nullable RPC refinements and trigger-generated draft insert fields; preparation nullable request IDs are reflected explicitly.

## RED → GREEN evidence

| Boundary | Evidence |
| --- | --- |
|Unknown prepare/regenerate publication|Four formal failures preserved, then safe bool/receipt recovery green: /private/tmp/group4-publication-unknown-red.log; /private/tmp/group4-publication-material-green.log.|
|All supplied retry proofs|Matching Origin plus foreign/malformed Referer produced two RED cases; fixed without adding an endpoint: /private/tmp/group4-retry-proofs-red.log; /private/tmp/group4-proof-publication-green.log.|
|Same UUID replacement replay|Domain and real SQL RED retained;034/036 actual lifecycle80PASS, B's separate report.|
|Scored snapshot race|Repository RED for v2 identity paired with v1 text; mapper now adopts the complete prepared snapshot. /private/tmp/group4-completion-snapshot-red.log; /private/tmp/group4-repository-snapshot-replay-green.log.|
|Official graph validation|Six invalid graphs RED, then rejected while legal source-free replay succeeds. /private/tmp/group4-official-graph-{red,green}.log. Missing provenance field later added as a seventh fail-closed regression: /private/tmp/group4-missing-provenance-{red,green}.log.|
|Actual PostgreSQL timestamp|Real offset-format submitted/event/next-due values failed before one-line normalization. /private/tmp/group4-postgres-time-{red,green}.log; linked100testsPASS.|
|Delayed worker|Formal RED showed a background job reopening the foreground failed cycle. Shared-cycle lookup now returns the known failure with zero gateway/claim/model work. /private/tmp/group4-late-job-{red,green}.log,42testsPASS.|
|Worker integration|Three RED cases exposed five durable attempts, missing handler registration, and unrelated transcript-key startup dependency. /private/tmp/group4-worker-wiring-{red,green}.log,86testsPASS.|
|Commit-time outbox|Real SQL initially no jobs/no private input;038 actual18assertionsPASS. /private/tmp/group4-outbox-{red,first-green}.log. Includes both directions of foreground/background failure observation, source deletion and owner/ACL/lease checks.|
|No old generic templates|Behavioral cold compatibility test originally generated a lunch fallback; now typed unavailable and no insert. Existing prepared text/fingerprint unchanged. /private/tmp/group4-remove-templates-{red,green}.log,75linkedtestsPASS.|

B's separately owned modules report completion48, revisions41, worker30 and generation92 focused tests. Those are implementer self-tests, not D acceptance. Parent's actual browser53 passed the complete network-unknown same-ID regeneration, v2 refresh, reveal-only independent official completion, completed restore, post-official examples, assisted revision, immutable official graph, latest-feedback reload, original receipt replay and unchanged Progress/Saved-volume flow after the timestamp fix. Evidence: /private/tmp/group4-returning-after-clock-fix.log.

## Checkpoint verification and remaining work

Final whole application test run:1702PASS (unit829,contract232,integration578,prompts63), /private/tmp/group4-a-final-full-test.log. Controller independently reproduced1702 with typecheck0 and lint0errors: /private/tmp/group4-controller-backend-{test,lint}.log. The count reflects removal of obsolete template-generation cases and addition of strict provenance/read-only compatibility regressions, not skipped tests.

Latest owner lint and whole TypeScript checks are clean: /private/tmp/group4-a-final-lint.log and /private/tmp/group4-a-final-types.log. Generated types end with one newline.

Full SQL at038 first run exposed two outdated fixture assumptions: an automatic second worker cycle after known failure, and the owned knowledge_jobs count before the new outbox. B adapted only its precise test ownership, preserving the prior80 lifecycle assertions and all owner/lease negatives. Lifecycle now89PASS, RLS345PASS, and the prior two promotion races stillPASS with scoped operational cleanup and zero remaining fixture owners. Logs: /private/tmp/group4-038-{lifecycle,rls,promotion}-green.log. Final full SQL:22files/1094assertionsPASS, /private/tmp/group4-all-sql-final.log.

The new independent-connection harness passed four real row-lock races: worker/GET, same-request official scoring, regeneration winning while completion waits, and completion winning while regeneration waits. Each verifies the second connection's actual Lock wait before the first commits. It then deletes the completed fixture's source and calls the actual repository plus completion coordinator: same-request receipt replay has0gatewaylookups/0modelcalls, and attempts/mastery-events/canonical-expressions/reviews remain deeply identical. All synthetic597 owners are removed. Evidence: /private/tmp/group4-real-concurrency-final.log. Harnesses: tests/contract/review-practice-concurrency.py and tests/contract/review-official-replay.ts; helper typecheck/lint0. Every cleanup checks the two exact fixture emails before touching their data; credentials pass to PostgreSQL only through private process environment, not arguments. Invocation: python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py python3 tests/contract/review-practice-concurrency.py.

Backend implementation self-tests are complete. Remaining external gates are independent D review/build/browser acceptance and the explicitly pending reviewed legacy-generation policy. The implementation does not claim approval for new legacy prompt content or real-model semantic quality.
