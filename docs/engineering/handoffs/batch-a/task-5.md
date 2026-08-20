# Batch A Task 5 Handoff — Exact YouTube Save Entrypoints

## Scope and baseline

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 5.
- Brief: `docs/engineering/briefs/batch-a/task-5.md`.
- Accepted product baseline: `0449cc7`.
- Worktree start (brief included): `8c8b2f3`.
- Candidate head: the commit with subject `feat: save exact YouTube learning moments` containing this handoff.
- Worktree: `/private/tmp/popcorn-batch-a-5`; branch: `codex/popcorn-batch-a-5`.

Only the Task 5 allowlist changed:

- `extension/content.js`
- `extension/sidepanel.js`
- `extension/sidepanel.html`
- `extension/sidepanel.css`
- `extension/tests/digest-button.test.js`
- `extension/tests/save-payloads.test.js`
- `docs/engineering/handoffs/batch-a/task-5.md`

`node_modules` remains the controller-created untracked dependency symlink and
is not part of the candidate.

## RED evidence

Command:

```bash
node --test extension/tests/digest-button.test.js extension/tests/save-payloads.test.js
```

Result before production edits: 12 tests ran, 5 passed and 7 failed. The seven
expected failures were missing `__YTD_SAVE_TESTING__`,
`buildVideoSaveInput`, `savePlayerMoment`, subtitle/quote/explanation builders,
and `createSaveController`. The pre-existing Digest reconciliation tests stayed
green, proving RED was caused by the absent Task 5 behavior rather than a
harness or syntax error.

## Minimal implementation

- `content.js` retains the upstream player overlay, `n` shortcut, three-second
  reaction delay, and toast lifecycle. `saveCurrentNote` now builds only the
  frozen `player_moment` input and calls the `enqueueSavedItem` message port;
  it reads but never pauses or seeks the player.
- The Side Panel adds Save Video, row-hover Save, selected-text Save, exact Key
  Quote Save, and Save Explanation controls in the existing panel and modal.
  These controls stop their own pointer event where needed, preserving the
  existing transcript selection and seek behavior.
- Bounded builders construct only the six frozen variants. Canonical video URL
  and thumbnail are derived from the validated 11-character YouTube ID.
  Malformed IDs, generic/non-YouTube URLs, arbitrary thumbnails, oversized
  fields, non-Chinese evidence, non-ASCII English evidence, missing stable
  segments, invalid ranges, and incomplete cross-line projection fail before
  the queue port.
- Subtitle row/selection and explanation payloads keep up to three neighboring
  native-Chinese context rows. Selection offsets are the existing exact UTF-16
  offsets into the complete projected native-row context; no English selection
  is guessed from a bilingual row.
- Queue feedback is limited to `Saving…`, `Saved to Popcorn`,
  `Saved locally; sign in to sync`, or `Retry save`. No save path calls fetch,
  transcript, translation, AI, the historical `saveNote`, or persistence
  directly.

## Upstream reuse and license

Pinned source: `zarazhangrui/youtube-digest` commit
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT.

- `content.js:extractVideoInfo` remains the DOM fallback for title, channel,
  duration, and description.
- `findDigestButtonHost`, `createDigestButton`, `injectDigestButton`,
  `scheduleDigestButtonReconciliation`, and `setupButtonObserver` remain in
  place; the copied Digest regression harness remains active.
- `injectNoteButton`, `handleNoteKeyboardShortcut`, `saveCurrentNote`, and
  `showNoteSavedToast` were adapted in place rather than replaced by a second
  player control or save UI.
- `background.js:getPlayerVideoDetails` is consumed unchanged through the
  existing trusted `relayToContent/getVideoInfo` contract; Task 5 did not edit
  `background.js`.
- `sidepanel.js:saveQuoteAsNote` and the existing transcript selection and
  explanation modal were adapted in place. No parallel Side Panel, metadata
  extractor, seek path, or toast was introduced.

`extension/UPSTREAM.md`, `third_party/youtube-digest/LICENSE`, and
`THIRD_PARTY_NOTICES.md` are unchanged. LLM Wiki
`v0.6.9@723e259309aea5e3850265b631f80224f66dd9f6` supplied no copied material:
no GPLv3 code, tests, prompt, component, asset, naming, or structure was used.

## GREEN and verification evidence

- Focused Task 5 command: 12/12 passed.
- Existing extension regression command covering selection, translation, and
  release: 33/33 passed.
- Provenance gate: 2 files, 11/11 passed.
- `node --check extension/content.js` and
  `node --check extension/sidepanel.js`: both exited 0.
- `git diff --check`: exited 0.
- Scope inspection found only the seven allowlisted paths above; no contract,
  migration, root config, lockfile, ledger, server, auth/session, or Task 6
  owned file changed.

Per the risk-calibrated brief, this extension-only task did not run a database
reset, pgTAP, or production build. The controller will run the broader
extension integration gate after Tasks 5 and 6 are both independently accepted.

## Remaining integration risks

- Task 6 must bind the `enqueueSavedItem` action to its durable queue for both
  the trusted Side Panel and the exact YouTube watch content sender used by the
  player-moment overlay. The Task 6 agent received this interface note.
- A real unpacked-Chrome smoke remains useful for hover/focus placement and
  player/Side Panel sender identity. Automated tests cover payloads, no-seek/no-
  pause behavior, selection preservation, and existing Digest reconciliation.
- This task does not self-approve. Independent review must inspect the complete
  diff from `8c8b2f3` and the controller must integrate only after PASS.
