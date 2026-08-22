# Revised Delivery Task 3 handoff

## Scope

- Plan: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`, Task 3
- Task worktree baseline/brief HEAD: `876a1cb`
- Implementation commit: `eab304aae2ab07f9f89f406fd99946ec9c9c7a9b`
- Worktree: `/private/tmp/popcorn-delivery-3`

## RED evidence

The documentation contract was created before any guide or environment-file
change.

```text
$ pnpm vitest run tests/release/self-host-docs.test.ts
Test Files  1 failed (1)
Tests       8 failed (8)
```

All failures were meaningful missing-contract failures: `README.md` and the
three operations guides read as absent/empty, so required commands, local
ports, account path, gateway settings, recovery, and shutdown assertions
failed. There was no syntax, module-resolution, or harness error.

## GREEN and final verification

```text
$ pnpm vitest run tests/release/self-host-docs.test.ts
Test Files  1 passed (1)
Tests       8 passed (8)

$ pnpm typecheck
$ tsc --noEmit
exit 0

$ pnpm eslint tests/release/self-host-docs.test.ts
exit 0

$ git diff --check
exit 0
```

The final `git status --short` before the implementation commit contained
only the six Task 3 allowlist files listed below.

## Setup-safe command evidence

- `pnpm install --frozen-lockfile`: exit 0, pnpm 11.19.0, already up to date.
- Read-only `package.json` check: package manager is exactly `pnpm@11.19.0`;
  `dev`, `db:reset`, `worker:local`, `extension:local`, and `demo:seed` all
  exist.
- `pnpm exec supabase --version`: exit 0, project-local CLI 2.114.0.
- `pnpm exec supabase status`: exit 0; current local API, Studio, and Mailpit
  URLs matched ports 54321, 54323, and 54324. No returned local key is copied
  into this handoff.
- `pnpm extension:local` with loopback URLs and a non-secret public placeholder:
  exit 0 and generated the normal ignored `dist/popcorn-extension` directory.
- `pnpm dev` with local non-live placeholder values: Next.js 16.3.1 reached
  Ready on port 3000 in 280 ms and was stopped with Ctrl-C. Its automatic
  `AGENTS.md`, `CLAUDE.md`, and `next-env.d.ts` smoke artifacts were fully
  removed/reverted before commit.
- `pnpm worker:local` with a deliberately non-matching test secret: started,
  emitted only the bounded generic `failed` category while Web was stopped,
  and terminated on Ctrl-C. It could not claim jobs or call a Provider.
- `openssl rand -hex 32`: exit 0 and produced a disposable 64-character value;
  the value was neither stored nor copied into this handoff.

Intentionally not executed: `pnpm db:reset`, account creation/removal,
`pnpm demo:seed`, `pnpm exec supabase stop`, live YouTube/Supadata/model calls,
or any Provider credential flow. This preserved the shared disposable local
database and followed the documentation-only verification boundary.

## Changed files

- `.env.example`
- `README.md`
- `docs/operations/local-self-host.md`
- `docs/operations/job-recovery.md`
- `docs/operations/account-reset.md`
- `tests/release/self-host-docs.test.ts`

This handoff is the only post-implementation file and is committed separately.

## Requirement and license result

- The guide has one personal school-project topology only: local Next.js,
  local Supabase, local worker, and unpacked Chrome extension.
- Gateway display name, exact OpenAI-compatible HTTPS base URL, model, and
  write-only API key are user Web settings after sign-in. The gateway key is
  absent from `.env.example`, command examples, extension configuration, and
  this handoff; activation requires exact-destination consent.
- Public anon/local URLs are separated from service-role, Supadata, and job
  secret server values. The local destructive boundary is adjacent to every
  `pnpm db:reset` instruction.
- Recovery is limited to process restart, generic worker categories, durable
  Web jobs, and the extension pending queue. No commercial operations or
  deployment platform was introduced.
- No YouTube Digest or LLM Wiki code, prose, prompt, test, component, or asset
  was copied. Existing MIT attribution is linked; GPLv3 material remains
  isolated. All new prose and tests are original under the root MIT project.

## Remaining risks

- The shell examples use `source .env.local`, so they assume a Bash/Zsh-like
  shell, matching the current macOS development environment.
- The worker smoke intentionally used a false secret with Web stopped; it
  proves startup, generic failure handling, and signal shutdown, not a real
  Provider-backed job. Fixture-backed fresh-clone acceptance remains Task 4.
- The local service was already running, so status was verified without
  restarting or stopping it. No database state was changed for this docs task.
