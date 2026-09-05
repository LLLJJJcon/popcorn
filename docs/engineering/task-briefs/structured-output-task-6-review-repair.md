# Structured Output Task 6 — Review Repair Brief

- Parent task: Structured Output Reliability plan Task 6.
- Parent baseline: `9bf8a2ad80c660a6fa76b90fdc7b059ed412301b`.
- Parent implementation: `714cc7d7a77ebb8c2af35a91f76a95abb39aaa9c`.
- Repair worktree: `/private/tmp/popcorn-structured-output-task-6-repair`.
- Repair branch: `codex/structured-output-task-6-repair`.
- Repair baseline: controller commit containing this brief.

## Important finding

`extension/sidepanel.js` still falls back to raw `result.error` and several raw
`error.message` catch values. Missing/unknown `failureCategory` or a rejected
runtime/API call can therefore render untrusted text.

Write sentinel RED tests for Overview, Translation, and Explanation covering
missing category, unknown category, unsuccessful runtime responses, and thrown
errors. Assert that the sentinel never appears and each surface uses stable,
bounded generic copy appropriate to that operation. Recognized Task 1 safe
categories must keep their existing honest copy. Then remove every raw error
fallback on these three model-generated Side Panel flows. Do not change status,
payload, retry batching, or background API behavior.

## Allowed files

- `extension/sidepanel.js`
- `extension/tests/translation.test.js`
- `extension/tests/save-payloads.test.js`
- `docs/engineering/handoffs/structured-output-task-6-review-repair.md`

Everything else is forbidden, including `background.js`, generated extension
output, server/Web/contracts/migrations/config/dependencies/lockfile/ledger.

## Focused verification

```bash
node --test extension/tests/translation.test.js extension/tests/save-payloads.test.js
node --check extension/sidepanel.js
git diff --check <parent-implementation>..HEAD
git status --short
```

Use the controller's existing locked `node_modules` read-only if needed; do not
install or commit dependencies. No full suite/build/browser/server/DB/Provider.
Commit repair plus handoff and return SHA, RED/GREEN, risk, clean status. No
merge/rebase/push.

Preserve YouTube Digest MIT pin `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
LLM Wiki GPLv3 pin `723e259309aea5e3850265b631f80224f66dd9f6` is
method-only; copy no code/tests/prompts/components/assets.
