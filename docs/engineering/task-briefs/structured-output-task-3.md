# Structured Output Reliability — Task 3 Brief

- Plan/task: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 3.
- Baseline: `7c935753280786cbf9697feea0ea9eb4369a5a25`.
- Branch/worktree: `codex/structured-output-task-3` at `/private/tmp/popcorn-structured-output-task-3`.

Implement only Saved analysis v2 semantic wire output, deterministic evidence
grounding, real explicit retry identity, owner/save-bound job status, and
terminal post-gateway failure behavior.

Allowed files are exactly the Task 3 Files list plus
`docs/engineering/handoffs/structured-output-task-3.md`. No migration,
contract, root config, lockfile, Overview/Translation/Explanation, Practice
evaluation, Web UI, extension, or user-local file may change.

Consume frozen Task 1 gateway/extractor/errors and persisted Saved/transcript
evidence. Produce `analyze-saved-item-v2`, its literal v1/v2 readable predicate,
semantic candidate wire, server-derived evidence/segment IDs/times, candidate
API states, and `{retryId}` dedupe-only behavior. Do not implement historical
reader compatibility; publish the predicate for Task 5. Final persisted
`CandidateExpression` shape stays unchanged.

Use the exact Frozen Prompt Contract. The model must never receive or return
saved/snapshot/stable IDs, hashes, timestamps, or ownership. Invalid candidates
are dropped independently; omitted confidence is 0.5; omitted indexes may use
only one unique exact expression match. Unknown/conflicting evidence never gets
guessed. Provider output/grounding, exhausted short transport, timeout, and
persistence failures terminate without `nextAttemptAt` or minute backoff.

TDD: record RED before implementation, including route ownership/type/save
binding, retryId isolation, 503×2/timeout/persistence terminal behavior, and
Chinese byte preservation. GREEN:

```bash
pnpm exec vitest run src/server/ai/prompts/analyze-saved-item.v1.test.ts tests/contract/ai/saved-analysis.test.ts tests/integration/jobs/process-jobs.test.ts tests/integration/knowledge/source-traceability.test.ts
pnpm typecheck
git diff --check
```

Typecheck may retain only the same seven unrelated baseline Practice fixture
errors; no new error. No full suite/build/database/Playwright/real Provider.

YouTube Digest MIT pin is
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`; do not touch extension code. LLM
Wiki GPLv3 pin is `723e259309aea5e3850265b631f80224f66dd9f6`;
reuse method only and copy no code/test/prompt/component/asset.

Commit implementation plus handoff. Return SHA, RED/GREEN, exact files,
consumer-chain impact, risks, and report path. Do not merge/rebase/push.
