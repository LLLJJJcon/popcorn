# Structured Output Reliability — Task 5 Brief

## Identity and isolation

- Plan: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 5, **Finite Version Compatibility and Zero-Call Cache Reuse**.
- Product baseline: `ae0d819` (Wave 1 accepted and integrated).
- Execution baseline: the controller commit that adds this brief; record its exact SHA in the handoff.
- Branch: `codex/structured-output-task-5`.
- Worktree: `/private/tmp/popcorn-structured-output-task-5`.
- Implement only Task 5. Start with failing tests, show RED evidence, make the minimum implementation, show GREEN evidence, commit, and leave a clean worktree.

## Why this task is sequential

Tasks 2–4 now generate the latest semantic-wire versions while preserving the
existing strict domain artifacts. Task 5 is the single compatibility seam that
allows those existing artifacts to keep flowing through Saved, Practice, Vault,
and Progress without another model call. It owns shared readers/dedupe paths, so
it must consume the frozen Wave 1 interfaces after integration and must finish
before Wave 2 changes UI status consumers.

## Allowed files

- `src/server/ai/provider.ts`
- `src/server/jobs/process-jobs.ts`
- `src/server/domain/confirm-candidate.ts`
- `src/server/domain/complete-due-practice.ts`
- `src/server/repositories/expression-repository.ts`
- `src/server/repositories/attempt-repository.ts`
- `src/server/repositories/practice-material-repository.ts`
- `src/app/api/v1/saved-items/[savedItemId]/candidates/route.ts`
- `tests/integration/youtube/learning-artifacts.test.ts`
- `tests/integration/jobs/process-jobs.test.ts`
- `tests/integration/knowledge/source-traceability.test.ts`
- `tests/integration/practice/attempts.test.ts`
- `src/server/repositories/practice-material-repository.test.ts`
- `src/server/domain/complete-due-practice.test.ts`
- `docs/engineering/handoffs/structured-output-task-5.md`

## Forbidden files and actions

- Do not modify prompts, model wire/domain schemas, public contracts, database
  migrations/types, extension/Web UI, root configuration, dependencies,
  lockfile, fixtures outside the allowed tests, or the execution ledger.
- Do not rewrite or silently upgrade historical artifacts.
- Do not add prefix/range/lexical version comparisons or accept unknown versions.
- Do not call a real Provider, Supabase, browser, Docker, or network service.
- Do not merge, rebase, push, or run the full repository test suite.

## Frozen interfaces consumed

- Overview readable versions, in lookup order newest first:
  `youtube-overview-v5-structured`, `youtube-overview-v4-simple`.
- Translation: `translate-segments-v2`, `translate-segments-v1`.
- Explanation: `explain-selection-v2`, `explain-selection-v1`.
- Saved analysis: `analyze-saved-item-v2`, `analyze-saved-item-v1`.
- Practice activation: `activate-practice-v2`, `activate-practice-v1`.
- Practice evaluation: `evaluate-practice-v3`,
  `evaluate-practice-v2`, `evaluate-practice-v1`.
- Consume the exported finite arrays/predicates from Tasks 2–4. Tests must use
  literal historical strings so changing the production constants cannot make a
  false-positive test pass.
- Recompute request-addressable historical result keys only through the frozen
  `createJobResultKey`; never reproduce its serialization.
- Existing strict domain schemas remain the final validation boundary.

## Behavior and output flow

1. A new request still targets only the latest prompt version.
2. Before registering latest work, compute result keys for every allowlisted
   compatible version from the exact same validated payload and pinned gateway
   fingerprint, newest first.
3. Reuse an existing artifact only when owner, operation/source identity, input
   hash, model/gateway fingerprint, exact allowlisted prompt version, and the
   current strict domain schema all agree.
4. On a match, return the existing artifact/job result and make **zero Provider
   calls**. Do not duplicate, mutate, or upgrade it.
5. When no compatible result exists, preserve the normal latest-version durable
   job path.
6. Repository readers for Saved/Practice must reject unknown versions before
   returning data. Translation recovery must validate `prompt_version`;
   activation must validate the candidate artifact version; Due recovery may
   consume completed Evaluation v1/v2/v3 only.

The returned/persisted product shapes do not change. This task only chooses a
validated existing artifact earlier, so downstream Saved → Practice → Vault →
Progress consumers receive the same strict domain object they already consume.

## Required RED evidence

Add focused tests for all six families: Overview, Translation, Explanation,
Saved analysis, Practice activation/draft, and Practice evaluation/attempt.
Each family must prove oldest allowlisted read, current read, unknown rejection,
and zero Provider calls for a compatible completed result where the flow can
invoke a Provider. Also cover:

- a mismatched owner/source/input/model/gateway/result key is never reused;
- a historical artifact failing the current strict domain schema is rejected;
- translation recovery reads `prompt_version` instead of assuming it;
- candidate API returns Saved v1 as `ready` with no Provider call and rejects an
  unknown Saved version;
- activation reads the candidate artifact prompt version before use;
- Due recovery accepts completed Evaluation v1/v2/v3, rejects unknown, and
  invokes the Provider zero times on compatible completion.

Expected RED: latest-only registration and hard-coded/ignored reader versions
cause the new literal-version compatibility and zero-call assertions to fail.

## Verification

Run only this Task 5 gate:

```bash
pnpm exec vitest run \
  tests/integration/youtube/learning-artifacts.test.ts \
  tests/integration/jobs/process-jobs.test.ts \
  tests/integration/knowledge/source-traceability.test.ts \
  tests/integration/practice/attempts.test.ts \
  src/server/repositories/practice-material-repository.test.ts \
  src/server/domain/complete-due-practice.test.ts
pnpm typecheck
git diff --check <execution-baseline>..HEAD
git status --short
```

Typecheck may retain exactly the seven pre-existing
`src/features/practice/practice-session.test.tsx` TS2741 errors for missing
`savedReturnTarget`; Task 5 may add no diagnostic.

## Upstream and license boundary

- YouTube Digest: `zarazhangrui/youtube-digest` at
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT. This server-only cache task
  does not change its existing extension reuse and must not introduce a parallel
  transcript implementation.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9 at
  `723e259309aea5e3850265b631f80224f66dd9f6`, GPLv3. Method-level inspiration
  only; copy no code, tests, prompts, components, or assets.
- Preserve existing notices and GPL isolation; do not add an upstream file.

## Handoff and review

Commit code plus `docs/engineering/handoffs/structured-output-task-5.md` and
return the SHA, RED/GREEN counts, typecheck differential, risks, and clean status.
An independent read-only Agent will review the full execution-baseline-to-HEAD
diff. Any Critical or Important finding requires a new TDD repair and fresh
independent re-review before controller integration.
