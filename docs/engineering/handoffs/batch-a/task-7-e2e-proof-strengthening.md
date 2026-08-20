# Batch A Task 7 E2E proof strengthening handoff

## Scope

- Baseline: `d91b9c3b7aa96a8b85a408b50fb99f7297bc6838`
- Acceptance-test-only changes in the two approved extension E2E files.
- No production, configuration, migration, lockfile, ledger, or upstream-log changes.

## Proof added

- Captures deeply immutable sync events grouped by kind and checks one complete, exact payload for each of the six primary save kinds, including the complete field set, exact values, valid timestamps/UUIDs, and six distinct client event IDs.
- Wraps every save action with exact YouTube and Side Panel URL checks, main-frame navigation tracking, new-page tracking, persistent page-count equality, dialog tracking, transient/new form detection, visible-form equality, exact playback-state equality, and successful sync acknowledgement.
- Snapshots exact Popcorn transcript, translation, overview, and explanation request-category counters immediately before every save and proves the counters are unchanged after that save's acknowledgement.
- Tracks the original identities of both rapid dropped-ack `player_moment` events and proves they are distinct, attempted before worker termination, retried at least twice under their original IDs, successfully acknowledged, and drained from pending storage.

## RED mutation evidence

All mutations were temporary and reverted before GREEN:

1. Stored `subtitle_row.originalChinese` changed to `MUTATED`: Playwright failed at the exact payload comparison, showing expected `这也太离谱了吧。` and received `MUTATED`.
2. The second rapid event's tracked ID was suffixed with `-mutated` in the recovery check: Playwright failed the all-event recovery assertion with expected `true`, received `false`.
3. Each sync route temporarily incremented the explanation request counter: the first save failed the per-save artifact-count equality with explanation changing from `0` to `1`.
4. Each save temporarily opened an `alert("MUTATED")`: the first save failed the dialog-count assertion with expected length `0`, received `1` and message `MUTATED`.

## GREEN verification

- ESLint (`node_modules/.bin/eslint tests/e2e/extension/acquisition-save.spec.ts tests/e2e/extension/fixtures.ts`): exit 0.
- TypeScript (`node_modules/.bin/tsc --noEmit --pretty false`): exit 0.
- Playwright host run (`node_modules/.bin/playwright test tests/e2e/extension/acquisition-save.spec.ts --project=chromium-extension`): 1 passed (4.9s).
- `git diff --check`: exit 0.
- `git status --short` before handoff/commit contained only the two approved test files plus the temporary `node_modules` symlink; the symlink is removed before commit.

The workspace `pnpm` shim attempted an interactive dependency purge when used with the borrowed `node_modules` symlink, so verification used the equivalent project-local executables without modifying the shared dependency directory.

## Independent-review repair

Independent review of candidate `dfcf827` found that the form observer queried only the final DOM and therefore missed a form synchronously appended and removed before the observer callback ran.

- Survivor reproduction: temporarily appended `<form>` and immediately removed it inside the `video` save action; the pre-fix Playwright test incorrectly remained GREEN (`1 passed`, 5.2s).
- RED after adding the expectation enforcement: with the same temporary mutation retained, the MutationRecord-based observer permanently marked the added form and Playwright failed at `expect(formOpened).toBe(false)` with expected `false`, received `true`.
- Fix: inspect every `MutationRecord.addedNodes` entry and mark detection when the node itself is a form or its subtree contains a form. Existing visible-form and final-state checks remain intact.
- The temporary append/remove mutation was removed before final GREEN.
- Follow-up GREEN: ESLint exit 0; TypeScript exit 0; Playwright `1 passed` (4.8s); `git diff --check` exit 0.

## Residual risks

- This remains a deterministic, fixture-backed Chromium acceptance test; it does not exercise live YouTube or Provider availability.
- Exact payload assertions intentionally make schema/contract changes require an explicit test update.
- Chromium launch requires host execution in this sandboxed environment.

No self-approval performed.
