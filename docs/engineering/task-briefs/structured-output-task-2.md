# Structured Output Reliability — Task 2 Brief

- Plan/task: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 2.
- Baseline: `7c935753280786cbf9697feea0ea9eb4369a5a25`.
- Branch/worktree: `codex/structured-output-task-2` at `/private/tmp/popcorn-structured-output-task-2`.

Implement only Overview, Translation, and Explanation server prompt/wire/
enrichment adaptation on the frozen Task 1 gateway.

Allowed files are exactly the Task 2 Files list plus
`docs/engineering/handoffs/structured-output-task-2.md`. No migration,
contract, root config, lockfile, Saved analysis, Practice, Web UI, extension,
or user-local file may change.

Consume `extractUniqueSemanticObject`, task normalizers, request options,
safe stages, and current strict domain schemas. Produce prompt versions
`youtube-overview-v5-structured`, `translate-segments-v2`, and
`explain-selection-v2`, plus the exact finite readable-version constants and
predicates in the plan. Do not implement historical cache lookup; Task 5 owns
that shared seam. Final domain artifacts must keep their existing shapes.

Use the exact Frozen Prompt Contract verbatim. Model output owns only semantic
fields/source indexes; IDs, timestamps, selection identity, order, and source
grounding are derived in code. Overview alone passes
`maxTransportRetries: 0`. Unknown/conflicting indexes are dropped; partial
Overview/Translation members survive only when the final strict artifact is
valid; Explanation remains atomic. Update the two explicitly conflicting old
Overview tests exactly as specified by the plan.

TDD: write/run the named RED tests before implementation and record the actual
failure. GREEN commands:

```bash
pnpm exec vitest run src/server/ai/prompts/learning-artifact-wire.test.ts tests/integration/youtube/learning-artifacts.test.ts
pnpm typecheck
git diff --check
```

Typecheck may retain only the same seven baseline
`practice-session.test.tsx` missing-`savedReturnTarget` errors; no new error.
Do not run full tests/build/database/Playwright/real Provider.

YouTube Digest remains pinned to MIT commit
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`; do not modify/recreate extension
logic. LLM Wiki remains method-only at GPLv3 commit
`723e259309aea5e3850265b631f80224f66dd9f6`; copy no code, test, prompt,
component, or asset.

Commit implementation plus handoff. Return SHA, RED/GREEN, exact files,
consumer-chain impact, risks, and report path. Do not merge/rebase/push.
