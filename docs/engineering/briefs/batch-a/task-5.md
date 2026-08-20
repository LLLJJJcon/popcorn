# Batch A Task 5 Brief — Exact YouTube Save Entrypoints

## Task, baseline, and isolated workspace

- Canonical plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 5.
- Integration baseline: `0449cc7` (accepted Batch A Task 3 plus ledger checkpoint).
- Worktree: `/private/tmp/popcorn-batch-a-5`.
- Branch: `codex/popcorn-batch-a-5`.
- Parallel Task 6 owns `background.js`, `options.js`, `manifest.json`, `sync-queue.js`, and its tests. Do not edit those files.

Implement only this numbered task. Start with failing tests and preserve RED output, make the minimum implementation, preserve GREEN output, commit it, and write the handoff named below.

## Allowed files

- `extension/content.js`
- `extension/sidepanel.js`
- `extension/sidepanel.html`
- `extension/sidepanel.css`
- `extension/tests/digest-button.test.js`
- `extension/tests/save-payloads.test.js` (create)
- `docs/engineering/handoffs/batch-a/task-5.md` (create)

Every other file is forbidden, including `background.js`, auth/session files, contracts, migrations, generated types, server code, root configuration, lockfile, plans/specs, upstream notices/licenses, and the execution ledger.

## Frozen interfaces consumed

- The six exact `SavedItemInput` variants: `video`, `player_moment`, `subtitle_row`, `subtitle_selection`, `key_quote`, and `ai_explanation`.
- An injected/test-double `enqueueSavedItem(input)` port. Task 6 will provide the durable implementation; do not create a second queue or network path here.
- Existing Task 3 transcript/Overview/explanation state, exact stable segment IDs, timestamps, UTF-16 selection offsets, and `openSidePanel` flow.
- Existing authenticated extension architecture: content scripts never receive tokens, API keys, gateway origin/model, Vault IDs, or Provider envelopes.

## Interfaces produced

- Exact bounded payload builders for all six save kinds.
- Save Video, player moment, subtitle row, subtitle selection, Key Quote, and AI explanation interactions that call only `enqueueSavedItem`.
- Saving is background-only: it does not pause or seek playback, navigate, open a form, or synchronously call transcript/translation/AI Providers.
- Feedback is limited to `Saving…`, `Saved to Popcorn`, `Saved locally; sign in to sync`, or a concise retry state.

## Mandatory RED evidence

Before implementation, add tests and run:

```bash
node --test extension/tests/digest-button.test.js extension/tests/save-payloads.test.js
```

Expected RED: new exact-payload/save-control assertions fail because Task 5 builders and enqueue calls do not exist.

Tests must prove at least:

1. Save Video includes only validated YouTube ID, canonical URL, upstream-extracted title/channel/duration/description, thumbnail derived from the validated ID, current position, and `requestNativeSnapshot: true`.
2. Player moment subtracts the upstream three-second reaction delay and clamps at zero.
3. Subtitle row preserves exact Chinese, optional shown English, stable segment ID, start/end, and bounded context.
4. Subtitle selection preserves exact displayed Chinese/optional English, every stable segment ID, earliest/latest time, and exact UTF-16 offsets; incomplete cross-line evidence fails closed.
5. Key Quote saves the exact displayed quote and its referenced timestamp/segments; AI explanation saves exact selected Chinese plus the shown English explanation and evidence.
6. Arbitrary thumbnail URLs, non-YouTube/generic URLs, text/image/screenshot inputs, malformed video IDs, missing evidence, and oversized payload fields fail closed before enqueue.
7. Every save calls the injected queue port once and never calls fetch, transcript, translation, AI, old `saveNote`, or a direct persistence path.
8. Save controls preserve playback state and existing seek/selection behavior; Digest button behavior remains regression-covered.

## Upstream reuse and license

Pinned MIT upstream: `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`.

Adapt in place and preserve recognizable behavior from:

- `content.js:extractVideoInfo`, `findDigestButtonHost`, `createDigestButton`, `injectDigestButton`, `scheduleDigestButtonReconciliation`, `setupButtonObserver`, `injectNoteButton`, `handleNoteKeyboardShortcut`, `saveCurrentNote`, `showNoteSavedToast`;
- `background.js:getPlayerVideoDetails` as a consumed message contract only—Task 5 must not edit `background.js`;
- `sidepanel.js:saveQuoteAsNote` and existing selection/explanation presentation.

Do not regenerate parallel buttons, metadata extraction, seek logic, toasts, or a second Side Panel. Preserve existing MIT notices unchanged.

`nashsu/llm_wiki` `v0.6.9@723e259309aea5e3850265b631f80224f66dd9f6` is GPLv3 and method-only inspiration. Copy no GPL code, tests, prompts, components, assets, names, or structure.

## GREEN and verification

```bash
node --test extension/tests/digest-button.test.js extension/tests/save-payloads.test.js
node --test extension/tests/transcript-selection.test.js extension/tests/translation.test.js extension/tests/release.test.js
./node_modules/.bin/vitest run tests/provenance --passWithNoTests
git diff --check
git status --short
```

Use focused tests during implementation. Do not run DB reset, pgTAP, or production build: this task changes extension UI/payload code only. The controller will run one broader integration gate after both Tasks 5 and 6 are accepted.

Commit message: `feat: save exact YouTube learning moments`.

Handoff must report baseline/head, changed files, RED/GREEN commands and counts, exact upstream functions reused and how, license statement, unresolved risks, and path `docs/engineering/handoffs/batch-a/task-5.md`. Return the commit SHA and do not self-approve.
