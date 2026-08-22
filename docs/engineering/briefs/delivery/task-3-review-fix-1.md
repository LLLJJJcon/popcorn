# Revised Delivery Task 3 review fix 1

## Assignment

- Original Task 3 baseline: `7e5920be87f015632d39ab4f31b8b08496716858`
- Original reviewed candidate: `b4661d027ee6a12c735f6c9b9d4ee3bbad098999` (FAIL)
- Accepted prerequisite on this branch: signup profile commits `0b8b69a`, `2de908c`, `2c1ed5f`; independent PASS.
- Repair branch/worktree: `codex/popcorn-delivery-3-fix-1`, `/private/tmp/popcorn-delivery-3-fix-1`
- Current repair baseline: `5a123d6`

## Review findings and controller decisions

1. **Accepted P1:** fresh GoTrue signup did not create `public.profiles`, so gateway configuration failed. The controller-owned migration 017 now creates the fixed profile at auth transaction commit, backfills missing profiles, and has passed focused 6/6, full pgTAP 663/663, three concurrency regressions, real GoTrue signup, gateway creation/activation, and independent review.
2. **Accepted P1 factual defect, rejected scope expansion:** the guide falsely told users to delete an account directly in Supabase Studio, but `ON DELETE RESTRICT` prevents that once a profile/learning graph exists. The approved revised plan requires an accurate local Supabase reset path and explicitly does not require account-deletion UI. For this personal one-machine project, the minimal supported removal is `pnpm db:reset`, which removes all local accounts/data. Do not add a single-account cascade, deletion RPC/script, UI, or dependency graph cleanup feature.
3. **Accepted P2:** documentation tests bind semantics to same-line Markdown via repeated `[^\n]` patterns. Normalize document whitespace before semantic matching while keeping exact commands and exact file/env tokens unmodified.

## Allowed files

- Create this brief.
- Modify `docs/operations/local-self-host.md`.
- Modify `docs/operations/account-reset.md`.
- Modify `tests/release/self-host-docs.test.ts`.
- Append only `docs/engineering/handoffs/delivery/task-3.md`.

All other files are forbidden. In particular, do not modify migration 017, database tests, README, `.env.example`, job recovery, app/extension code, package/lock/root config, CI, seed, or Provider code.

## Required RED

Before repairing prose, update the focused documentation contract to require:

- the local signup guide states that committed account creation automatically initializes the fixed Popcorn profile before gateway configuration;
- the account guide says direct per-account deletion in Studio is unsupported for accounts with Popcorn data;
- the only supported personal-project removal/reset path is full local `pnpm db:reset`, which removes **all** local accounts and learning data;
- no instruction tells the user to select one Auth user and delete it;
- no account-deletion UI is promised;
- semantic prose checks operate on whitespace-normalized Markdown and remain valid when paragraphs wrap differently;
- exact commands, paths, URLs, field names, and `.env` assignments remain exact raw-text checks.

Run `pnpm vitest run tests/release/self-host-docs.test.ts` before prose repair. RED must be caused by the stale profile/reset instructions, not syntax/import/harness failure.

## Minimal GREEN

- In the local guide, add one concise factual statement that Create account commits the default `en → zh-CN` profile automatically. Do not expose trigger/migration internals to ordinary users.
- Replace the false single-account Studio deletion procedure. Supabase Studio may be mentioned as an inspection surface, but explicitly say not to use its Auth delete action for a populated Popcorn account.
- Explain that this school/personal reference setup deliberately supports full local reset, not selective account deletion. Put the destructive scope immediately next to `pnpm db:reset`.
- Keep the guide useful: if the user only wants to stop using an account without erasing every local user, sign out/disable the extension and leave stored data intact.
- Refactor test matching through a small whitespace normalization helper. Do not weaken exact command/env/port/gateway/overengineering boundary assertions.
- Append RED/GREEN and prerequisite evidence to the existing handoff; preserve original rejected-candidate history.

## Verification

```bash
pnpm vitest run tests/release/self-host-docs.test.ts
pnpm typecheck
pnpm eslint tests/release/self-host-docs.test.ts
git diff --check
```

No database reset/pgTAP/concurrency rerun is needed in this repair worktree: migration 017 already has its own accepted gate and this repair changes only prose/test matching. Do not run E2E, build, Provider, live YouTube, demo seed, account mutation, or broad application suites.

## License and submission

- No upstream material is needed. Preserve YouTube Digest MIT attribution and LLM Wiki GPLv3 method-only isolation; copy no third-party prose/code/tests/prompts/assets.
- Commit repair implementation first, then append handoff and commit it separately.
- Return both SHAs, RED/GREEN, risks, and handoff path. Do not integrate or push.
