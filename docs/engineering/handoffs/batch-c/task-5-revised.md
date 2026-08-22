# Batch C revised Task 5 handoff — demo recovery and accessibility

## Assignment and scope

- Plan/task: `docs/superpowers/plans/2026-08-22-popcorn-batch-c-school-demo-revision.md`, Task 5.
- Baseline: `8bdfa2a24aa790195d39e1496b80613a94c7fe4e`.
- Original implementation worktree: `/private/tmp/popcorn-batch-c-5-revised`.
- Independent-review repair worktree:
  `/private/tmp/popcorn-batch-c-5-review-fix`, parent
  `496266e3ab8495890546c8b461236cce73c9130c`.
- Only the Task 5 allowlist was changed. Background/auth/queue/content/manifest,
  runtime configuration, Saved/Vault/deletion, migrations/types, root/lockfile,
  ledger/checkpoints, and unrelated Web files were not modified.

## Implementation

- Added one Side Panel `role=status` / `aria-live=polite` surface. The existing
  save handlers now drive truthful saving, locally queued, automatic-retry,
  sign-in-required-after-admission, organizing, and pre-queue save-failed copy
  from the queue's real response contract (`success`, `synced`, `pending`, and
  `code`).
- A real `SYNC_RETRYING` response keeps the captured Chinese learning text
  visible and exposes one generated-App `/saved` link. A rejected pre-queue
  save, including `AUTH_REQUIRED`, does not claim persistence. Retry is a
  native button and repeats the already-built save input in place; it does not
  query or manipulate playback, transcript scrolling, the active YouTube URL,
  or forms.
- A real admitted response with `success: true`, `pending: true`, and
  `code: AUTH_REQUIRED` states that the save remains queued and asks the user
  to sign in to retry. In contrast, pre-admission `AUTH_REQUIRED` is thrown by
  the queue wrapper and remains the non-persistence `save-failed` state.
- `checkCurrentTab` now performs exactly one active/last-focused-window query.
  It accepts only the current strict `https://www.youtube.com/watch` URL with
  an extractable 11-character video ID. A non-watch current tab cannot fall
  back to another active or background YouTube tab and cannot request video
  information through the relay.
- Unsupported presentation is limited to opening a current
  `youtube.com/watch` video. Options continues to use its existing status
  elements and now distinguishes queued saves that require sign-in from an
  authenticated automatic retry.
- Added one fixed generic Web `ErrorState`. It accepts only a request ID and a
  semantic link-or-button recovery action; it has no error-detail/provider
  input and displays no internal failure detail.

## TDD evidence

Initial RED:

```bash
NODE_PATH=/private/tmp/popcorn-youtube-learning/node_modules node --test extension/tests/recovery-accessibility.test.js
CI=true pnpm vitest run tests/accessibility/web-states.test.tsx
```

- Extension: exit 1, 5/5 failed for the absent live region, presenter, retry,
  unsupported behavior, and Options recovery copy.
- Web: exit 1 before collecting tests because
  `src/components/states/error-state.tsx` did not exist.

Truthfulness repair RED:

```bash
node --test --test-name-pattern='rejected before queue admission' extension/tests/recovery-accessibility.test.js
```

Exit 1: the UI incorrectly used organization-failure “saved” copy when queue
admission had failed. The minimal repair added a fixed pre-queue failure state;
the same focused test then passed.

Independent-review P1 repair RED:

```bash
POPCORN_TEST_SIDEPANEL_SOURCE=/private/tmp/popcorn-batch-c-5-revised/extension/sidepanel.js \
  node --test --test-name-pattern='real queued retry response|checkCurrentTab' \
  extension/tests/recovery-accessibility.test.js
```

- The real queue-shaped retry response
  `{success:true,synced:false,pending:true,code:'SYNC_RETRYING'}` left the raw
  Chinese text empty and exposed no reachable recovery controls.
- A test-only VM seam invoked the production `checkCurrentTab` function. The
  pre-repair implementation issued a second active-YouTube query when the
  current tab was not YouTube, selected a different tab, and also accepted a
  non-watch YouTube path carrying `?v=` and relayed `getVideoInfo`.

The repair removed the unreachable `status: failed/organizing` proof and the
two fallback tab strategies. Both focused tests then passed using only the
production queue shape and production `checkCurrentTab` path.

Second independent-review P1 RED:

```bash
node --test --test-name-pattern='admitted save that loses authentication' \
  extension/tests/recovery-accessibility.test.js
```

Exit 1: the real admitted response
`{success:true,synced:false,pending:true,code:'AUTH_REQUIRED'}` was presented as
ordinary “Saved locally. Queued to sync.” The minimal repair restored only the
precise `AUTH_REQUIRED && pending` mapping and a distinct “stays queued; sign
in to retry” button/status. The separate pre-admission rejection test remained
GREEN and continued to forbid any saved/queued claim.

GREEN before final verification:

- Recovery/accessibility extension suite: 9/9 passed.
- Web ErrorState suite: 2/2 passed.
- Required extension suite with queue/restart: 27/27 passed.
- Direct save-handler regression (`save-payloads` plus `digest-button`):
  21/21 passed.
- Preserved upstream notes-filter assertion: 1/1 passed.
- TypeScript and JavaScript syntax checks exited 0.

## Exact upstream reuse and licensing

Source: `zarazhangrui/youtube-digest` at
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT.

- `extension/sidepanel.html`: retained the original welcome, loading, error,
  result, and notes-filter DOM; appended the single save status surface rather
  than replacing the panel.
- `extension/sidepanel.css`: retained and extended the upstream `.error-*`,
  `.translation-retry-btn`, and notes-filter `:focus-visible` rules.
- `extension/sidepanel.js`: adapted the existing `showState`, `showError`, and
  save-handler path in place; retained `updateLoading`, `setNotesFilter`,
  `renderTranscriptSegmentContent`, `updateTranslatedRow`, and
  `retryTranslationSegment` unchanged.
- `extension/options.html` and `options.js:initialize`: retained the existing
  account/status/focus shell and bound its existing `syncStatus` to the frozen
  queue summary fields.
- Existing `extension/tests/release.test.js` notes-filter assertions were not
  copied or rewritten. `third_party/youtube-digest/LICENSE` and
  `extension/UPSTREAM.md` remain preserved.

LLM Wiki `nashsu/llm_wiki@723e259309aea5e3850265b631f80224f66dd9f6`
was not used. No GPLv3 code, tests, prompts, components, or assets were copied.

## Remaining risk

- The generated extension must provide the public `POPCORN_RUNTIME_CONFIG.appUrl`
  for the organization-failure Web recovery link. With invalid/missing public
  build configuration, the link fails closed and remains hidden.
- The background queue exposes transport state only at save time. A later
  Provider organization failure remains visible with raw text in the existing
  Web Saved timeline; it is not pushed asynchronously into an already-open
  Side Panel. The repaired Side Panel does not pretend that such a terminal
  status is present in the queue response.
- Independent review is still required. This handoff is implementation evidence,
  not review approval.
