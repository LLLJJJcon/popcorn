# Batch A Task 5 Review Fix 2 — Mutation-Sensitive Forbidden Calls and Bilingual Evidence

## Identity

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 5.
- Original task baseline: `8c8b2f3`; candidate `25bea5a`; first repair `397fcca25cd678115fa442cd65bace36696bd058`.
- New fix worktree: `/private/tmp/popcorn-batch-a-5-fix-2`.
- New branch: `codex/popcorn-batch-a-5-fix-2`.
- Independent rereview closed the real-handler wiring blocker but found two remaining blockers described below.

## Allowed files

- `extension/content.js`
- `extension/sidepanel.js`
- `extension/sidepanel.html`
- `extension/sidepanel.css`
- `extension/tests/digest-button.test.js`
- `extension/tests/save-payloads.test.js`
- `docs/engineering/handoffs/batch-a/task-5.md`

All other files are forbidden, especially Task 6/background/queue files, shared contracts, DB, server, root config, lockfile, notices/licenses, ledger, plans, and specs.

## Blocker 1 — forbidden-call assertions can be swallowed

Production handlers catch failures. Current player and Side Panel doubles for `fetch`, Provider/cloud action, translation, transcript, old `saveNote`, and secondary persistence may only throw; tests do not record/assert them all. A mutation that enqueues correctly and then calls a forbidden dependency can still pass.

TDD repair:

1. Change the real-handler harnesses so every forbidden dependency records its name/arguments/count before any optional throw.
2. For every actual Save Video, subtitle row, subtitle selection, Key Quote, AI Explanation, player overlay, and keyboard invocation, assert all forbidden call counts remain exactly zero.
3. Demonstrate RED by installing or activating a temporary production-equivalent forbidden call path, or otherwise show the new assertion fails against the current swallowed-call behavior before the minimal production/harness correction. Do not leave mutation code in GREEN.
4. Tests must still prove one and only one exact `enqueueSavedItem` call and no pause/seek/navigation/form side effect.

## Blocker 2 — Bilingual selection omits displayed English

When `currentTranscriptMode === "bilingual"` and the selected Chinese evidence has complete displayed translations, the `subtitle_selection` payload must include the displayed English in deterministic segment order. Current handler never supplies it and the current test forces Chinese-only mode.

TDD repair:

1. Add an actual Bilingual DOM selection click test that fails against `397fcca` because `englishTranslation` is absent.
2. Source English only from the translation data already rendered for every selected stable segment; preserve segment order and join deterministically.
3. If any selected segment lacks a displayed translation, omit the optional English field or fail closed according to the existing builder contract; never invent, fetch, or use an English text selection as Chinese evidence.
4. Cover single-line and cross-line Chinese selections without changing the existing exact UTF-16 Chinese projection.

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

Use strict RED→minimal GREEN. No DB reset, pgTAP, or build. Preserve pinned YouTube Digest MIT reuse, GPLv3 isolation, Task 3 behavior, and Task 6 file ownership. Update the existing handoff, remove the node_modules symlink, commit, and return SHA/evidence/risks. Do not self-approve.
