# Task Handoff
- Status: DONE
- Plan and task: `2026-08-16-popcorn-foundation-contracts.md`, Foundation Task 2
- Worktree and branch: `/private/tmp/popcorn-foundation-2`, `codex/popcorn-foundation-2`
- Baseline SHA: `b1739e0e229e48a54f0cbb8eae96fc236c8b00bd`
- Commit SHA: recorded by the commit that includes this handoff

## Implemented

Defined strict Zod contracts for API envelopes and the resolved error taxonomy, YouTube sources and all six save inputs, generated knowledge and five durable job kinds, practice and evaluation records, and the exact `tried|reused|owned` mastery boundary. Added fixed `en`/`zh-CN` validation, bounded source-grounded candidate expressions, exact canonical YouTube identity checks, deterministic factories, server environment parsing, stable response helpers, and a credential-safe `.env.example`.

## Upstream provenance used

No upstream implementation, tests, prompts, components, assets, or naming-specific structure were used. YouTube Digest bytes and provenance artifacts remain untouched. LLM Wiki `v0.6.9` / `723e259309aea5e3850265b631f80224f66dd9f6` was not adapted or copied; no GPLv3 expression was used. No new third-party license artifact is required.

## Interfaces consumed and produced

Consumed the fixed learner-native language `en`, target/transcript language `zh-CN`, canonical YouTube watch identity, six save kinds, five job kinds, three mastery states, and the user-resolved complete 19-code error taxonomy.

Produced `ApiSuccess<T>`, `ApiFailure`, `VideoSource`, `VideoSnapshot`, `TranscriptSegment`, `SavedItem`, `SavedItemInput`, `GeneratedArtifact`, `KnowledgeJob`, `CandidateExpression`, `PracticeTask`, `EvaluationResult`, `AttemptRecorded`, `MasteryState`, and `ReviewTask`, together with their strict schemas, barrel exports, deterministic source/practice fixtures, environment parsing, and success/failure response helpers.

## Files changed

Added `src/contracts/api.ts`, `source.ts`, `knowledge.ts`, `practice.ts`, `memory.ts`, and `index.ts`; `src/server/env.ts` and `env.test.ts`; `src/server/api/respond.ts` and `respond.test.ts`; `tests/factories/source.ts` and `practice.ts`; `tests/contract/shared-contracts.test.ts`; this handoff; and the controller-provided Task 2 brief. Updated only `.env.example` outside those new files. No package, lock, root config, extension, vendor, provenance, plan/spec, ledger, Supabase, generated type, migration, or user-artifact file was changed.

## TDD evidence

### RED

The required `CI=true pnpm vitest run tests/contract/shared-contracts.test.ts src/server/env.test.ts src/server/api/respond.test.ts` exited 1 before production implementation: 3 suites failed with 0 tests because `./env`, `../factories/source`, and `./respond` could not be resolved, confirming the required modules were absent.

Three subsequent focused RED cycles captured contract edge behavior before fixes: 3 failures for mismatched YouTube identity, reversed subtitle offsets, and reversed candidate timestamps; 3 failures for a fragmented watch URL, a mismatched persisted source identity, and a reversed transcript range; then 2 failures for an inexact Chrome extension origin and a proposed Traditional-character heuristic. A separate environment RED exited 1 with `getServerEnv is not a function` before the process-environment selector was added. Controller review correctly rejected the proposed partial character denylist as misleading; the final enforceable contract tests non-empty Han expression text and the literal `zh-CN` discriminator instead.

### GREEN

After the minimum implementation and review fixes, the required focused command exited 0: 3 files passed and 23 tests passed. The direct complete contract command `CI=true pnpm vitest run tests/contract` exited 0: 1 file passed and 15 tests passed.

## Broader verification

Fresh final verification exited 0 for the required focused suite (3 files, 23 tests), direct complete contract suite (1 file, 15 tests), `CI=true pnpm typecheck`, `CI=true pnpm lint`, and `git diff --check`. Static output was clean with no lint warnings. A read-only review found and drove TDD fixes for exact extension IDs and canonical source identity/ranges, and clarified the enforceable `zh-CN` validation layer; no Critical or Important implementation issue remained after the current-tree rerun.

## Contract or migration changes requested

Controller-owned root config follow-up: baseline `package.json` maps `test:contract` to `tests/contracts`, while the frozen Task 2 path is `tests/contract`. Because `package.json` is forbidden Task 2 scope, this task used the mandated direct command and did not change the script. The controller confirmed a separate TDD fix and review will gate integration. No schema or migration change is requested.

## Risks and follow-up

No unresolved Task 2 implementation risk. By controller decision, Task 2 enforces non-empty Han text and the literal `zh-CN` contract discriminator; it does not pretend a partial character denylist can prove orthography. Exhaustive returned-language and Simplified-Chinese content verification remains mandatory at the already-specified later transcript/provider boundary, and this decision does not permit provider fallback languages. Provider credentials remain server-only and empty in `.env.example`.

## Review fixes

Addressed the Important review finding that shared exact-content schemas transformed input with `.trim()`, severing text and identifier traceability from unchanged offsets and source references.

### RED

Before production changes, `CI=true pnpm vitest run tests/contract/shared-contracts.test.ts` exited 1 with 5 expected failures (15 passed): subtitle-selection text/context, `key_quote.exactQuote`, AI selected text/explanation/context, and candidate `evidenceText`/English explanation were returned without their surrounding whitespace; whitespace-padded segment IDs were accepted after normalization.

### GREEN

`src/contracts/source.ts` now retains original values while refining Chinese and English text to be nonblank via `value.trim().length > 0`; it also rejects, rather than normalizes, segment IDs with surrounding whitespace. `src/contracts/knowledge.ts` reuses those non-transforming shared schemas for candidate English text and segment IDs. `tests/contract/shared-contracts.test.ts` adds byte-for-byte round-trip coverage for representative `subtitle_selection`, `key_quote`, `ai_explanation`, and candidate evidence/explanation payloads, plus rejection coverage for padded identifiers.

Fresh verification exited 0: focused Task 2 command `CI=true pnpm vitest run tests/contract/shared-contracts.test.ts src/server/env.test.ts src/server/api/respond.test.ts` (3 files, 28 tests); direct `CI=true pnpm vitest run tests/contract` (1 file, 20 tests); `CI=true pnpm typecheck`; `CI=true pnpm lint`; and `git diff --check`.

Risk: text-length limits now apply to the preserved raw value rather than its formerly normalized value; this is intentional so the contract does not mutate source-grounded content. Language, bounds, offsets, and discriminants otherwise remain unchanged.
