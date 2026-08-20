# Batch A Task 7 repair: retire obsolete upstream provider/options tests

## Scope

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 7 integration gate.
- Baseline commit: `5105c4f`.
- Worktree: assigned by the controller.
- Purpose: remove two scaffold-era tests that require the retired YouTube Digest local-provider settings surface and contradict Popcorn's frozen account-linked extension contract.

## Allowed files

- `extension/tests/options-language.test.js` (delete)
- `extension/tests/settings.test.js` (delete)
- `extension/UPSTREAM.md` (update the test mapping only)
- `docs/engineering/handoffs/batch-a/task-7-retire-obsolete-upstream-settings-tests.md` (create)

All other files are forbidden. Do not modify production code, root config, lockfiles, migrations, or the execution ledger.

## Contract rationale

The obsolete tests assert that the extension Options page:

- stores Supadata and DeepSeek API keys locally;
- configures a DeepSeek-only provider/model/base URL;
- exposes an English/Chinese customization prompt for changing providers.

Those assertions are now explicitly forbidden. The frozen Batch A contract requires the extension Options page to expose only Popcorn account/session, sync status, discard-pending, and bounded-cache controls. User-named model gateway, model and API key configuration live in the authenticated Popcorn Web settings surface; the worker resolves the user's Vault-backed key server-side.

Current replacement evidence:

- `extension/tests/auth.test.js`: exact account-only Options surface and no provider/API-key controls.
- `extension/tests/worker-restart.test.js`: Options UI session/sync/discard behavior.
- `extension/tests/release.test.js`: no runtime provider credential dependency.
- `tests/contract/model-gateway.test.ts`: user gateway/model configuration contracts.
- `tests/integration/model-gateway/*.test.ts`: authenticated settings, Vault-backed resolution, and runtime use.
- `tests/e2e/extension/acquisition-save.spec.ts`: explicit extension sign-in and cloud-backed capture flow.

Do not weaken, skip, or rewrite assertions to preserve retired behavior. The two obsolete test files must be deleted, and `extension/UPSTREAM.md` must record that their upstream behavior was superseded with the replacement test paths above.

## RED evidence

Before deletion, run:

```bash
node --test extension/tests/options-language.test.js extension/tests/settings.test.js
```

Expected RED: 12/12 failures requiring retired provider/options behavior.

## GREEN verification

After deletion/update, run only:

```bash
node --test extension/tests/*.test.js
pnpm exec vitest run tests/contract/model-gateway.test.ts tests/integration/model-gateway/settings-api.test.ts tests/integration/model-gateway/settings-service.test.ts tests/integration/model-gateway/settings-web-auth.test.ts tests/integration/model-gateway/runtime-resolver.test.ts
git diff --check
git status --short
```

No full database reset is needed: this is test/provenance maintenance with no production or migration change.

## Upstream and license requirements

- YouTube Digest source: `zarazhangrui/youtube-digest` at `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
- Preserve provenance; update the mapping instead of pretending the upstream tests remain applicable.
- LLM Wiki GPLv3 code, tests, prompts, components, and assets must not be copied.

## Handoff

Commit the scoped changes and return commit SHA, RED/GREEN evidence, residual risk, and handoff path. Do not self-approve.
