# Delivery Task 5I — Overview timeout and visible progress handoff

## Scope

- Baseline inspected: `ab028596557f8a6004ae5e0640d620b54fff547b`.
- Changed only the brief allowlist: the OpenAI-compatible adapter, Overview
  side-panel presentation, their focused tests, and this handoff.
- No database, worker/backoff, prompt/schema, route, background, dependency,
  lockfile, or contract change was made.

## RED

The test-first changes were added before implementation.

1. Command: `pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts`

   The first sandboxed attempt could not create Vite's task-local
   `node_modules/.vite-temp`; the same command was rerun with the required
   workspace-cache permission. It failed as expected: 68 tests ran, 67 passed,
   and `gives an Overview its separate timeout budget while translations keep
   the generic timeout` rejected with `ModelGatewayError:
   PROVIDER_UNAVAILABLE` at the expected Overview success assertion. This
   showed the Overview request was still controlled by the generic 5 ms test
   budget rather than its separate 25 ms injected budget.

2. Command: `node --test extension/tests/translation.test.js`

   The deterministic pending-response test failed as expected: 48 tests ran,
   47 passed, and `a pending Overview keeps a two-minute progress message
   while it starts and resumes` found `overviewText` equal to the empty string
   instead of matching `generating overview.*about two minutes`.

## GREEN

### Implementation

- Added the Overview-only default request budget of exactly `120_000` ms.
  `timeoutMs` still defaults to exactly `30_000` ms and remains the generic
  configuration/test seam used by translation and explanation requests.
- Added the minimal adapter-only `overviewTimeoutMs` seam for short,
  deterministic tests. It is not an environment variable or user setting.
- The Overview provider supplies that budget only to its one existing compact
  completion request. The complete transcript flow, `65_536` byte cap,
  block/line grounding, retry/resumption behavior, and ownership fence remain
  untouched.
- Replaced the inert Overview placeholder with `Generating overview — this can
  take about two minutes.` and apply that same message whenever an Overview
  request starts or resumes pending work. Failure and retry paths were not
  changed.

### Focused GREEN commands

```text
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts
PASS: 1 file, 68/68 tests (620 ms)

node --test extension/tests/translation.test.js
PASS: 48/48 tests (376 ms)
```

### Required verification commands

```text
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts
PASS: 1 file, 68/68 tests

node --test extension/tests/translation.test.js
PASS: 48/48 tests

pnpm eslint src/server/ai/openai-compatible-provider.ts tests/integration/youtube/learning-artifacts.test.ts
PASS: exit 0

node --check extension/sidepanel.js
PASS: exit 0

pnpm typecheck
PASS: `tsc --noEmit`, exit 0

git diff --check 31c2019b774896780ac291e41c0fcab589994313..HEAD
PASS: exit 0
```

## Boundaries and residual risk

- The adapter test uses a 5 ms generic and 25 ms Overview seam to prove the
  request class separation without real-minute waits. It does not exercise a
  live Provider's latency or proxy path; production remains dependent on that
  external service completing within two minutes.
- No GPLv3/LLM Wiki code, prompt, component, test, or asset was introduced.
  The existing derived YouTube Digest path was modified in place and no
  upstream notices changed.

## Fix round 1 — clear progress after terminal Overview errors

### RED

Command: `node --test extension/tests/translation.test.js`

The new failure-path coverage failed as intended: 49 tests ran, 47 passed, and
two failed. Both the existing `success: false` Overview response and a thrown
Overview request left `overviewText` as `Generating overview — this can take
about two minutes.` after their retryable chapter error was visible. This
reproduced the review finding in both current-owner terminal paths.

### Minimal change

- In the existing current-owner `success: false` branch, clear `overviewText`
  before preserving the existing chapter failure text and Retry state.
- In the existing current-owner `catch` branch, do the same before preserving
  the existing error text and Retry state.
- Stale requests still return before either UI mutation, so the stale-owner
  fence remains intact. No retry, job, timeout, prompt, or Provider behavior
  changed.

### GREEN and regression verification

```text
node --test extension/tests/translation.test.js
PASS: 49/49 tests; node --check extension/sidepanel.js PASS

pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts
PASS: 1 file, 68/68 tests

pnpm eslint src/server/ai/openai-compatible-provider.ts tests/integration/youtube/learning-artifacts.test.ts
PASS: exit 0

pnpm typecheck
PASS: `tsc --noEmit`, exit 0

git diff --check
PASS: exit 0
```

### Residual risk

The tests exercise the two terminal current-owner paths and retain the stale
owner fence. As before, they do not perform live Provider/proxy latency
testing; external generation can still exceed the two-minute presentation.
