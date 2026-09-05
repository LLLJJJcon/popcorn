# Delivery recovery Task 5O — YouTube N shortcut capture

- Plan/task: revised Delivery Task 5 live-UX repair; bounded hotfix approved by the user on 2026-09-05.
- Baseline commit: `8acfcd99f5f989cc7e9efea780300442ed0c2011`.
- Worktree: `/private/tmp/popcorn-hotkey-n`.
- Allowed implementation files: `extension/content.js` and generated `dist/popcorn-extension/content.js` only.
- Allowed report file: `docs/engineering/handoffs/delivery/task-5o-hotkey-n-report.md`.
- Forbidden: Web files, background queue semantics, authentication, migrations, contracts, root config, lockfile, other generated extension files, and files outside the allowlist.
- Consumes: existing `saveCurrentNote` and durable `enqueueSavedItem` message chain.
- Produces: on a YouTube watch page, physical or character N is captured before YouTube consumes it; input, textarea, and contenteditable focus remain excluded; existing save feedback remains unchanged.
- Root cause: the current document keydown listener uses bubbling, while YouTube can consume its own N shortcut first.
- Expected failing test: none. The user explicitly requested this quick repair without adding or running tests.
- Verification: inspect `git diff --check 8acfcd9..HEAD`; confirm only allowlisted files/report changed; confirm source and generated content files match. Do not run test commands.
- Upstream reuse: preserve the existing YouTube Digest-derived content-script integration from `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`; modify the existing listener, do not create a parallel shortcut path.
- License: retain MIT provenance; do not copy any `nashsu/llm_wiki` GPLv3 code, tests, prompts, components, or assets.
- Handoff: commit implementation and report; return commit SHA, changed files, static inspection, risks, and report path.
