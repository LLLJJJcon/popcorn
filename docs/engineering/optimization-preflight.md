# Optimization preflight — 2026-11-01, group 1

## Authorized scope

The user requested execution under section 16 of the supplied execution specification. This run implements and independently accepts **group 1 only**: sections 4, 8.0–8.2, 15 and 16.1. Groups 2–4 require their own subsequent group gates; section 4.9 downstream behavior, 4.14 and all draft/phase 2 sections are excluded. The existing uncommitted implementation was checkpointed at `4f61021` on `codex/phase1-group1-confirmed` before reconciliation. Old delivery reports are historical claims, not current acceptance evidence.

Read repository `AGENTS.md` and installed Next.js route/client/testing guidance before implementation. The actual installed package is Next.js 16.3.1. The controller, backend audit, Saved UI audit and independent acceptance roles are separate.

## Section 4.12 required checks

| Check | Conclusion | Evidence | Impact |
| --- | --- | --- | --- |
| Candidate consumers and promotion | Existing practice creation/material readers consume the shared candidate schema. Migration 020 already copies all seven learning-card fields and both system fields into expression_senses during initial promotion. Modern candidates still require a redundant confidence field. | `src/server/domain/create-practice-task.ts:63`; `src/server/repositories/practice-material-repository.ts:18`; `supabase/migrations/202611010020_learning_card_fields.sql:213`; `src/contracts/knowledge.ts` | Preserve practice/mastery behavior. Remove confidence from modern cards while retaining legacy compatibility; use a new migration if SQL requires a compatibility projection. |
| Snapshot persistence and idempotency | `completeResolved` performs the ready-state RPC; migration 019's BEFORE UPDATE trigger resolves target/context and registers highlights inside the same transaction. Same-snapshot ready replay is a no-op. | `src/server/jobs/process-jobs.ts:631`; `supabase/migrations/202611010019_expression_highlights.sql:652`; `supabase/tests/expression_highlights.sql:31` | This is semantically equivalent to resolving during resolve_snapshot and keeps writes atomic. Retain the existing transactional implementation; no bulk backfill. |
| Selection offset basis | Extension selection offsets are UTF-16 positions within full selected lines joined with newline; the server converts them to first/last line-local offsets. Saved editor sends line-local endpoints directly. | `extension/sidepanel.js:2221`; `extension/sidepanel.js:2267`; migration 019:677; `supabase/tests/expression_highlights.sql:37` | Definitions agree, including emoji/cross-line selections; preserve server-owned exact text and test coverage. |
| Saved target rendering/selection | Saved detail passes resolved target segments to the highlight editor. DOM Range projection uses target text nodes and excludes remove controls; context is not selectable. | `src/features/saved/saved-video-detail.tsx:126`; `src/features/saved/candidate-list.tsx:405`; `src/features/saved/highlight-editor.tsx:16`; `src/server/domain/saved-item-target.ts:82` | Retain existing UI and projection. Add interaction-level tests for Mark submission, consecutive additions and overlap replacement. |

No preflight data-structure conflict requiring a new user-visible product choice was found. Scope choices in this report follow the supplied specification and do not authorize downstream work.

## Existing implementation versus confirmed requirements

| Area | Already present | Reconciliation needed |
| --- | --- | --- |
| Context/targets | Persisted target lines, before 3/after 2 context, moment-gap previous-line fallback, legacy read fallback, extension key-quote context | Independently rerun source/SQL/extension evidence; do not rewrite working logic. |
| Highlights | Owner-scoped table/routes/RLS, automatic jobs, manual spans, overlap replacement, remove/restore, unavailable status, format retry helper | Highlight timeout is 30000 instead of 20000; shared retry constant is missing; fixture differs from section 8.1. |
| Analyze | Short IDs, batches of 5, bounded tokens, per-card retries, partial success, immutable cards and stable practice identities | Exact prompt text/framing, centralized batch constant, prescribed fixture, card ID/order validation, modern confidence removal. |
| Saved UI | Target-only editing, English status messages, five-second undo, Analyze enablement, required/default and More card sections, tags, not_expression and legacy rendering | Meaningful Mark POST/consecutive-add/overlap UI interaction tests; update browser workflow coverage. |
| Prompt verification | Simplified prompt files and existing normalization tests | Replace task instructions with exact section 8 text; add both six-case golden datasets and opt-in real-gateway trial tooling. |
| Demo/release gates | Existing unit/contract/integration/extension/SQL coverage and old demo seed | Seed all group 1 states; test:extension currently selects only four release tests and omits save-payloads; both required E2E suites still use old card fixtures. |
| Process records | Existing historical execution ledger | Add this preflight, durable task plan, fresh independent acceptance report and group 1 ledger entry; preserve historical entries. |

## Parallel execution decision

Parallel implementation is safe after this audit because exact write ownership is disjoint: backend/contracts/new migrations (A), Saved UI and save-payload interaction tests (B), seed/golden/runner/package/E2E tooling (C). A publishes prompt export signatures for C; no agent edits another agent's files. The independent acceptance agent D does not implement fixes. Controller owns commits and records. See `docs/engineering/group-1-execution-plan.md` for the full dispatch and verification checklist.

GitHub checkpoint push was initially rejected by automatic approval review because ownership/trust and the specific source payload destination were not explicit enough. The user subsequently explicitly authorized pushing this run's group 1 source/migration/test commits to `https://github.com/LLLJJJcon/popcorn`, branch `codex/phase1-group1-confirmed`; the controller retried the authorized push.

## Independent baseline results

- Unit: 52 files / 473 tests passed; contract: 6 files / 186 passed; full extension: 180 passed; typecheck passed.
- Integration: 28 files / 523 passed when local listening is permitted. The initial restricted run's localhost `EPERM` was environmental.
- SQL: 734/735 assertions passed. `supabase/tests/rls.sql` assertion 191 still tests the historical 200 UTF-16 boundary even though existing migration 022 accepts 10000; backend implementer owns reconciling the test with the already adopted group 1 long-selection compatibility.
- The local database already contains migrations 019–022. No reset is permitted or needed.
- Required E2E baseline: 2/4 passed. Saved loop raw-text locator matches active and ignored saves; returning-learner completion returns 409 under the existing server. Tooling implementer owns fixture/selector diagnosis; preserve current practice and review rules.
- Baseline logs: `/private/tmp/popcorn-group1-baseline-{unit,contract,integration,extension,typecheck,sql,e2e}.log`. Final acceptance must rerun updated suites; these baseline results are not final acceptance.

## Final disposition

The separate acceptance agent completed the final engineering/fixture gates and all 11 criteria; see `group-1-acceptance.md`. Draft PR #1 contains the acceptance matrix. The user explicitly approved the only exception to 15.3: deleting the inherited blank final line from migration 021, with no SQL-content or database change (`95de382`). Unassigned concurrent provider/token edits are preserved outside the committed/tested scope. Real-model semantic review remains unrun. This run stops after group 1.
