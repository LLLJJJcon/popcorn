# Batch B controller structured-JSON gateway contract

## Assignment

- Dependency for Batch B Task 1 saved-item analysis and Task 4 practice activation/evaluation.
- Baseline: `51a20b1`.
- Worktree: `/private/tmp/popcorn-youtube-learning` on the implementation branch.
- Controller-owned shared runtime interface; feature Agents must not edit these files.

## Conflict being resolved

The existing owner-pinned gateway resolver returns a provider with only Overview,
translation, and selection-explanation operations. Task 1 and Task 4 need different
structured outputs. Without a frozen generic transport, both parallel Agents would
modify the same adapter or duplicate credential-bearing HTTP code.

## Allowed files

- `src/server/ai/openai-compatible-provider.ts`
- Create: `src/server/ai/structured-json-gateway.ts`
- Create: `tests/integration/model-gateway/structured-json-gateway.test.ts`
- `docs/engineering/handoffs/batch-b/controller-structured-json-gateway.md`

Every other file is forbidden, including contracts, migrations, generated database
types, root config/lockfile, existing prompts, feature handlers/routes, ledger, and
upstream files.

## Contract to produce

- Factor the already-tested OpenAI-compatible bounded JSON completion into an
  exported server-only client without changing existing Overview/translation/
  explanation request or validation behavior.
- Add an owner/pin-scoped `StructuredJsonGatewayResolver` that returns `{model,
  complete(promptVersion, prompt)}`.
- Runtime resolution must reuse `ModelGatewayRuntimeResolver`: exact owner,
  config ID, revision, fingerprint, active consent, approved origin, and Vault secret
  remain enforced by existing contracts.
- CI must choose a supplied deterministic fixture gateway before constructing the
  runtime resolver, reading Vault/config, or calling fetch.
- Live transport remains fixed to exact approved HTTPS origin + approved base path +
  `/chat/completions`, configured model, JSON-only assistant content, bounded request/
  response, redirect error, timeout, and `Authorization: Bearer <user API key>`.
- API key must never appear in returned values, errors, logs, test output, request
  body, job input, artifacts, or handoff.
- The abstraction is provider-neutral to consumers but adapter kind remains the
  currently approved `openai-compatible`; no arbitrary headers/paths/templates.

## TDD protocol

RED must prove the new module/interface is absent and cover:

1. CI fixture resolves/completes without constructing runtime resolver, RPC/Vault,
   or fetch.
2. Runtime resolution uses exact owner and pin, returns the configured model, and
   sends one fixed-path request through the existing bounded adapter.
3. Unsupported adapter/config/fetch/output errors fail closed with existing public
   gateway codes and never expose the key.
4. Existing learning-artifact adapter behavior remains unchanged after factoring.

Then implement the smallest reusable extraction and resolver. Do not add task-specific
prompts, candidate/evaluation schemas, caches, retries, DB writes, or UI.

## Verification

```bash
./node_modules/.bin/vitest run \
  tests/integration/model-gateway/structured-json-gateway.test.ts \
  tests/integration/model-gateway/runtime-resolver.test.ts \
  tests/integration/youtube/learning-artifacts.test.ts
./node_modules/.bin/tsc --noEmit --pretty false
fixed-test-environment ./node_modules/.bin/next build --webpack
git diff --check
```

No database reset/pgTAP/full application suite: this changes no database, queue,
route auth, or shared persisted schema. Production build is justified because the
server adapter is shared by existing routes.

## Upstream and license

- Reuse Popcorn's existing MIT-compatible OpenAI-compatible adapter; do not generate
  a parallel HTTP implementation.
- No YouTube Digest code is needed.
- LLM Wiki remains method-only; copy no GPLv3 code, tests, prompts, components, or assets.

## Handoff

Commit only allowed files. Record RED/GREEN evidence, exact extraction, consumer
guidance, remaining risks, and independent-review requirement.
