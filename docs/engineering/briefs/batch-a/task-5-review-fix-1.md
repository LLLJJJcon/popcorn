# Batch A Task 5 Review Fix 1 — Exercise Real Save Handlers

## Identity

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 5.
- Original task baseline: `8c8b2f3`; reviewed candidate: `25bea5ae21815e7ade2c4abb3db3a85319cb1af4`.
- Fix worktree: `/private/tmp/popcorn-batch-a-5-fix`.
- Fix branch: `codex/popcorn-batch-a-5-fix`.
- Review result: FAIL with one blocker—pure builders/controllers pass while the real UI save handlers may be deleted or polluted with `fetch`/old `saveNote` without a test failure.

## Allowed files

- `extension/content.js`
- `extension/sidepanel.js`
- `extension/sidepanel.html`
- `extension/sidepanel.css`
- `extension/tests/digest-button.test.js`
- `extension/tests/save-payloads.test.js`
- `docs/engineering/handoffs/batch-a/task-5.md`

Every other path is forbidden. In particular do not edit `background.js`, Task 6 queue files/tests, auth, contracts, migrations, generated types, server code, root config, lockfile, notices/licenses, ledger, plans, or specs.

## Required TDD repair

Write behavior tests before production changes. The tests must exercise the actual production event handlers—not a separately constructed helper—and prove:

1. Clicking Save Video, subtitle row Save, subtitle selection Save, Key Quote Save, and AI Explanation Save each invokes the injected/extension `enqueueSavedItem` boundary exactly once with the exact displayed payload.
2. Player overlay/keyboard shortcut invokes the actual production handler and applies the three-second reaction delay.
3. Each handler performs zero direct `fetch`, Provider call, old `saveNote`, or secondary persistence call.
4. Saving does not call `pause`, change `currentTime`, navigate, open a form, or trigger transcript seek; existing click/selection behavior remains intact.
5. Removing any one handler enqueue call makes its test fail. The forbidden-call double must be installed at the dependency/global actually read by production code; remove the current unused second argument to `createSaveController`.

RED command:

```bash
node --test extension/tests/digest-button.test.js extension/tests/save-payloads.test.js
```

Expected RED: new production-handler click tests fail against `25bea5a` because the real handler wiring is not test-addressable/observable or the unused forbidden double does not intercept it.

Make the smallest production refactor needed to exercise the same handlers used at runtime; do not build a parallel test-only save path.

## Verification

```bash
node --test extension/tests/digest-button.test.js extension/tests/save-payloads.test.js
node --test extension/tests/transcript-selection.test.js extension/tests/translation.test.js extension/tests/release.test.js
./node_modules/.bin/vitest run tests/provenance --passWithNoTests
node --check extension/content.js
node --check extension/sidepanel.js
git diff --check
git status --short
```

No DB reset, pgTAP, or build is warranted for this behavior-test repair. Preserve the original pinned YouTube Digest MIT reuse and GPLv3 isolation. Update the existing Task 5 handoff with RED/GREEN and review-fix evidence, commit, and return SHA/tests/risks. Do not self-approve.
