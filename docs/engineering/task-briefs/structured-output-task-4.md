# Structured Output Reliability — Task 4 Brief

- Plan/task: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 4.
- Baseline: `7c935753280786cbf9697feea0ea9eb4369a5a25`.
- Branch/worktree: `codex/structured-output-task-4` at `/private/tmp/popcorn-structured-output-task-4`.

Implement only Practice activation v2 and evaluation v3 wire/prompt/server
decision behavior shared by original, revision, and Due Practice.

Allowed files are exactly the Task 4 Files list plus
`docs/engineering/handoffs/structured-output-task-4.md`. No migration,
contract, root config, lockfile, other model operation, Saved/Web UI, extension,
or user-local file may change.

Consume frozen Task 1 gateway/extractor/errors and existing strict Practice
domain/persistence contracts. Produce activation/evaluation latest versions,
literal readable-version constants/predicates, one activation normalizer, one
shared evaluation normalizer, and `derivePracticeDecision`. Do not implement
historical repository reads; Task 5 owns that seam. Persisted task/evaluation,
Vault, mastery, and schedule schemas remain unchanged.

Use the exact Frozen Prompt Contract and all 15 rubric anchors verbatim.
Activation model output is only `promptChinese`; fixed instructions/goal and
identity are server-owned. Evaluation model output is only three mandatory
score/English-feedback dimensions plus optional grounded Chinese revision.
Program derives `passed = all scores >= 3` and
`independentUse = passed && assistanceLevel === "none"` for original,
revision, and Due. A valid non-pass is learning feedback, not a system error.

TDD: record RED before code for 3/3/3 pass, any score 2 fail, assisted pass not
independent, prose/wrapper/feedback alias/string score tolerance, mandatory
score failure, prompt injection isolation, optional coaching discard, and
identical original/revision/Due decisions. GREEN:

```bash
pnpm exec vitest run src/server/ai/prompts/evaluate.v1.test.ts tests/integration/practice/attempts.test.ts src/server/domain/complete-due-practice.test.ts
pnpm typecheck
git diff --check
```

Typecheck may retain only the same seven unrelated baseline Practice UI fixture
errors; no new error. No full suite/build/database/Playwright/real Provider.

YouTube Digest MIT pin is
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`; do not touch extension code. LLM
Wiki GPLv3 pin is `723e259309aea5e3850265b631f80224f66dd9f6`;
reuse method only and copy no code/test/prompt/component/asset.

Commit implementation plus handoff. Return SHA, RED/GREEN, exact files,
consumer-chain impact, risks, and report path. Do not merge/rebase/push.
