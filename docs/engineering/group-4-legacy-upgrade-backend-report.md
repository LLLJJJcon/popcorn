# Legacy learning-card upgrade — Task1 backend report

2026-11-02, Asia/Shanghai. Backend implementation/self-verification complete on controller checkpoint12569275ad41de7dada90ab09282a717d54f66a4. Independent D acceptance and the controller's actual-owner deployment/application remain separate gates. No personal database write, real model request, original-checkout edit or existing-service change was performed by A.

## Scope and interfaces

The frozen server contract is src/server/contracts/legacy-learning-card-upgrade.ts. A supplies src/server/repositories/legacy-learning-card-upgrade-repository.ts and src/server/legacy-learning-card-upgrade-runtime.ts. The runtime delegates directly to B's actual createLegacyLearningCardUpgradeService and returns plan/upgrade.

createLegacyLearningCardUpgradeRuntime({ci=false}:{ci?:boolean}={}) defaults to the actual owner gateway even when global CI=true. Only an explicit test option enables the deterministic fixture. It requires the configured Supabase URL/service key, never registers a worker, never runs from Review, and has no hidden Analyze or preparation side effect. The CLI does not expose a fixture switch.

Planning and source reads use queries bounded to200, with no total-run cap. Repository context loads run with concurrency4, and source pages beyond200 are retained. Hashes are opaque PostgreSQL JSONB hashes passed through the exact request; no JS JSON serialization is used to reconstruct before/evidence/request hashes.

## Storage and data preservation

039 creates only a new service-only private operation/receipt table and owner-scoped functions. The operation binds workflow learning-card-upgrade-v1, owner/sense, UUID/signature, expected canonical/evidence hashes, source/card references, claim token/lease, actual model/prompt/pin provenance, complete normalized result/outcome and times. It is separate from practice and preparation operations. Direct private-table access is revoked even from service_role; public RPC execution is restricted to service_role, and the private table has RLS.

Exact existing-card recovery uses the owned winning promotion receipt/candidate key, artifact/index and literal canonical expression. It never joins senses by spelling or invents an l-key→h-key mapping. An existing complete canonical modern card is a no-op. Any partial/edited modern field is protected. The all-empty predicate requires the actual null/empty-array legacy state.

Source generation uses the retained owned canonical occurrence/snapshot/ordered subtitle rows. It exposes actual TARGET membership and bounded3-before/2-after context; actual excerpt, ordered contiguous target IDs, span uniqueness and time boundaries are checked. Deleted or unprovable sources are unavailable, never reconstructed or fetched again.

Only a complete expression card can update the nine existing modern field columns and normal canonical updated_at. Original six compatibility fields, old questions/context hashes, official answers/evaluations, mastery events, canonical mastery, review dates/status, Saved/highlights/artifacts/source data, jobs and failed preparation cycles are unchanged. Complete not_expression results and their reasons are kept in the private receipt as needs_review; canonical membership and Review exclusion behavior do not change.

A claim is committed before model work, with a5-minute fence. No transaction contains a model request. Same UUID/signature replays the authoritative outcome, changed signatures conflict, and a second command cannot become another active model claimant. Unknown publication first reads the exact receipt; failure writes return their actual conditional boolean. No fresh UUID or model retry cycle is minted automatically.

## Additive repairs established by real tests

Applied migrations039–044 were applied only to isolated project popcorn-phase1-groups24, API54331/DB54332. Applied migration bytes were preserved.043 initially failed at statement0 because a local identifier was reserved; that unapplied draft was corrected before its successful application.

| Migration | Result |
| --- | --- |
|039|Private receipts, paged contexts, exact reuse/source proof, claims, metadata-only publication and conditional failure.|
|040–041|Repair publication-local/result-column ambiguity; preserve source-free replay; acquire the source before canonical locking to remove a real deletion/publication deadlock.|
|042|Use existing015 private.lock_active_user_model_gateway_config during publication, serializing against consent revocation and verifying the actual model/pin.|
|043|Lock original snapshot/occurrence/target+context rows and exact linked save/artifact/receipt before re-reading evidence.|
|044|Use FK-conflicting parent locks to fence phantom INSERTs: generation source and snapshot UPDATE locks; existing-card Save UPDATE lock. Existing-card source SHARE protects actual source edits/deletion while allowing the established artifact publication FK order. Locks are limited to the selected owned source/evidence rows, never whole tables.|

The parent-lock distinction is intentional. A SHARE lock prevents ordinary updates to an existing row but is compatible with the KEY SHARE taken by a child INSERT. The actual new-neighbor INSERT regression proved that distinction before044. After waiting, publication obtains a new statement snapshot and recomputes the complete selected proof.

## RED → GREEN evidence

- Contract missing-module RED →7GREEN; NOT_EXPRESSION without a complete retained card has its own RED.
- Repository missing-module RED →5GREEN, including deleted nullable source projection, cross-owner refusal, source-free exact receipt replay,201 source occurrences via200-row queries, and bounded concurrency4.
- Actual SQL missing context RPC RED: /private/tmp/legacy-upgrade-sql-red.log.
- Actual full publication exposed the local/result column ambiguity; repaired additively, with the unchanged negative checks. Final focused SQL45PASS: /private/tmp/legacy-upgrade-publish-expanded.log.
- Source-deletion contention produced a real PostgreSQL deadlock before the source-first repair: /private/tmp/legacy-upgrade-source-race-red.log.
- Consent revocation holding the configuration row showed that a plain stable SELECT did not wait: /private/tmp/legacy-upgrade-pin-race-red.log.
- An existing subtitle editor holding its row similarly bypassed the prior proof read: /private/tmp/legacy-upgrade-edit-race-red.log.
- A neighbor INSERT holding only its real snapshot FK KEY SHARE bypassed SHARE locking: /private/tmp/legacy-upgrade-phantom-race-red.log.
- Every confirmed production defect above is covered by the final unchanged-behavior real-race harness. No auth relaxation, skipped test or altered learning threshold was used to make it pass.

## Final real concurrency and runtime evidence

tests/contract/legacy-learning-card-upgrade-concurrency.py uses separate PostgreSQL connections and observes the waiting connection's actual Lock wait. It protects the two reserved59a fixture accounts with exact email checks before every cleanup; connection credentials pass only through private environment, never process arguments. It invokes tests/contract/legacy-learning-card-upgrade-runtime.ts for the actual Supabase/repository/coordinator integration.

Final PASS log: /private/tmp/legacy-upgrade-concurrency-final.log.

Nine actual two-connection races passed:

1. Source deletion wins; waiting publication rejects stale evidence without deadlock or metadata write.
2. Consent revocation wins; waiting publication rejects the pin.
3. Subtitle UPDATE wins; waiting publication rejects stale evidence.
4. Neighbor INSERT wins using its actual FK parent lock; waiting publication rejects the changed window.
5. Publication wins before neighbor INSERT; its original applied receipt remains immutable.
6. Publication wins before subtitle UPDATE; its receipt remains immutable.
7. Publication wins before source deletion; source-free receipt replay remains valid.
8. Two actual same-request publications return the identical applied receipt.
9. Publication wins before consent revocation; the committed receipt remains valid.

The same harness then proved against the actual API/database:

- Default runtime with CI=true still requires this owner's real gateway before claim.
- Two concurrent coordinator calls with the same UUID execute exactly one deterministic model cycle; another gateway resolver is never called.
- All protected public official/Saved/artifact/job/source graph rows compare deeply equal before/after metadata application.
- After real delete_video_source, the same upgrade UUID replays with zero further model calls and unchanged official attempt/mastery/canonical/schedule history.
- Both reserved fixture owners are removed at the end.

A first same-publication test draft artificially locked sense before the production source-first order and created a test-only inversion. The final test starts the real first publication inside its transaction, holds that transaction until the second call demonstrably waits, and preserves the production lock order. This is instrumentation correction, not a product behavior relaxation.

## Final self-verification

| Check | Result | Evidence |
| --- | --- | --- |
|Full application|1806PASS: unit904, contract256, integration583, prompt63|/private/tmp/legacy-upgrade-task1-full-test.log|
|Full SQL|23files,1139assertionsPASS; transactions rolled back|/private/tmp/legacy-upgrade-all-sql-final.log|
|Focused upgrade SQL|45PASS, including exact reuse/model publication, not_expression, manual/source CAS, lease expiry, failure booleans, source deletion, ACL and complete protected graph equality|/private/tmp/legacy-upgrade-publish-expanded.log|
|Real contention/runtime|Nine races plus actual concurrent coordinator/source-free replayPASS|/private/tmp/legacy-upgrade-concurrency-final.log|
|Whole TypeScript|0diagnostics|/private/tmp/legacy-upgrade-task1-types.log|
|Owned lint|0errors/0warnings|/private/tmp/legacy-upgrade-task1-lint.log|
|Diff format|git diff --check clean|Controller/source checkpoint12569275|

Database types were generated from isolated54332 at044. Existing nullable RPC refinements, trigger-generated draft insert fields and exact one-newline EOF were retained. The new sense-page nullable cursor is represented explicitly.

At handoff, the isolated DB window was released to D with no remaining A transaction or lock. A will not overlap D's database work.

## Ordered actual-deployment impact, for controller only

The controller separately confirmed the actual personal schema is at023.024–038 prerequisites require the already-planned backup and protected old-field comparisons:024 maps old draft lifecycle and fills new hashes/entry_round/receipt keys;027 recomputes the new draft hash;032 fills only new due-task scenario metadata;038 creates pending preparation outbox rows for pending unprepared reviews.038 is SQL-only but an existing worker could consume those rows, so the controller must handle the real worker/cron/runtime compatibility before any actual migration or model application. This report does not equate “no model inside SQL” with a safe running-worker deployment.

039–044 add the new private workflow and functions/locks only; they perform no automatic canonical backfill, job execution or model call. Actual metadata updates require the explicit owner manifest command, a valid source proof and that owner's active consented gateway. The actual owner/backup/service maintenance/application remain controller-only after independent acceptance. No raw source text, cards, answers, prompts, credentials or actual-account record content belongs in GitHub evidence.
