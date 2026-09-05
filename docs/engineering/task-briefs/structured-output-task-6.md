# Structured Output Reliability — Task 6 Brief

## Identity

- Plan task: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 6, **YouTube Side Panel Partial Results and Honest Status**.
- Product baseline: `cb06a7d` (Tasks 1–5 accepted and integrated).
- Execution baseline: controller commit containing this brief; record exact SHA.
- Worktree: `/private/tmp/popcorn-structured-output-task-6`.
- Branch: `codex/structured-output-task-6`.

## Allowed files

- `extension/background.js`
- `extension/sidepanel.js`
- `extension/tests/translation.test.js`
- `extension/tests/save-payloads.test.js`
- `docs/engineering/handoffs/structured-output-task-6.md`

Everything else is forbidden, including generated extension output, Web/server,
contracts, migrations, root config, dependency files, lockfile, and ledger.

## Consumes and produces

- Consume only the existing enriched Overview/Translation/Explanation domain
  artifacts and Task 1's safe `failureCategory`; never read semantic wire fields
  such as `sourceLineIndex` in the Side Panel.
- Render valid returned Translation rows immediately. Keep missing requested IDs
  as one failed set; the existing single Retry-failed action sends only that set
  as one batch, never one call per row.
- Map `model_output`, `model_unavailable`, and processing to honest bounded copy.
- Overview/Explanation continue consuming unchanged enriched domain objects.
- Produce no Provider, persistence, public API, or payload-shape change. All API
  calls remain in `background.js`; gateway URL/model/key never enter Side Panel.

## TDD and verification

RED must prove two requested lines with one returned line render one valid
English result plus one retryable failure; safe categories choose honest text;
and Overview/Explanation reject/ignore wire-only fields in favor of domain data.
Expected RED is current all-or-nothing row/status behavior.

Run only:

```bash
node --test extension/tests/translation.test.js extension/tests/save-payloads.test.js
node --check extension/background.js
node --check extension/sidepanel.js
git diff --check <execution-baseline>..HEAD
git status --short
```

Do not run the full extension suite, build/package, browser, server, DB, or real
Provider. Commit implementation plus handoff and return SHA, RED/GREEN evidence,
risks, and clean status. Do not merge/rebase/push.

## Upstream/license

YouTube Digest `zarazhangrui/youtube-digest` at
`d03e1f61e017b032159ffd1821cac6e7693ce0c7` is MIT and remains the required
existing extension reuse; do not create a parallel implementation. LLM Wiki
v0.6.9 commit `723e259309aea5e3850265b631f80224f66dd9f6` is GPLv3;
copy no code, tests, prompts, components, or assets.

An independent read-only Agent must PASS the full baseline-to-HEAD diff before
controller integration. Critical/Important findings require a TDD repair and a
fresh independent re-review.
