# Task 5E handoff — whole-failure transcript retry

## Delivered

- Code and tests: `948d551` (`feat: retry failed transcript translations in one job`)
- A hidden `Retry failed` action now sits immediately before `Copy` and displays the current failure count.
- One click collects the failed rendered semantic rows, marks all of them retrying, and sends their stable IDs in one authenticated translation message with one client-generated UUID retry identity.
- Returned translations are applied by stable ID only. Unknown, duplicate, missing, or stale results leave an explicit failure instead of receiving a positional guess.
- The background forwards only `snapshotId`, `segmentIds`, and the optional `retryId`. The server admits `retryId` only to the translation dedupe payload, so it makes a fresh idempotent job without altering private job input, Provider evidence, or the prompt.
- Translation request, private job, Provider-response, and artifact content paths no longer impose a four-row array ceiling. Existing 65,536-byte route and Provider request limits and the Provider response/artifact bounds still apply.

## Verification

- `node --test extension/tests/translation.test.js` — 29 passing.
- `CI=true /private/tmp/popcorn-youtube-learning/node_modules/.bin/vitest run tests/integration/youtube/learning-artifacts.test.ts tests/integration/model-gateway/runtime-resolver.test.ts` — 72 passing.
- Type check and both JavaScript syntax checks passed.

## Residual risk

Very large all-failure selections can still exceed the existing byte limits; that bounded rejection deliberately remains a row-level explicit failure rather than splitting the retry into multiple jobs or Provider calls.
