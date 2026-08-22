# Delivery Task 2 prerequisite fix — GoTrue-readable local seed users

- Parent task: revised Delivery Task 2.
- Baseline: `3c8ad5461db7714518774a033344ade9561e6de4`.
- Worktree: `/private/tmp/popcorn-local-auth-seed-fix-2`.
- Reproduction: current GoTrue `GET /admin/users` returned HTTP 500 with
  `confirmation_token: converting NULL to string is unsupported` for the two
  identities inserted by `supabase/seed.sql`. A disposable database-only
  update using `coalesce(field, '')` for `confirmation_token`,
  `recovery_token`, `email_change`, and `email_change_token_new` changed the
  same endpoint to 200. No demo rows had been written.

## Allowed files

- Create: `tests/contract/local-auth-seed.test.ts`
- Modify: `supabase/seed.sql`
- Create: `docs/engineering/handoffs/delivery/local-auth-seed-gotrue-fix.md`
- This controller brief

Do not modify migrations, pgTAP, generated types, root config/lockfile, Task 2
implementation/fixtures/tests, application code, ledger, or checkpoints.

## TDD protocol

First write a focused static contract test that parses/inspects the two
`auth.users` seed tuples and requires all four GoTrue string fields above to be
explicit empty strings for both identities. It must also preserve the exact
two IDs/emails, fixed password hash, confirmation timestamps, and idempotent
`on conflict (id) do nothing`. Run it and record RED against the old seed.

Then make the minimum seed-only change: add the four columns to the insert
column list and four empty string literals to each existing tuple. Do not
change account IDs, email, password hash, timestamps, providers, profile rows,
or add credentials. Empty auth workflow tokens are non-secret defaults, not
user passwords or sessions.

Required GREEN:

```bash
pnpm vitest run tests/contract/local-auth-seed.test.ts
git diff --check
```

Do not reset the database or run pgTAP in this isolated fix; after review and
integration, the parent Task 2 Agent will perform one reset and prove both
GoTrue account lookup and two idempotent demo seed runs.

The fix consumes no YouTube Digest or LLM Wiki material. Preserve all existing
MIT/GPL isolation. Create the handoff, commit only the allowlist, and return
SHA, RED/GREEN, risks, and handoff path. Do not integrate or push.
