# Delivery Task 2 prerequisite — GoTrue-readable local seed users

- Start commit: `563aeaced415c1c32a6f004cd1a14910a862209a`
- Parent baseline: `3c8ad5461db7714518774a033344ade9561e6de4`
- Scope: `supabase/seed.sql`, focused contract test, and this handoff only

## Root cause

GoTrue reads the four auth workflow fields as strings. The two local
`auth.users` tuples omitted those columns, so PostgreSQL supplied `NULL` and
GoTrue failed account listing with `confirmation_token: converting NULL to
string is unsupported`. The controller's disposable database-only check had
already isolated the same boundary: converting those four values to empty
strings changed `GET /admin/users` from HTTP 500 to 200.

## RED

After adding `tests/contract/local-auth-seed.test.ts` and before modifying the
seed:

```text
node_modules/.bin/vitest run tests/contract/local-auth-seed.test.ts
Test Files  1 failed (1)
Tests       1 failed (1)
```

The executed assertion showed that both parsed tuples lacked
`confirmation_token`, `recovery_token`, `email_change`, and
`email_change_token_new`; the fixed IDs, emails, password hash, and
confirmation timestamps were all parsed at their expected values.

Two earlier invocations were test-environment errors and are not counted as
RED: the worktree initially had no dependency link, and jsdom could not use a
non-`file:` `import.meta.url`. The test now resolves the repository seed from
the Vitest working directory.

## GREEN

The seed column list now names all four workflow fields and each of the two
existing tuples supplies four explicit empty strings. No identity, email,
password hash, timestamp, provider metadata, profile row, or conflict behavior
changed.

```text
node_modules/.bin/vitest run tests/contract/local-auth-seed.test.ts
Test Files  1 passed (1)
Tests       1 passed (1)

git diff --check
exit 0
```

The Codex-provided `pnpm` wrapper attempted an automatic dependency reinstall
instead of executing the existing linked Vitest binary and aborted because the
worktree was non-interactive. No dependency or lockfile change was made. The
direct binary is Vitest 4.1.10 from the project's already verified shared
dependency tree. The parent should rerun the prescribed `pnpm vitest ...`
command from its integrated worktree if its wrapper accepts the established
dependency link.

## Boundary and risk

- No database reset or pgTAP command was run.
- No migration, root configuration, lockfile, application, Task 2, ledger, or
  checkpoint file changed.
- No YouTube Digest or LLM Wiki material was consumed; MIT/GPL isolation is
  unchanged.
- Empty workflow tokens are non-secret defaults; no credential, session, or
  user password was added.
- Remaining integration risk: this focused fix statically proves the exact seed
  shape. The parent Task 2 run still owns one reset plus live GoTrue lookup and
  two idempotent demo seed executions.
