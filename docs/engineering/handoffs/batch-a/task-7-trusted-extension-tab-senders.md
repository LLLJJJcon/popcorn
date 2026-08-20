# Batch A Task 7 Repair Handoff — Trusted Extension Tab Senders

## Baseline and scope

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 7 production repair.
- Accepted production baseline: `c3aa7e3`.
- Repair brief/base commit: `496e7929a630f72b7fff813a2087bca0af22a532`.
- Worktree: `/private/tmp/popcorn-batch-a-7-trusted-senders`.
- Branch: `codex/popcorn-batch-a-7-trusted-senders`.
- Candidate: the commit containing this handoff.

Changed files:

- `extension/auth.js`
- `extension/background.js`
- `extension/tests/auth.test.js`
- `extension/tests/release.test.js`
- `docs/engineering/handoffs/batch-a/task-7-trusted-extension-tab-senders.md`

No E2E fixture, Side Panel/content/options UI, manifest, queue, server, database, contract, root config, lockfile, plan, spec, or ledger file changed.

## TDD evidence

The new tests exercise realistic Chrome extension-tab senders for the exact Options and Side Panel pages. Before production changes:

```text
node --test extension/tests/auth-worker.test.js extension/tests/auth.test.js extension/tests/release.test.js
28 tests: 26 pass, 2 fail
```

The two expected RED failures were:

- `auth messages use Chrome sender identity and return only bounded account state`: the inner auth gate rejected an exact Options sender with `{tab:{id,url:optionsUrl}}`.
- `exact Options and Side Panel pages stay trusted when Chrome supplies a tab sender`: the background Options gate returned `false` before invoking the auth handler.

After the minimal production change, the focused suite is GREEN:

```text
node --test extension/tests/auth-worker.test.js extension/tests/auth.test.js extension/tests/release.test.js
28 tests: 28 pass, 0 fail
```

The production rule is identical at both auth gates and at the Side Panel gate:

- `sender.id` must exactly equal `chrome.runtime.id`;
- `sender.url` must exactly equal `chrome.runtime.getURL("options.html")` or `chrome.runtime.getURL("sidepanel.html")`, according to the gate;
- an absent `sender.tab` remains valid for Chrome's native extension contexts;
- when `sender.tab` is present, its ID must be an integer and its URL must exactly equal that same internal page URL.

Regression cases reject extension-ID mismatch, other internal pages, query strings, fragments, non-integer tab IDs, missing tab URLs, and sender/tab URL mismatch. The pre-existing exact YouTube watch sender test remains in the same focused suite and its production predicate was not changed.

## Security and behavior boundaries

- The repair admits only the two already-trusted exact internal pages; it does not admit a broad `chrome-extension://` origin or arbitrary extension page.
- The Options page may reach only the existing bounded auth/account and sync-summary routes. The inner auth handler still returns bounded account state and never returns access tokens, refresh tokens, PKCE verifier/state, queue contents, or model-gateway secrets.
- The Side Panel page retains its existing command allowlist. A tab-backed Side Panel sender does not receive auth command privileges.
- YouTube content sender authorization remains governed by the unchanged exact watch-URL and integer-tab-ID predicate. No content-script privilege was widened.

## Upstream reuse and license

The existing classic MV3 worker and message router derived in place from pinned MIT source `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7` were preserved. This repair changes only the existing sender allowlist and its regression tests; it creates no parallel worker or router and changes no notice or provenance file.

No code, tests, prompts, components, assets, names, or structure were copied from GPLv3 `nashsu/llm_wiki v0.6.9@723e259309aea5e3850265b631f80224f66dd9f6`.

## Verification and residual risk

Per the risk-calibrated brief, verification is limited to the focused auth/release tests, queue/restart regressions, JavaScript syntax checks, and Git diff checks. No DB reset, pgTAP, build, dependency, manifest, or lockfile operation is justified.

```text
node --test extension/tests/auth-worker.test.js extension/tests/auth.test.js extension/tests/release.test.js
28 tests: 28 pass, 0 fail

node --test extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
18 tests: 18 pass, 0 fail

node --check extension/auth.js
node --check extension/background.js
git diff --check
```

Every verification command exited 0. The worktree-only `node_modules` symlink was removed before commit.

Residual risk: Node/VM tests reproduce Chrome's `MessageSender` shape and the original persistent-Chromium defect, but a fresh independent reviewer/controller should rerun the persistent browser Options sign-in and Side Panel tab smoke before integration acceptance. This candidate does not self-review or claim browser acceptance.
