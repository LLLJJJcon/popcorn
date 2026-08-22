# Delivery Task 2 review fix 2 — Full fixture-graph causality

- Full review baseline: `74b740fc9eb647ad628d6b9599e5f53e547f513e`.
- First rejected candidate: `424bba497bd5067a414bf233efa1d4ed18cf21a0`.
- First repair HEAD rejected for remaining P1:
  `624f1678d93ec7d112fff37a5aabecd3681f115e`.
- Worktree: `/private/tmp/popcorn-delivery-2-fix-2`.

## Allowed files

- `tests/fixtures/demo/youtube-video.ts`
- `scripts/seed-demo.ts`
- `tests/integration/demo/demo-seed.test.ts`
- `docs/engineering/handoffs/delivery/task-2.md` (append-only second repair)
- this controller brief

Everything else is forbidden, including the other fixture files, GoTrue seed,
root config/lock/workspace, migrations/types, app/extension/server, ledger and
checkpoints.

## RED and required behavior

First add a complete cross-entity causality test. It must fail because the
current owned original task/attempt/event occurs before the source snapshot,
saves, sense, occurrence, and user expression exist, and because expression
`updated_at` does not reflect the last accepted mastery event.

For all three histories require:

- source and snapshot exist/captured before transcript, saves, artifacts,
  senses, occurrences, expressions, tasks, attempts, events, and reviews that
  consume them;
- each save precedes or equals its occurrence/sense creation;
- each expression exists before its first task/attempt/event;
- every task exists before its attempt; every event occurs at the linked
  attempt submission; review schedule/order remains the already-fixed
  +1/+7/+30 day graph;
- `user_expression.created_at <= updated_at`, and `updated_at` equals the latest
  accepted mastery event that produced its current `tried`/`reused`/`owned`
  state.

## Minimal GREEN

Move the fixed fixture acquisition/source creation date early enough that the
earliest reference-relative owned history in this released school demo is
after the source graph exists. Keep it fixed, explicit, and recorded; continue
storing only four short excerpts. Do not weaken the frozen 1/7/30-day schedule
or make evidence occur in the future. Set each expression's `updated_at` to its
last mastery event while retaining stable IDs and source content.

The project is released on/after 2026-08-22; choose a fixed acquisition date
with sufficient margin before the normalized reference-day histories. Tests
must retain same-UTC-day determinism and the complete previously accepted URL,
bounded-error, owner, artifact, idempotency, due and maintenance assertions.

Required focused verification:

```bash
TMPDIR=/private/tmp pnpm vitest run tests/integration/demo/demo-seed.test.ts
TMPDIR=/private/tmp pnpm vitest run tests/contract/local-auth-seed.test.ts
TMPDIR=/private/tmp pnpm typecheck
TMPDIR=/private/tmp pnpm eslint scripts/seed-demo.ts tests/fixtures/demo/youtube-video.ts tests/integration/demo/demo-seed.test.ts
git diff --check
```

Run the CLI twice against the existing disposable local DB without reset and
prove identical results/timestamp graph, three states 1/1/1, due 1, future 2,
and owner-b marker preserved. Never print keys. Do not run pgTAP/E2E/build/load
or Provider.

Append RED/GREEN/local evidence and the implementation repair SHA to the
handoff using an implementation commit followed by a handoff commit. Preserve
YouTube Digest MIT, LLM Wiki GPL isolation and tsx MIT tooling. Return both
SHAs/HEAD, tests, local result, risks and handoff path; do not integrate/push.
