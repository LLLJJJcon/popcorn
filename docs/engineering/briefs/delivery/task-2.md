# Delivery Task 2 — Seed a deterministic classroom demonstration

- Plan/task: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`, Task 2.
- Recorded baseline: `74b740fc9eb647ad628d6b9599e5f53e547f513e`.
- Implementation worktree: `/private/tmp/popcorn-delivery-2`.
- Implementation branch: `codex/popcorn-delivery-2`.
- Controller prerequisites: root `demo:seed` uses pinned MIT `tsx@4.23.12`
  so the TypeScript CLI works on the documented Node 20 baseline. The
  controller owns `package.json` and `pnpm-lock.yaml`.

## Ownership

The implementation Agent may create or modify only:

- `scripts/seed-demo.ts`
- `tests/fixtures/demo/youtube-video.ts`
- `tests/fixtures/demo/transcript.zh-CN.json`
- `tests/fixtures/demo/generated-artifacts.json`
- `tests/integration/demo/demo-seed.test.ts`
- `docs/engineering/handoffs/delivery/task-2.md`

Do not modify `package.json`, `pnpm-lock.yaml`, root configuration, migrations,
generated database types, app/extension/server runtime, existing fixtures or
tests, ledger/checkpoints, or Task 1 distribution files. Do not create an
account, password, model configuration, secret, migration, or video file.

## CLI and dependency interfaces

The command is:

```bash
pnpm demo:seed -- --user learner@example.com
```

It consumes `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the
server environment and exactly one `--user` selector. The selector accepts an
exact email or UUID for an already-created local Supabase password account.
Look up that account; never create credentials, accept a password, or print a
password/service-role value. Unknown, duplicate, malformed, or missing users
must fail with a bounded message.

The production CLI must refuse every non-loopback Supabase URL. Accept
`localhost`, `127.0.0.0/8`, and `[::1]` over HTTP or HTTPS with the normal local
Supabase API path shape; reject credentials, query, fragment, and non-HTTP(S)
schemes. A dependency-injected test adapter may bypass network/local-host
validation, but there must be no public CLI flag that disables it.

Use the existing typed Supabase client and migrations 001–016. The service-role
adapter may write only the selected owner's fixture rows and every query/write
must include or verify `user_id`. Do not call Supadata, the model gateway,
`fetch`, a transcript endpoint, or a worker. The fixture JSON is the complete
source of cached generated content.

## Deterministic fixture graph

Use a clearly labelled fixture-only YouTube identifier and canonical watch URL
with one snapshot. Store only four short native `zh-CN` transcript excerpts,
ordered stable segment IDs/timestamps, source URL, and a fixed acquisition date;
never store media/video bytes or a full third-party transcript.

Create stable IDs deterministically from the selected user plus named fixture
records so two local users cannot collide. Re-running for one user must repair
or upsert the same fixture namespace without duplicating rows or deleting any
non-demo user data.

The minimum graph must be usable by the existing Saved, Practice, Vault,
Due Practice, and Progress readers:

- one owned video source and snapshot;
- four ordered transcript segments;
- multiple saves grouped under that one video, including a source-grounded
  subtitle/quote save;
- fixture-only cached learning artifacts in valid existing UI schemas,
  including a saved-item analysis candidate; no raw Provider request/response;
- exactly three `user_expressions` whose current states are one `tried`, one
  `reused`, and one `owned`;
- internally consistent source occurrences, tasks, attempts, mastery events,
  completed reviews, and pending reviews. State history must respect only
  `tried -> reused -> owned`; do not directly invent an `owned` row without
  the required original/reuse/due evidence graph;
- exactly one review that is due at the fixture reference time and can be
  opened through the accepted Due Practice transfer path. Other maintenance
  reviews, if required for graph consistency, must be future-dated.

Keep all timestamps fixed except the explicit reference clock passed to the
seed orchestration. Do not seed a user model API key or Provider provenance;
fixture-generated rows use the accepted fixture model/prompt conventions.

## TDD and verification

Write `tests/integration/demo/demo-seed.test.ts` before implementation and use
a narrow injected repository/client seam. Expected RED:

```text
pnpm vitest run tests/integration/demo/demo-seed.test.ts
```

It must fail because the fixture modules and seed implementation are absent.
Capture the real failure. Tests must assert:

- stable content/source IDs, ordered timestamps, short `zh-CN` excerpts and
  no bytes/file/media fields;
- exact selected owner on every row and every adapter operation;
- one current expression in each allowed mastery state with a legal evidence
  history and exactly one due-now review;
- cached artifacts contain no API key, Provider response, base URL, request,
  token, cookie, or service/job secret;
- non-loopback/malformed URLs and missing/ambiguous accounts fail closed;
- two runs produce identical IDs and per-table row counts, while unrelated
  rows remain untouched;
- no network/Provider method is called in fixture mode.

Required GREEN:

```bash
pnpm vitest run tests/integration/demo/demo-seed.test.ts
pnpm typecheck
pnpm eslint scripts/seed-demo.ts tests/fixtures/demo/youtube-video.ts tests/integration/demo/demo-seed.test.ts
git diff --check
```

Then, against disposable local Supabase after migrations 001–016 and with an
already-created local user, run `pnpm demo:seed -- --user <email>` twice and
record only row counts/IDs and success categories—never credential values. Do
not run real Providers, browser E2E, a production build, load/concurrency, or
the complete pgTAP suite for this task.

## Upstream and license

- YouTube Digest remains pinned at MIT commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`. Task 2 consumes the already
  adapted YouTube source/snapshot/segment concepts but no new upstream file or
  function; do not copy or regenerate extension behavior. Preserve its notice.
- LLM Wiki v0.6.9 / `723e259309aea5e3850265b631f80224f66dd9f6`
  is GPLv3 method-only. This seed task consumes no method and must copy no code,
  tests, prompts, components, assets, or sample data.
- `tsx@4.23.12` is a controller-pinned MIT development tool used only to run
  the local TypeScript CLI; do not expose it in the product or archive.

## Handoff and commit

Record changed files, exact RED/GREEN summaries, stable fixture row counts and
ID method, two-run local evidence, owner/local-only failure cases, absence of
Provider/network calls, source scope/acquisition date, upstream/license action,
risks, and any generated/untracked state in
`docs/engineering/handoffs/delivery/task-2.md`. Commit only the allowed files
and return commit SHA, tests, local two-run result, risks, and handoff path. Do
not integrate or push.
