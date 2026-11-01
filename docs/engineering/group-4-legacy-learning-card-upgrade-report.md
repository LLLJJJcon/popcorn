# Legacy learning-card upgrade — Task 2 implementation

2026-11-01, Asia/Shanghai. B implementation/self-test report; independent D acceptance and actual-owner application remain separate controller tasks.

## Authorized scope

Only these new production/test files and this report were written:

- `src/server/domain/legacy-learning-card-upgrade-source.ts`
- `src/server/domain/legacy-learning-card-upgrade-source.test.ts`
- `src/server/domain/legacy-learning-card-upgrade.ts`
- `src/server/domain/legacy-learning-card-upgrade.test.ts`

The actual `src/server/contracts/legacy-learning-card-upgrade.ts` is consumed unchanged. No repository, SQL, runtime, route, CLI, UI, original checkout or existing prompt/budget file was modified. No database command, real gateway call, personal-source read, commit or push was performed. Fixtures use synthetic owner families `61000000` / `62000000`.

## Delivered behavior

`planLegacyLearningCardUpgrade(context)` returns the existing contract's PlanRow. A schema-valid canonical card, including empty usageSettings, is already_modern. Partial/edited metadata blocks. An exact repository-proven existing card takes priority, retaining its original candidate key (including l-keys); there is no expression-spelling association or l-to-h conversion. Source selection prefers the original Saved association, then createdAt/occurrence ID among provable candidates. Missing/deleted/unprovable sources block.

`buildLegacyUpgradePromptInput(context,request)` requires the exact selected sense/before/evidence/source identity. It validates unique stable IDs and original positions, continuous TARGET positions, exact ordered target IDs, newline-joined occurrence evidence, exact target times and a single literal expression span. It emits only actual subtitle text, up to three preceding/two following segments and one ephemeral h1 highlight with its real TARGET line. Multi-line and later-TARGET spans are covered. It never persists a highlight or Saved association. Source owner/sense/receipt/snapshot association is authoritative repository proof: the frozen SourceCandidate intentionally carries no independent owner field, so the pure module does not invent ownership evidence.

`createLegacyLearningCardUpgradeService(dependencies)` exports `plan(owner,page)` and `upgrade(owner,request)`. Planning validates the at-most-200 query limit and returns the repository cursor without imposing an overall cap. Upgrade validates the request and performs exact-signature receipt lookup before context/configuration access. Published, known-failed and pending receipts replay with zero model calls and no new claim. Canonical no-op has no egress or write. Existing-card synchronization claims/publishes with null pin and no gateway resolution. Other requests validate current owner/sense/plan, resolve configuration before claiming, and only a successful claimant can generate.

Model generation invokes the unchanged Analyze-v3 pure builder and normalizers with one h1 expression: `learningCardOutputTokens(1)` (currently2458),30000ms, one shared initial+3 format/card attempts, inner retry0. Provider transport policy is unchanged. Wrong/missing/duplicate IDs, malformed envelope/card and examples-only fallback are tested. Complete not_expression cards remain not_expression and are passed to repository publication, which authoritatively returns needs_review; canonical classification is not forced. The service adds no Review exclusion or preparation-cycle behavior.

Publication is repository-authoritative. The service forwards the exact pin/card/provenance and fresh clock, returns stored outcomes directly, and does not compute metadata hashes or learning-graph changes. Lost publication responses first recover the receipt before attempting failure persistence. A true fail result confirms failure; false/throw leads to another receipt lookup, otherwise in_progress with the original request UUID. It never invents a replacement UUID or automatically retries known failures. Actual SQL owner/source/manual/pin/lease fences and learning-history preservation remain A/D integration responsibilities; unit tests prove the coordinator respects their authoritative outcomes, rather than claiming to prove database atomicity.

## RED → GREEN evidence

- Source tests first observed the absent module import failure: `/private/tmp/group4-upgrade-source-red.log`; initial24 cases then passed in `/private/tmp/group4-upgrade-source-green.log`.
- Coordinator tests first observed absent module RED in `/private/tmp/group4-upgrade-service-red.log`, then37 behavior failures against an explicitly unimplemented exported interface in `/private/tmp/group4-upgrade-service-behavior-red.log`. That intentional stub run also reported the unimplemented concurrent first call as an unhandled rejection. It is not a passing run.
- First implementation run `/private/tmp/group4-upgrade-owned-first.log` exposed a test-side recursive publish spy in the commit/response-loss simulation. The spy was corrected to call its original implementation; no production behavior was weakened. The subsequent61-case run passed in `/private/tmp/group4-upgrade-owned-green.log`.
- Additional regression coverage includes multi-TARGET spans, exact not_expression existing cards, claim-race stored outcomes, rejected consent resolution, exact pin propagation, late ready receipts, fresh publication clocks, isolated instruction-looking source text and distinct UUIDs contending for one sense.

## Final verification

Commands were run in the isolated group4 worktree, with fixture gateways only:

| Check | Result | Full log |
| --- | --- | --- |
| Two owned suites + actual contract suite |80/80 (28 source,45 coordinator,7 contract) | `/private/tmp/group4-upgrade-final-owned.log` |
| `pnpm test` |1784/1784:904 unit,239 contract,578 integration,63 prompt | `/private/tmp/group4-upgrade-full-final.log` |
| `pnpm typecheck` | exit0 | `/private/tmp/group4-upgrade-final-type.log` |
| Scoped ESLint, four owned TS files | exit0, no warnings | `/private/tmp/group4-upgrade-final-owned-lint.log` |
| `pnpm lint` | exit0,0 errors,4 warnings in unowned existing files | `/private/tmp/group4-upgrade-final-lint.log` |
| `git diff --check` | exit0 | command output empty |

The four full-project lint warnings are: `scripts/process-local-jobs.mjs:87` unused `_status`; `tests/integration/jobs/process-jobs.test.ts:26` unused `SavedItemAnalysisContentSchema`; `tests/integration/knowledge/source-traceability.test.ts:83` unused `_userId` and `_savedItemId`. No owned warning remains.

The full suite was rerun after the final distinct-UUID concurrency regression. This is implementation evidence, not independent acceptance, actual-source application, a database fence verdict or a new human product-quality verdict. The user's separate20/20 modern-question approval is not replaced or rerun by this task.

## Controller command checkpoint

The controller added `scripts/upgrade-legacy-learning-cards.ts` and its contract suite. Default execution plans every page for one explicit owner without writes or model calls. An optional exclusive0600 manifest stores only exact proof references and stable request UUIDs. Apply validates that private manifest and owner, invokes requests serially and reuses them on resume; it never replans or mints replacement UUIDs. Output projects only counts, identities, statuses and fixed codes, including for complete private not_expression results. There is no all-owner or fixture CLI mode.

The missing-command-module RED is `/private/tmp/legacy-upgrade-cli-red.log`. Final fresh controller validation passed97 cases across B's two suites, actual contract and17 CLI cases (`/private/tmp/legacy-upgrade-root-owned-final.log`), pure read-only TypeScript (`tsc --noEmit --incremental false`) and owned ESLint. The incremental typecheck initially hit a worktree write-permission error; the read-only equivalent completed with exit0. D independently ran the97 tests and owned lint while storage publication fixes remained in progress; this is not its final database/whole-feature acceptance.

Deployment preflight remains read-only. The actual local database was rechecked at migration024; migration038 would add6 pending preparation jobs, while the existing personal application/worker uses an older handler map. Applying the complete migration chain without coordinating compatible running code would expose those jobs to that older worker. No actual migration, model request, service restart or metadata synchronization has happened at this checkpoint. The original checkout's user changes are preserved. Storage/race verification and a reviewed deployment procedure remain prerequisites.
