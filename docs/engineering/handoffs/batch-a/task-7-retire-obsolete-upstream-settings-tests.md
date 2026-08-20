# Batch A Task 7 repair handoff: retire obsolete upstream settings tests

## Scope and baseline

- Controller baseline: `742dfef3b2d26d877dece9be85c3e424484c47ea`.
- Deleted only the two upstream scaffold tests that assert the retired extension-local provider settings surface.
- Updated only their test mappings in `extension/UPSTREAM.md`; provenance for YouTube Digest commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7` remains explicit.
- No production code, configuration, lockfile, migration, or ledger was changed.

## RED evidence

Before deletion:

```text
node --test extension/tests/options-language.test.js extension/tests/settings.test.js
tests 12; pass 0; fail 12; exit 1
```

The failures required the retired language/customization prompt UI, extension-local Supadata/DeepSeek credentials, a fixed DeepSeek model, or Supadata URL construction.

## GREEN evidence

```text
node --test extension/tests/*.test.js
tests 92; pass 92; fail 0
```

The isolated worktree initially lacked `jsdom`, so the permitted temporary `node_modules` symlink to the integration worktree was used. The symlink is removed before commit.

```text
./node_modules/.bin/vitest run tests/contract/model-gateway.test.ts tests/integration/model-gateway/settings-api.test.ts tests/integration/model-gateway/settings-service.test.ts tests/integration/model-gateway/settings-web-auth.test.ts tests/integration/model-gateway/runtime-resolver.test.ts
test files 5 passed; tests 57 passed
```

The brief's `pnpm exec vitest ...` spelling was attempted first, but the environment-owned `pnpm` wrapper aborted before Vitest because it wanted to rebuild the symlinked modules directory without a TTY. Running the exact installed Vitest binary exercised the same five files without changing dependencies.

## Replacement evidence

- `extension/tests/auth.test.js` covers the exact account-only Options surface and absence of provider/API-key controls.
- `extension/tests/worker-restart.test.js` covers session, sync, and discard behavior.
- `extension/tests/release.test.js` covers absence of runtime provider credential dependencies.
- `tests/contract/model-gateway.test.ts` and `tests/integration/model-gateway/*.test.ts` cover authenticated user gateway/model settings, Vault-backed key resolution, and runtime consumption.
- `tests/e2e/extension/acquisition-save.spec.ts` covers explicit sign-in and cloud-backed capture.

## Residual risk

The deleted tests no longer provide coverage for the original upstream provider/options UI by design. Current Popcorn behavior remains covered by the replacement tests above. No runtime behavior changed in this repair.

## Review note

This implementation has not self-approved; an independent reviewer must inspect the baseline-to-HEAD diff and verification evidence.
