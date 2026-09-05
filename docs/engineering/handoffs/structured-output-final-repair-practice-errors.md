# Structured Output Final Repair A Handoff

- Plan/finding: Structured Output Reliability final review, Important 1.
- Execution baseline: `4c8ea39bdf861271098606b1274257c5a69b0d38`.
- Worktree: `/private/tmp/popcorn-structured-output-final-practice-errors`.
- Branch: `codex/structured-output-final-practice-errors`.

## Outcome

Activation, original/revision evaluation, and Due evaluation now preserve the
safe `ModelGatewayError.stage` distinction through the existing Practice HTTP
failure envelope. One shared `practiceErrorFromUnknown` mapper owns all stage
classification. It also maps resolver failures before Provider invocation.

- `rate_limit` becomes `PROVIDER_RATE_LIMITED`;
- `transport`, `timeout`, `provider_http`, and `response_envelope` become
  `PROVIDER_UNAVAILABLE`;
- `json_extract`, `wire_schema`, and `grounding` become
  `PROVIDER_OUTPUT_INVALID`;
- `persistence` and unexpected errors become `INTERNAL_ERROR`.

The HTTP policy is `429/true`, `503/true`, `422/false`, and `500/true`
respectively. `retryable: false` prevents automatic repetition of an invalid
model response; an explicit learner-triggered Retry remains a separate UI
action and may start a new request.

Activation's local learner-first check now raises a safe grounding-stage
`ModelGatewayError` instead of an unclassified `TypeError`. Responses contain
only stable copy and the public code; model/provider exception text and field
paths are not returned. Gateway-required handling is unchanged. No Practice
task, evaluation, decision, coaching, persistence, mastery, schedule, prompt,
or API success shape changed.

## TDD evidence

RED command (the worktree reused an already-installed dependency directory and
therefore invoked the same Vitest binary directly):

```bash
node_modules/.bin/vitest run tests/integration/practice/attempts.test.ts src/server/domain/complete-due-practice.test.ts
```

RED: `68 passed, 30 failed` across two files. All 30 failures were the expected
classification mismatch: the pre-fix boundary collapsed every table row in
Activation, original/revision, and Due to HTTP 503 plus
`PROVIDER_OUTPUT_INVALID`.

GREEN with the same command: `98 passed, 0 failed` across two files.

TypeScript:

```bash
node_modules/.bin/tsc --noEmit
```

Result: exit 0, no diagnostics.

Tests cover every documented stage plus an unexpected sentinel through the
real HTTP handlers. They assert exact public code/status/retryability, no raw
sentinel disclosure, and no draft/attempt/completion persistence for the
failed model evaluation.

## Scope, reuse, and risks

- Only the five allowed implementation/test files and this handoff changed.
- No dependency, lockfile, migration, root config, Web, extension, contract,
  prompt, or ledger file changed.
- No upstream implementation was needed. The pinned YouTube Digest MIT reuse
  remains untouched; no GPLv3 LLM Wiki code, tests, prompts, components, or
  assets were copied.
- Verification is intentionally scoped to the two brief-named test files and
  TypeScript. No full suite, database, browser, or real Provider run was made.
- Residual risk: external UI copy may choose to specialize these public codes;
  the API envelope remains schema-compatible and exposes no internal stage.
