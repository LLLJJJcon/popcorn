# Structured Output Final Repair A — Practice Error Classification

- Finding: final review Important 1.
- Product baseline: `bcfcd2a5d7e3fb5c7e117a73d46c1d2041c888b1`.
- Execution baseline: controller commit containing this brief; record exact SHA.
- Worktree: `/private/tmp/popcorn-structured-output-final-practice-errors`.
- Branch: `codex/structured-output-final-practice-errors`.

## Required behavior

Activation, original/revision Evaluation, and Due Evaluation must preserve the
safe failure distinction supplied by `ModelGatewayError`:

- `rate_limit` -> public `PROVIDER_RATE_LIMITED`;
- `transport`, `timeout`, `provider_http`, `response_envelope` -> public
  `PROVIDER_UNAVAILABLE`;
- `json_extract`, `wire_schema`, `grounding` -> public
  `PROVIDER_OUTPUT_INVALID`;
- persistence/unexpected internal failures -> public `INTERNAL_ERROR`.

Do not expose raw exception/model/provider text. Keep retryability honest and
stable. The same mapping must govern Activation, original/revision attempts,
and Due; do not create three drifting copies. Existing malformed/ungrounded
fixture output remains model-output-invalid. Gateway configuration absence stays
`MODEL_GATEWAY_CONFIGURATION_REQUIRED`. No domain evaluation/decision/persistence
shape changes.

## Allowed files

- `src/server/domain/create-practice-task.ts`
- `src/server/repositories/attempt-repository.ts`
- `src/server/domain/complete-due-practice.ts`
- `tests/integration/practice/attempts.test.ts`
- `src/server/domain/complete-due-practice.test.ts`
- `docs/engineering/handoffs/structured-output-final-repair-practice-errors.md`

Everything else is forbidden, including contracts, prompts, API route modules,
migrations/types, Web/extension, config/dependencies/lockfile/ledger.

## TDD and focused verification

First add table-driven RED for every stage/code mapping through the HTTP error
response and for each of the three execution paths, asserting no persistence on
failure and no raw sentinel text. Then implement the smallest shared mapper.

```bash
pnpm exec vitest run tests/integration/practice/attempts.test.ts src/server/domain/complete-due-practice.test.ts
pnpm typecheck
git diff --check <execution-baseline>..HEAD
git status --short
```

No full suite/browser/DB/Provider. Commit implementation + handoff; return SHA,
RED/GREEN/typecheck/risks/clean. No merge/rebase/push.

No upstream code is needed. Preserve YouTube Digest MIT pin `d03e1f...`; copy
nothing from GPLv3 LLM Wiki commit `723e259...`.
