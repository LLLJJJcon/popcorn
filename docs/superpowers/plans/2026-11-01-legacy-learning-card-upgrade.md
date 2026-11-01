# Legacy Learning-card Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Each owner self-tests; independent D implements none of the product/fixture code and runs final acceptance. Controller alone commits/pushes and applies to the actual owner after acceptance.

**Goal:** Synchronize existing exact modern cards or generate missing cards from retained original sources, preserving prior learning history.

**Architecture:** Explicit owner-scoped command consumes a private manifest of per-sense requests. A's service-only SQL/repository claims and CAS publishes metadata; B's pure source planner/coordinator reuses unchanged Analyze-v3. No hidden Analyze call in Review and no raw-field legacy-generation branch.

**Tech Stack:** Existing Node24+, TypeScript/Zod, Supabase/PostgreSQL, Vitest and Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-01-legacy-learning-card-upgrade-design.md`. User explicitly approved source-based additional calls and20/20 modern samples; no repeat approval for those same actions is required. A fresh builder found nothing important left.

## Global constraints

- New migrations039 onward; do not modify applied001–038. Development writes only on isolated54331/54332; actual54321/54322 application is controller-only after independent acceptance/backup.
- Same Analyze-v3 instruction/framing; one expression/request, h1 alias,30000ms, learningCardOutputTokens(1)=2458 currently, shared initial+3 immediate attempts and inner retry0. Existing transport and examples-only normalization rules remain.
- Preserve old compatibility text, questions, answers, mastery, schedule, Saved/highlight/artifact state and failed preparation cycles. Only complete expression-card metadata/normal canonical updated_at/private upgrade receipts may change.
- No same-spelling cross-sense association; partial/edited data and unprovable/deleted/ambiguous sources are not overwritten. Preserve complete not_expression result as needs_review without relabeling canonical or adding Review exclusion behavior.
- Owner/source/before/evidence/pin/lease/request fences are checked atomically; model work stays outside transactions. Unknown publication reads receipts and keeps its original request ID.

## Review focus

- Another tab edits metadata/source or revokes gateway consent while generation runs: preserve its data, reject stale publication.
- Legacy l-key and new h-key happen to contain the same expression: do not merge; use a separately proven original occurrence or block.
- Model returns not_expression, malformed examples, wrong/missing/duplicate IDs or input instructions: retain real classification, obey the shared attempt budget, never leak untrusted data into system instructions.
- A response is lost after commit or two commands overlap: one stored result/model claimant; same manifest replays without new calls.
- Initial local schema audit was023; fresh2026-11-02 audit is024. Audit ordered prerequisites, private backup and protected old-field snapshots for all owners. No reset or original checkout rewrite. The existing old app cannot process038 jobs: use the reviewed reversible maintenance/claim gate and compatible application switch, keeping Supabase running. All6 new outbox items currently belong to the authorized owner; recheck immediately before writes.

## Stable contracts and ownership

A's actual importable `src/server/contracts/legacy-learning-card-upgrade.ts` is the source of truth. It exports strict Request/Target/PageInput/Manifest/Outcome/SourceCandidate schemas/types, LegacyUpgradeContext/PlanRow/PlanPage/Publication/Claim, LegacyUpgradeError, repository and dependencies. Hashes are PostgreSQL-produced opaque values; never recreate JSON hashes in JavaScript.

`LegacyLearningCardUpgradeRepository` methods: pageContexts(owner,page), readContext(owner,sense), resolveActiveGatewayPin(owner), lookup(owner,request,now), claim(owner,request,pin,now), publish(owner,request,token,publication,now), fail(owner,request,token,errorCode,now). Actual method/result types are frozen in that file. Manifest contains version,ownerId,createdAt,requests; each request includes requestId,senseId,expectedBeforeHash,expectedEvidenceHash and the exact existing-card or source-occurrence reference. One sense and one UUID appear only once.

### Task 0 — A: actual contract, completed before parallel implementation

Files: new server contract above; `tests/contract/legacy-learning-card-upgrade.test.ts`.

- [x] Observe missing-module RED, implement strict real exports, verify7 contract cases and types. Reject NOT_EXPRESSION outcome without its complete card.
- [x] Controller saves this contract/design/approval checkpoint; implementation owners consume exact exports, never independent shadow DTOs.

### Task 1 — A: storage, repository and runtime

Files: create `supabase/migrations/202611010039_legacy_learning_card_upgrade.sql`, `supabase/tests/legacy_learning_card_upgrade.sql`, `src/server/repositories/legacy-learning-card-upgrade-repository.ts` and related repository integration tests; create `src/server/legacy-learning-card-upgrade-runtime.ts`; update generated database types. A alone owns these and any necessary additive repair migration.

Produces the frozen repository interface plus `createLegacyLearningCardUpgradeRuntime()` returning `{plan(owner,page),upgrade(owner,request)}` from B's factory with existing consented gateway resolver. Runtime has no browser import or automatic worker registration.

- [ ] Write and observe RED for owned canonical/linked/source contexts, private ACL/RLS, deterministic opaque hashes, same-ID claims/replays and changed-ID signature conflict.
- [ ] Implement read-only paged contexts, exact linked-card proof and bounded original occurrence/segments. No phrase-only l→h mapping.
- [ ] Observe publication RED for source/manual/pin/lease changes, partial metadata, foreign owner and malformed/not_expression card; implement metadata-only atomic CAS plus complete receipts/outcomes.
- [ ] Prove actual official/Source/Saved/artifact/preparation-cycle projections unchanged. Add actual independent-connection contention and response-loss recovery evidence.
- [ ] Apply039 only to dedicated test stack, regenerate types, run affected/full SQL/types/lint and report. Runtime may be wired after B's actual factory exists; do not invent a fallback implementation.

### Task 2 — B: source proof and coordinator, parallel after Task0

Files: create `src/server/domain/legacy-learning-card-upgrade-source.ts/.test.ts`, `src/server/domain/legacy-learning-card-upgrade.ts/.test.ts`; report in engineering docs. No repository/SQL/runtime/contract/CLI edits.

Produces `planLegacyLearningCardUpgrade(context): LegacyUpgradePlanRow`, `buildLegacyUpgradePromptInput(context,request): {lines,highlights}`, and `createLegacyLearningCardUpgradeService(dependencies)` with `plan(owner,page):Promise<LegacyUpgradePlanPage>` and `upgrade(owner,request):Promise<LegacyUpgradeOutcome>`.

- [x] RED→GREEN source proof: exact original occurrence/snapshot/ordered segments, h1 line binding, bounded context; repeated/foreign/missing/deleted/ambiguous/mismatched evidence blocked; same word/different senses stay separate.
- [x] RED→GREEN zero-cost canonical no-op and exact existing-card copy, partial preservation and not_expression needs_review with complete card retained.
- [x] RED→GREEN one claimant before model, exact unchanged v3 input projection/2458 budget/30s/shared4 attempts, valid examples or final examples-only policy, never source/answer leakage into instruction fields.
- [x] RED→GREEN same-ID replay, unknown-commit receipt lookup/boolean failure fences, stale-source/manual/pin outcomes; never automatically mint another request or reopen failed prepare work.
- [x] Run owned and complete application tests/types/lint; coordinate actual repository integration with A without overlapping edits.

### Task 3 — Controller: explicit CLI and authorized application

Files: create `scripts/upgrade-legacy-learning-cards.ts` and `tests/contract/legacy-learning-card-upgrade-cli.test.ts`; product approval records/ledger/PR. No A/B production-file edits.

CLI: `--user UUID` dry-runs all pages by default. `--plan PATH` writes a0600 private manifest with stable UUIDs and no raw source text; `--apply --plan PATH --user UUID` validates owner/version/unique requests and invokes exact per-sense requests serially. It does not regenerate manifest IDs on retry. Export injectable parsing/runner helpers for behavioral CLI tests; direct execution constructs A's runtime. Output only safe counts/IDs/status/reasons, no cards/source/answers/credentials. No implicit all-owner mode or automatic retry loop.

- [x] RED→GREEN parser/manifest validation, dry-run0 mutations/model calls, multi-page uncapped planning, private file mode, exact apply/resume IDs and redacted error output.
- [x] Record human20/20 approval with original reviewed-file hash; leave raw trial files unchanged. Save the authorization/design checkpoint; PR stays draft until new engineering/data work passes.
- [ ] After independent D acceptance: revalidate selected actual owner, port and current migration state; create private backup/protected before snapshots; audit/apply ordered confirmed schema prerequisites without reset; verify protected historical projections before any model call.
- [ ] Actual dry-run manifest first, then authorized apply using original retained sources and active consented gateway. Verify only eligible modern metadata/private receipts changed, repeat same manifest with0 further calls, record aggregate counts/provenance/hash evidence without personal content in GitHub.

### Task 4 — D: independent final acceptance, serial after implementation freeze

Files: independent engineering acceptance report only; no product/tests/fixtures/seed repair by D.

- [ ] Independently verify source/card/owner/CAS/lease/consent/classification/idempotence/CLI cases, actual SQL/concurrency and unchanged learning graph; read implementation differences from accepted4591.
- [ ] Run complete relevant application/types/lint/provenance/build and required production browser regressions. Do not rerun actual modern20: prompt/raw outputs stay unchanged and human approval is explicit.
- [ ] Review ordered deployment/data-preservation checks before actual application; after controller application, independently read-only confirm safe aggregate outcomes/unchanged protected data.
- [ ] Record engineer verdict, actual synchronization outcome and any genuinely blocked records separately. Only then save final GitHub evidence and merge using the user's existing main-merge authorization; no unapproved raw legacy prompt or fabricated data completion.
