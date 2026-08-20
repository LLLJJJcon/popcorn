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

The controller-created untracked `node_modules` dependency symlink was removed
before the review-fix commit and is not part of either candidate.

## Independent review repair 1

- Review-fix brief:
  `docs/engineering/briefs/batch-a/task-5-review-fix-1.md`.
- Reviewed candidate: `25bea5ae21815e7ade2c4abb3db3a85319cb1af4`.
- Fix baseline (brief commit): `0c17100693421d3ec58e8f3e7d8fe737b1d4c2e2`.
- Fix worktree: `/private/tmp/popcorn-batch-a-5-fix`; branch:
  `codex/popcorn-batch-a-5-fix`.

The independent review found one blocker: the existing tests called pure
builders/controllers directly, so deleting or contaminating a real UI handler
could still leave the suite green. The unused second argument to
`createSaveController` also meant the purported forbidden-call double was not
installed at any dependency read by production.

The repair drives the actual DOM event listeners used at runtime:

- Save Video through `setupEventListeners` and a real button click;
- subtitle row Save through the rendered bilingual transcript row;
- subtitle selection Save through a real DOM `Range`, document `mouseup`, and
  tooltip click;
- Key Quote Save through `renderAnalysisResults` and the rendered quote button;
- AI Explanation Save through the rendered explanation modal button;
- player moment through both the actual overlay click listener and registered
  `n` keyboard listener.

Each handler test independently asserts one exact literal payload and one queue
call. The harness replaces the production-named `enqueueSavedItem` boundary,
installs throwing dependencies at the globals/functions production reads for
`fetch`, Provider, transcript, translation, historical `saveNote`, and legacy
cache persistence, and rejects any unexpected Chrome runtime persistence.
Playback time/paused state, pause/play calls, transcript seek, URL, form submit,
and propagation behavior are asserted directly.

Review-repair RED:

```bash
node --test extension/tests/digest-button.test.js extension/tests/save-payloads.test.js
```

Against the reviewed candidate, 19 tests ran: 14 passed and the five new Side
Panel production-handler tests failed with zero observed queue calls. Player
overlay and keyboard handler tests were already able to observe their live
boundary and passed. This isolated the root cause to Side Panel controller
construction capturing the original queue function before the handler harness
could replace the production dependency.

The minimal production repair is one late-binding adapter at Side Panel
controller construction: it calls the same `enqueueSavedItem` function at save
time instead of capturing its load-time function value. No parallel save path,
handler, queue, button, or test-only production method was added.

Review-repair GREEN and proportionate verification:

- focused real-handler/payload suite: 19/19 passed;
- transcript/translation/release regression: 33/33 passed;
- provenance: 2 files, 11/11 passed;
- `node --check extension/content.js`: exit 0;
- `node --check extension/sidepanel.js`: exit 0.

The repair changes only `extension/sidepanel.js`, the two allowlisted extension
test files, and this handoff. It does not edit `background.js`, Task 6 files,
shared contracts, database files, root configuration, lockfile, notices, or
the execution ledger.

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

- Original focused Task 5 command: 12/12 passed; review-fix focused command:
  19/19 passed with actual production handlers.
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
