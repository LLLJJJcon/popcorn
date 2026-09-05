# Structured Output Reliability — Task 7 Brief

## Identity

- Plan task: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 7, **Saved Web Analysis Status and Version-Compatible Consumption**.
- Product baseline: `cb06a7d` (Tasks 1–5 accepted and integrated).
- Execution baseline: controller commit containing this brief; record exact SHA.
- Worktree: `/private/tmp/popcorn-structured-output-task-7`.
- Branch: `codex/structured-output-task-7`.

## Allowed files

- `src/features/saved/candidate-list.tsx`
- `src/features/saved/candidate-list.test.tsx`
- `src/features/saved/saved-video-detail.tsx`
- `src/features/saved/saved-video-detail.test.tsx`
- `src/features/saved/saved-workspace.module.css`
- `docs/engineering/handoffs/structured-output-task-7.md`

All server/API implementation, prompts/schemas/contracts, migrations, extension,
root config, dependencies, lockfile, and ledger are forbidden.

## Consumes and produces

- Consume unchanged candidate API states: `ready`, `processing`,
  `gateway_required`, and safe terminal failure, plus Task 5-compatible Saved
  v1/v2 and Overview v4/v5 reads already enforced on the server.
- First Analyze sends `{}`. Only a terminal Retry sends
  `{retryId: crypto.randomUUID()}` and disables duplicate submission until POST
  resolves. Retain and poll the exact owner-bound job ID returned by POST.
- Poll 1s through 60s, then 5s through 5 minutes. At 60s show `Still analyzing
  in the background`, not error. At 5m stop automatic polling and show `Still
  queued` plus one `Check status`. Stop on ready, safe terminal failure,
  gateway-required, abort/unmount, or real request error.
- Continue rendering only `CandidateExpression[]`; never consume model wire
  indexes. No public API or persisted artifact shape changes.

## TDD and verification

RED must use fake timers and literal API responses to prove processing never
becomes a false model failure at 60 seconds, the 5-minute stop/check behavior,
safe model-output copy plus Retry, exactly one retry UUID, cleanup, and valid v1
and v2 candidate rendering while unknown versions do not render. If server-side
Task 5 already normalizes version compatibility before this component, test the
observable compatible ready responses rather than reimplementing prompt logic.

Run only:

```bash
pnpm exec vitest run src/features/saved/candidate-list.test.tsx src/features/saved/saved-video-detail.test.tsx
pnpm typecheck
git diff --check <execution-baseline>..HEAD
git status --short
```

Baseline typecheck has seven known `practice-session.test.tsx` missing-
`savedReturnTarget` TS2741 errors; add none. Do not run full suite, build,
browser, DB, or Provider. Commit code plus handoff and return SHA, RED/GREEN,
typecheck differential, risks, clean status. Do not merge/rebase/push.

## Upstream/license

No upstream code is needed. Preserve YouTube Digest MIT pin
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`. LLM Wiki v0.6.9 commit
`723e259309aea5e3850265b631f80224f66dd9f6` is GPLv3 method-only; copy no code,
tests, prompts, components, or assets.

An independent read-only Agent must PASS the full baseline-to-HEAD diff before
integration. Critical/Important findings require TDD repair and fresh re-review.
