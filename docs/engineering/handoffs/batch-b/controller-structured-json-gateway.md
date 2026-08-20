# Batch B controller structured-JSON gateway handoff

## Scope

- Brief: `docs/engineering/briefs/batch-b/controller-structured-json-gateway.md`.
- Baseline: `51a20b1`; implementation worktree: `/private/tmp/popcorn-youtube-learning`.
- Changed only the existing OpenAI-compatible adapter, one new server-only resolver,
  one focused integration test, and this handoff.

## Contract produced

- `createOpenAiCompatibleStructuredJsonClient` is the single bounded JSON transport
  used by both the existing learning-artifact provider and new Batch B consumers.
- `createStructuredJsonGatewayResolver` returns only `model` and
  `complete(promptVersion, prompt)` for an exact owner/config pin.
- The CI branch returns the caller-supplied deterministic fixture before constructing
  a runtime resolver, reading config/Vault, or invoking fetch.
- The live branch reuses `ModelGatewayRuntimeResolver`, then the existing fixed
  `/chat/completions` adapter with configured model, bearer credential, redirect
  rejection, timeout, bounded request/response, UTF-8 decoding, and strict JSON-only
  assistant envelope behavior.
- Consumers never receive an API key, URL, header, raw config, or Vault reference.
  Errors remain `PROVIDER_UNAVAILABLE` or `PROVIDER_OUTPUT_INVALID` without secret text.
- Existing Overview/translation/explanation behavior and prompts are unchanged.

## TDD evidence

RED:

```text
./node_modules/.bin/vitest run \
  tests/integration/model-gateway/structured-json-gateway.test.ts
FAIL: cannot resolve @/server/ai/structured-json-gateway
```

GREEN:

```text
./node_modules/.bin/vitest run \
  tests/integration/model-gateway/structured-json-gateway.test.ts \
  tests/integration/model-gateway/runtime-resolver.test.ts \
  tests/integration/youtube/learning-artifacts.test.ts
Test Files 3 passed; Tests 73 passed

./node_modules/.bin/tsc --noEmit --pretty false
exit 0

fixed-test-environment ./node_modules/.bin/next build --webpack
exit 0; 19/19 routes/pages generated

git diff --check
exit 0
```

No database reset, pgTAP, or full application suite was repeated because this
contract changes no persisted schema, queue, route authentication, root config, or
lockfile.

## Consumer guidance

- Task 1 supplies a deterministic saved-analysis fixture and uses the resolver only
  after reading the claimed job owner and immutable gateway pin.
- Task 4 supplies deterministic activation/evaluation fixtures and resolves the
  exact active owner pin immediately before each live outbound operation.
- Task-specific prompt builders, schemas, evidence validation, retries, caches, and
  persistence stay in their own non-overlapping task files.
- Fixture outputs still require the same task-specific schema/evidence validation as
  live results; fixture mode is not a validation bypass.

## Risks and license

- Real Provider egress remains a Delivery-only manual smoke after local acceptance;
  no live endpoint was contacted here.
- The adapter kind remains the approved `openai-compatible`; adding another wire
  protocol requires a new reviewed registry entry, not a consumer-supplied URL/path.
- No YouTube Digest or LLM Wiki code, prompts, tests, components, or assets were copied.
- Independent review is still required; this handoff is not self-approval.
