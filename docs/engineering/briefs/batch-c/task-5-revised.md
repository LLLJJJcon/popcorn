# Batch C revised Task 5 implementation brief

- Plan/task: `docs/superpowers/plans/2026-08-22-popcorn-batch-c-school-demo-revision.md`, Task 5.
- Baseline commit: `8bdfa2a24aa790195d39e1496b80613a94c7fe4e`.
- Worktree: `/private/tmp/popcorn-batch-c-5-revised` on `codex/popcorn-batch-c-5-revised`.
- Allowed files: the five existing Side Panel/Options HTML, CSS, and JavaScript files; `src/components/states/error-state.tsx`; the two focused recovery/accessibility tests; and this task's brief/handoff.
- Forbidden files: extension background, auth, sync queue, content script, manifest/runtime configuration, Saved/Vault/deletion work, migrations/generated types, root configuration, lockfile, ledger/checkpoints, and all unrelated Web pages/components/tests.
- Consumed interfaces: the frozen save queue results (`synced`, `pending`, `code`), `getSyncSummary` (`pendingCount`, `requiresSignIn`, `nextRetryAt`), existing password-session messages, and the generated public `POPCORN_RUNTIME_CONFIG.appUrl`.
- Produced interface: one Side Panel `aria-live` save/status surface for saving, saved/queued, retrying, sign-in-required, organizing, failed-with-raw-text, and unsupported-watch-page presentation; existing Options status elements expose queue recovery; one fixed generic Web `ErrorState` with request ID and a semantic link or button recovery action.
- Expected RED: the Side Panel has no save live region or recovery presenter, Options ignores `requiresSignIn`/`nextRetryAt`, and the Web error component does not exist.
- Verification: `node --test extension/tests/recovery-accessibility.test.js extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js`; `pnpm vitest run tests/accessibility/web-states.test.tsx`; `pnpm typecheck`; scoped ESLint/syntax checks; `git diff --check`.
- Upstream reuse: adapt in place the existing `showState`, `updateLoading`, `showError`, `setNotesFilter`, `renderTranscriptSegmentContent`, `updateTranslatedRow`, `retryTranslationSegment`, and `options.js:initialize` paths from `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`. Preserve `third_party/youtube-digest/LICENSE` and `UPSTREAM.md`; license is MIT.
- GPL isolation: `nashsu/llm_wiki@723e259309aea5e3850265b631f80224f66dd9f6` is not used. No GPLv3 code, tests, prompts, components, or assets may be copied.
