# Delivery Task 5J — Overview v3 bounded single-text request handoff

## Scope

- Implementation baseline: `09aa0ccdefbac4b37dcea3dfb8b79e4efe98203a`
  (the Task 5J brief commit, following feature baseline `ca73c4b`).
- Changed only the brief allowlist: the OpenAI-compatible adapter, the
  historical-path Overview prompt module, the focused integration test, and
  this handoff.
- No extension, route, database, migration, generated type, worker/backoff,
  gateway storage/key, root configuration, dependency, lockfile, translation,
  or explanation semantic change was made.

## Delivered behavior

- Overview is versioned exactly as `youtube-overview-v3`, separating its
  semantic job identity from v1/v2 terminal and retry results.
- One compact user prompt contains every persisted Chinese segment once in
  chronological persisted order. Each line has only its zero-based global
  `sourceLineIndex` and complete original Chinese text; no stable ID, user ID,
  source/snapshot ID, gateway metadata, or per-line timestamp is sent.
- Overview still makes exactly one Provider completion call. Only that request
  adds the standard OpenAI-compatible `max_tokens: 1800` field; translation and
  explanation request bodies remain unchanged.
- The strict internal Overview response accepts one `sourceLineIndex` for each
  chapter and key quote and rejects returned timestamps, block indexes, IDs,
  or other extra fields. The index maps directly to exactly one persisted
  segment, whose real `startSeconds` becomes the public `timestampSeconds` and
  whose real stable ID becomes the sole `sourceSegmentIds` entry.
- The unchanged public `validateOverviewContent` remains the final grounding
  gate, so out-of-range lines, mismatched quotes, and fabricated anchors fail
  closed as `PROVIDER_OUTPUT_INVALID`.
- The prompt asks for a concise whole-video result with 1–8 chapters and
  exactly 3–5 quotes, with each Chinese quote an exact substring of its
  anchored line. Existing public output field limits were not changed.
- Existing 120,000 ms Overview timeout, 30,000 ms generic timeout, 65,536-byte
  request cap, and 524,288-byte response cap remain unchanged.

## TDD record

### RED

After adding the Task 5J tests and before changing production code, this exact
command was run:

```text
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts
```

Result: `1 failed` test file; `5 failed | 66 passed (71)` tests. The v3-only
Overview fixtures failed with `ModelGatewayError: PROVIDER_OUTPUT_INVALID`
because the v2 gateway schema still required Provider timestamps and block
indexes. The semantic identity assertion also reported:

```text
Expected: "youtube-overview-v3"
Received: "youtube-overview-v2"
```

### GREEN

After the minimal provider and prompt changes, the same command passed:

```text
Test Files  1 passed (1)
Tests       71 passed (71)
```

The focused coverage proves all 815 complete Chinese rows appear exactly once
and in order, first and last rows survive, the JSON request remains below
65,536 bytes, one fetch occurs, only Overview has exactly one
`max_tokens: 1800`, and global lines map to real IDs/start times or fail closed.

## Verification

```text
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts
PASS: 1 file, 71/71 tests

pnpm eslint src/server/ai/openai-compatible-provider.ts src/server/ai/prompts/youtube-overview.v1.ts tests/integration/youtube/learning-artifacts.test.ts
PASS: exit 0

pnpm typecheck
PASS: `tsc --noEmit`, exit 0

git diff --check ca73c4b89974cce5e3e9f56ed3333da3311e183a..HEAD
PASS: exit 0 after the implementation commit
```

## Boundaries, license, and residual risk

- No GPLv3 LLM Wiki code, tests, prompts, components, or assets were reused.
  No dependency or third-party code was added, and existing notices remain
  unchanged.
- No live Provider egress was performed. The deterministic integration fixture
  covers request size/count/privacy, body shape, strict response parsing, and
  persisted evidence grounding; real model latency and response quality remain
  external risks within the unchanged two-minute Overview budget.
- The line protocol assumes each persisted transcript segment is represented by
  its complete stored text on one prompt line, matching the accepted 815-row
  evidence shape.
