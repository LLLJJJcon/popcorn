# Source-grounded legacy learning-card upgrade

## Authorization and outcome

2026-11-01, Asia/Shanghai. The user requested that old records be updated, then explicitly approved: “允许按原来源补齐新版学习卡（推荐）”. The question explained the additional model calls and preservation of existing questions, answers, mastery and schedules. The user separately approved all20 actual modern transfer questions; that approval is recorded in the product review file, not inferred from engineering tests.

This chooses source-grounded metadata modernization. It does not choose the old proposed raw-field legacy prompt/v4 generation branch. Once an old sense has a valid modern card, its new review questions use the already-approved modern generation/v5 scoring path. Already-prepared historical questions keep their text, version and existing scoring compatibility; official results are never regraded.

## Intent and constraints

Use an explicit one-time, owner-scoped upgrade command. Opening Review must not secretly invoke Analyze before generation. Reuse an exact owned existing modern card first, at zero model cost. Otherwise generate a new card only from a retained, provably linked original subtitle occurrence. Do not create or revive Saved items/highlights, change original six compatibility fields, rewrite artifacts, questions, attempts, mastery or review schedules, or reopen failed preparation cycles. No generic template/question bank is introduced.

The controller's read-only current-account audit found7 canonical senses:1 already valid modern,6 with all modern fields empty,0 partial,6 retained sources. These are aggregate observations, not permission to overwrite arbitrary owners. The approved gateway selection identifies one owner; the actual command must bind that exact account and its active consented gateway. No personal data has been changed or sent for this upgrade yet.

## Eligible records and source proof

- A valid canonical modern card is an idempotent no-op. Valid modern empty usageSettings remains valid and must not be mistaken for missing data.
- For a fully empty modern canonical row, an exact owner/promotion-receipt/candidate-key association can supply a valid existing modern card. No expression-spelling-only match or automatic l-key to h-key conversion is allowed.
- Otherwise use the canonical sense's actual retained source and owned occurrence/snapshot/ordered subtitle segments. Prefer its original saved association where available, then the earliest provable occurrence by created_at/id. This is an engineering choice for deterministic original-context selection, not a new semantic mapping.
- Require actual source/snapshot ownership, an exact source excerpt/evidence relationship and an unambiguous literal expression span. Repeated ambiguous matches, missing/deleted source, missing segments or unprovable sense/card association produce a typed blocked reason. Do not guess offsets, retrieve a new transcript or add an extra classification model call.
- Construct only an ephemeral server selection. Never persist it as a user highlight or claim that the user just marked it.
- Partial/edited/conflicting modern fields are preserved and reported. Without edit provenance, they are not automatically overwritten.

## Generation and classification

The actual model prompt remains exactly analyze-saved-item-v3, its instruction-isolation framing, input {task:learning_cards,lines,highlights} and cards output. No old English descriptions or extra source fields are appended to that contract. Use the original-context TARGET lines plus existing bounded context convention (up to3 before,2 after). Model IDs are short h1-style aliases, never database IDs.

Each sense is a separate durable operation and model request with one selected expression. This controller choice keeps source/sense binding simple for the observed six records and avoids mixing different senses or subtitle windows. It is within the existing batch limit5; learningCardOutputTokens(1) is used without another headroom multiplier, timeout30000ms. Reuse existing per-card normalization and one shared initial+3 immediate format/card attempts; inner format retry count0. Preserve the existing examples-only final normalization policy. Transport behavior is unchanged. Do not invent fresh request IDs after uncertain outcomes.

Publish only a validated card whose suitability is expression. If the model or linked card reports not_expression, retain the full card and reason in the private operation outcome and report needs_review; do not relabel it as expression or change the existing canonical membership, mastery or Review exclusion rules. This is a conservative controller choice to preserve the actual classification despite the current canonical schema lacking suitability fields. No partial generated card is published.

## Storage, claims and publication

Add new migration039 onward; applied001–038 remain untouched. Use a service-only private operation/receipt table for workflow version learning-card-upgrade-v1, distinct from the unchanged model prompt version. Persist request signature, owner/sense, before/evidence hashes, linked source identity, claim token/lease, full normalized card/outcome, model/prompt/gateway provenance and timestamps. Browser clients cannot select operation secrets or publish their own card.

Planning is read-only, paginated at most200 rows per query with no product total cap. Apply takes the reviewed sense IDs plus expected before/evidence hashes and stable per-sense UUIDs written to a private manifest. Same UUID and input replays with zero model calls; changed input conflicts. Concurrent requests for the same sense cannot run duplicate active generation. A5-minute claim bounds model work, which always occurs outside transactions. Explicit rerun resumes the same manifest/request IDs.

Successful publication atomically locks and rechecks owner/sense, the still-empty modern fields, original six fields/updated_at before hash, source/occurrence/snapshot/segment/evidence hashes, claim/request/lease and (for new model output) the active gateway pin/revision/consent. Then update only the modern card fields and normal canonical updated_at, plus its private receipt. Existing-card synchronization requires exact card identity/content proof but no active gateway or model call. A source deletion/edit, manual edit, stale lease or consent change must leave canonical and learning history untouched. Unknown publication first reads the authoritative receipt; confirmed failure writes observe their boolean result and never fake a successful update.

## Delivery and actual-data application

The command defaults to dry-run. It reports only counts/IDs/reasons, not source text, answers, credentials or model raw prompts. An explicit apply requires owner, a private saved plan and stable request IDs. The runtime loads that owner's approved gateway resolver; there is no global all-owner sweep and no automatic learning-artifact/worker failure path.

The first personal audit observed023; the fresh2026-11-02 read-only preflight observes024. Application prerequisites must be treated separately from the metadata operation: audit the already-confirmed025 onward ordered migrations, retain a private backup, use the existing local54321/54322 target explicitly without reset, and compare protected historical field projections before/after. Implementation and D verification use only isolated54331/54332 first. Only the controller performs the explicitly authorized actual-owner synchronization after independent acceptance.

Deployment review found that038 backfills6 pending preparation jobs, all belonging to the selected authorized owner; the running older application cannot handle that job type. The earlier expectation of leaving every process unchanged is therefore replaced by a reversible maintenance sequence within the authorized synchronization: preserve the original checkout and all its changes; keep Supabase running; stage the accepted revision in a separate deployment directory; record the exact claim-function ACL and temporarily freeze task claiming, covering both poller and cron entry points; drain in-flight work and quiesce old-app writes before taking the final protected baseline. Apply migrations in order, retain every new outbox row at attempt0, verify protected old fields, then complete metadata upgrade and same-manifest replay with claiming still frozen. Switch the local application to compatible code and precisely restore the original ACL only after validation. Do not use popcorn:stop, whose cleanup stops Supabase; do not skip migration038, delete new jobs, manufacture failed states or leave claiming permanently frozen. A failed step must retain a recoverable maintenance state and be reported explicitly.

Protected snapshots cover all existing owners' old data, with only the selected owner's modern metadata/normal updated_at and private upgrade receipts allowed to change. Newly derived columns/private backfills are checked separately from old projections. If prerequisites unexpectedly alter old question content, answers, attempts, mastery, review schedules, Saved/highlights or artifacts, stop before any model call and investigate; do not weaken the preservation rule. Completion of the metadata command is recorded before ordinary authorized review preparation resumes.

## Task boundaries and acceptance

A owns frozen server contract/types, repository/SQL/private receipt/runtime. B owns new source-proof planner/coordinator modules and their tests after actual ports exist. Controller owns CLI, approval records, protected-data snapshots, GitHub checkpoints and actual application. These file boundaries permit parallel work after contract freeze; schema publication precedes real SQL integration, and D acceptance precedes actual personal writes. D implements none of the product code/tests/seed changes.

Tests must prove canonical/linked no-op or zero-egress copy, exact same-word/different-sense separation, ambiguous/missing/deleted source blocks, partial/edited preservation, consent/owner/lease/source CAS fences, same-request and concurrent-request model-cost idempotence, four shared attempts, correct examples/not_expression outcomes, unknown-commit recovery and unchanged official/Saved/artifact/prepare-cycle state. Real SQL and two independent connections must verify the publication fence. D independently checks the CLI dry-run/apply boundaries, modern Review regression, original20 output preservation and the full affected application/build/browser gates. Actual-owner before/after receipts and counts complete the delivery record; no new legacy prompt or unapproved field reconstruction is included.
