# Local-First Task 2 — Local durable-job trigger

- Plan/task: `2026-08-22-popcorn-local-first-amendments.md`, Task 2.
- Baseline commit: `f7de4b6`.
- Worktree: `/private/tmp/popcorn-youtube-learning`.
- Controller-owned files: `.env.example`, `package.json`, `supabase/config.toml`,
  `src/server/env.ts`, `src/server/env.test.ts`, `scripts/process-local-jobs.mjs`,
  `tests/integration/jobs/local-worker.test.ts`, and this task's brief/handoff.
- Forbidden: lockfile, migrations, generated database types, gateway contracts,
  extension/auth, queue implementation/RPCs, and unrelated routes/tests.

The task consumes the existing authenticated
`POST /api/internal/jobs/process`, `APP_URL`, and `INTERNAL_JOB_SECRET`. It
produces `pnpm worker:local`, a sequential local trigger that survives empty
queues and transient request failures and stops through SIGINT/SIGTERM. It does
not access Supabase or claim jobs itself. The expected RED was the missing
worker module and the server environment still requiring the retired
`OPENAI_API_KEY` and `OPENAI_MODEL`; GREEN is the focused worker/environment/job
processor suite plus type, syntax, lint, and diff checks.

No upstream code is required. YouTube Digest commit
`d03e1f61e017b032159ffd1821cac6e7693ce0c7` does not provide this server
trigger. No LLM Wiki v0.6.9 / commit
`723e259309aea5e3850265b631f80224f66dd9f6` GPLv3 code, tests, prompts,
components, or assets may be copied. New code remains MIT-intended.
