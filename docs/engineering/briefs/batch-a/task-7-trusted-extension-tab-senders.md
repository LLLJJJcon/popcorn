# Batch A Task 7 Repair — Trusted Extension Pages Opened in Tabs

## Discovered production defect

Task 7 persistent Chromium RED proved that `options_ui.open_in_tab` produces a `MessageSender` with `sender.tab`, while both `background.js:isPopcornAuthSender` and `auth.js:assertTrustedOptionsSender` require `!sender.tab`. The real Options `Sign in` button therefore receives `{ ok:false }` before auth begins. The exact internal Side Panel page has the same limitation in a persistent-browser test tab.

## Identity and worktree

- Parent plan: Batch A Task 7 in `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`.
- Accepted production baseline: `c3aa7e3`; Task 7 brief: `5f1151d`.
- Fix worktree: `/private/tmp/popcorn-batch-a-7-trusted-senders`.
- Fix branch: `codex/popcorn-batch-a-7-trusted-senders`.

## Allowed files

- `extension/auth.js`
- `extension/background.js`
- `extension/tests/auth.test.js`
- `extension/tests/auth-worker.test.js`
- `extension/tests/release.test.js`
- `docs/engineering/handoffs/batch-a/task-7-trusted-extension-tab-senders.md`

Every other file is forbidden, including Task 7 E2E/integration files, Side Panel/content/options production UI, queue, contracts, DB, root config, lockfile, ledger, plans, and specs.

## Strict TDD

RED must use realistic Chrome senders:

1. `{id:runtime.id,url:optionsUrl,tab:{id, url:optionsUrl}}` is currently rejected but must be accepted because Options is configured `open_in_tab`.
2. `{id:runtime.id,url:sidePanelUrl,tab:{id,url:sidePanelUrl}}` must be accepted for the same exact internal page when opened as a test/dev tab.
3. Any mismatch among sender ID, sender URL, tab URL, path, query, fragment, or internal page name remains rejected.
4. A YouTube content sender remains accepted only for the existing exact watch/player-moment/openSidePanel cases and never gains auth/general Side Panel privileges.

Implement one rule consistently at both gates: require same extension ID and exact `chrome.runtime.getURL(<page>)`; if `sender.tab` exists, require an integer tab ID and exact same internal tab URL. Do not accept arbitrary extension pages or broad `chrome-extension://` origins.

RED/GREEN:

```bash
node --test extension/tests/auth-worker.test.js extension/tests/auth.test.js extension/tests/release.test.js
node --test extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
node --check extension/auth.js
node --check extension/background.js
git diff --check
git status --short
```

No DB, pgTAP, build, dependency, manifest, or lockfile work is justified. Preserve session/token nonleakage, exact YouTube sender gating, Task 3 Provider-neutral routes, queue owner isolation, pinned MIT reuse, and GPLv3 isolation.

Commit, write the handoff, remove any node_modules symlink, and return SHA/RED/GREEN/risks. A fresh independent Agent must review before integration.
