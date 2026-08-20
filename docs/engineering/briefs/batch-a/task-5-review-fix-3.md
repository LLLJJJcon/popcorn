# Batch A Task 5 Review Fix 3 — Record AI Explanation Provider Double

## Identity and sole blocker

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 5.
- Task baseline `8c8b2f3`; candidate `25bea5a`; repairs `397fcca` and `9d90e74d183618ce595f9c286450202ed54355f5`.
- Fix worktree: `/private/tmp/popcorn-batch-a-5-fix-3`.
- Fix branch: `codex/popcorn-batch-a-5-fix-3`.
- Sole remaining blocker: the AI Explanation real-handler harness replaces `sendCloudAction` with a double that throws without recording. Because the production handler catches, an illegal Provider call after enqueue can escape detection.

## Allowed files

- `extension/tests/save-payloads.test.js`
- `docs/engineering/handoffs/batch-a/task-5.md`

No production change is expected. Every other path is forbidden.

## Strict TDD repair

1. In the AI Explanation actual-handler harness, replace the unrecorded `sendCloudAction` double with the same record-before-throw/count mechanism used by the other real handlers.
2. Assert its Provider/cloud-action count is exactly zero after the actual Save action.
3. Obtain RED by a temporary mutation equivalent to an illegal post-enqueue `sendCloudAction` call; the handler may catch it but the new ledger assertion must fail. Remove the mutation before GREEN.
4. Preserve all existing exact payload, one-enqueue, no pause/seek/navigation/form, Bilingual selection, MIT/GPL, and scope behavior.

Verification:

```bash
node --test extension/tests/digest-button.test.js extension/tests/save-payloads.test.js
node --test extension/tests/transcript-selection.test.js extension/tests/translation.test.js extension/tests/release.test.js
./node_modules/.bin/vitest run tests/provenance --passWithNoTests
git diff --check
git status --short
```

Do not run DB, pgTAP, or build. Update the handoff, remove node_modules symlink, commit, and return SHA/RED/GREEN. Do not self-approve.
