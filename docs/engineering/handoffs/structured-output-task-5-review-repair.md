# Structured Output Task 5 — Review Repair Handoff

## Identity

- Parent task: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 5.
- Parent execution baseline: `26c5eb36856a1e31f8c3392348b8e56a948b8b92`.
- Parent implementation: `69f10a7c823bced6b4416e53e4bfecb0163d2aae` (replayed here as `c665052`).
- Repair execution baseline: `70948055651602436847580cb45833c228d798cb`.
- Worktree: `/private/tmp/popcorn-structured-output-task-5-repair`.
- Branch: `codex/structured-output-task-5-repair`.

## Root cause and correction

The unknown Translation prompt-version fixture also used an unrelated invalid
`resultKey`. The broad `rejects.toThrow()` assertion therefore passed at the
first identity mismatch even if production ignored `prompt_version`.

The fixture now derives the exact frozen current-request key from the
Translation v2 payload, transcript hash, and gateway fingerprint, leaving
`translate-segments-v999` as the only identity mismatch. The assertion requires
the sanitized `ModelGatewayError` with code/message
`PROVIDER_OUTPUT_INVALID` and stage `grounding`; it also verifies the exact
dedupe key submitted to the already-succeeded registration and the exact owned
artifact read. The route owns neither a Provider dependency nor a publication
writer, and rejection prevents an artifact response from being published to
the consumer.

## Mutation RED

After adding the corrected test, the recovery-only expected prompt version in
`src/server/ai/provider.ts` was temporarily replaced with the stored artifact
version, simulating a production regression that ignores `prompt_version`.
The focused single-file run failed exactly one test:

```text
Test Files  1 failed (1)
Tests       1 failed | 99 passed (100)
AssertionError: promise resolved Response { status: 200 } instead of rejecting
```

The mutation was then reverted. The production file SHA-256 returned to
`59fa7680ba10b9bc32a787d6bc1a7debcef0bd3edd95f5ecd9ee94687e0cc9e9`,
and it has no working-tree diff.

## GREEN

Command:

```bash
./node_modules/.bin/vitest run --configLoader runner tests/integration/youtube/learning-artifacts.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       100 passed (100)
```

The worktree temporarily links the controller's existing read-only dependency
tree. No install, network, database, browser, real Provider, or full-suite test
is part of the accepted verification.

## Scope, risk, and license

- Final source change is test-only; no production byte changed.
- The corrected test protects Translation completion recovery against unknown
  stored prompt versions whose remaining identity fields are all valid.
- Residual risk is limited to the focused-test scope requested by the brief;
  broader route behavior was not revalidated here.
- YouTube Digest remains MIT-pinned at
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7` and is not copied or changed.
- LLM Wiki remains method-only inspiration at GPLv3 commit
  `723e259309aea5e3850265b631f80224f66dd9f6`; no GPL code, test, prompt,
  component, or asset was copied.
