# Revised Delivery Task 3 Brief — Fresh-clone personal self-host guide

## Assignment

- Plan: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`
- Task: 3, **Write the fresh-clone personal self-host guide**
- Baseline commit: `7e5920be87f015632d39ab4f31b8b08496716858`
- Worktree: `/private/tmp/popcorn-delivery-3`
- Branch: `codex/popcorn-delivery-3`
- Product profile: school capstone and personal GitHub self-host; one supported local path, not a commercial deployment guide.

## Allowed files

- Create `README.md`
- Create `docs/operations/local-self-host.md`
- Create `docs/operations/job-recovery.md`
- Create `docs/operations/account-reset.md`
- Modify `.env.example`
- Create `tests/release/self-host-docs.test.ts`
- Create or append `docs/engineering/handoffs/delivery/task-3.md`
- This brief

All other files are forbidden, including application/extension code, `package.json`, lockfiles, workspace/root configuration, migrations, generated database types, CI, deployment files, fixtures, and Task 2 seed code.

## Consumed interfaces and verified facts

- Node.js 20 and exact `packageManager: pnpm@11.19.0`.
- Project-local Supabase CLI (`supabase` dev dependency), Docker, and Chrome 116+.
- Root scripts: `dev`, `db:reset`, `worker:local`, `extension:local`, `demo:seed`.
- Local Supabase defaults from `supabase/config.toml`: API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, Mailpit/local SMTP UI `http://127.0.0.1:54324`, email confirmations disabled by default.
- `/sign-in` supports **Create account** and **Sign in** with email/password; password length is 6–128.
- `dist/popcorn-extension` is the unpacked directory loaded from `chrome://extensions`; the generator consumes only `APP_URL`, public Supabase URL, and public anon key.
- `worker:local` consumes `APP_URL` and `INTERNAL_JOB_SECRET`, repeatedly calls the bounded durable processor, continues after empty/transient failures, and stops with SIGINT/SIGTERM.
- The server processor additionally needs local Supabase URL, service-role key, `SUPADATA_API_KEY`, and the same job secret.
- The user model gateway is configured only after sign-in at `/settings/model-gateway`: gateway display name, exact OpenAI-compatible HTTPS base URL, model, write-only API key, then exact-destination consent/activation. The gateway key must not appear in `.env`, shell commands, README examples, extension files, logs, or handoff.
- Task 2 CLI: `pnpm demo:seed -- --user <existing-email-or-UUID>`, local loopback only, no password argument.
- Existing focused install/package details: `docs/operations/extension-install.md`.

## Produced interfaces

- A short root README leading a fresh clone to the complete local guide and showing the minimal start path.
- One ordered, copy/pasteable personal self-host path covering prerequisites, frozen install, Supabase start/reset, obtaining local public/server values without committing them, `.env.local`, Web startup, local account creation, gateway setup, local worker, extension generation/load, optional demo seed, troubleshooting, and orderly shutdown.
- A concise recovery guide for the durable local worker/extension pending queue, with no operator API/dashboard/platform.
- A concise local account reset/removal guide that truthfully says there is no account-deletion UI.
- A commented `.env.example` that distinguishes:
  - public browser-safe anon key and local public URLs;
  - server-only Supabase service-role, Supadata, and job secret;
  - user model gateway key, which is deliberately absent and entered only in Web settings.

## Required RED evidence

First create `tests/release/self-host-docs.test.ts` and run it before adding/changing the guides. The RED test must fail because the required docs and `.env.example` contract are absent/incomplete, not because of a syntax or import error. It must assert, at minimum:

- exact commands:
  - `pnpm install --frozen-lockfile`
  - `pnpm exec supabase start`
  - `pnpm db:reset`
  - `pnpm dev`
  - `pnpm worker:local`
  - `pnpm extension:local`
  - `pnpm demo:seed -- --user`
- ordered start sequence and explicit separate terminal requirements for Web/worker;
- Node 20, pnpm 11.19.0, Docker, project-local Supabase CLI, Chrome 116+;
- local API/Studio/Mailpit ports and the default no-confirmation account path;
- `dist/popcorn-extension` plus `chrome://extensions` load-unpacked instructions;
- all six environment fields and their public/server roles;
- absence of `OPENAI_API_KEY`, `OPENAI_MODEL`, and any user gateway key variable from `.env.example`;
- gateway name/base URL/model/API key configured only in Web settings with exact-destination consent;
- account reset/removal via local Supabase, no account-deletion UI;
- shutdown commands/keys and focused troubleshooting for server, worker, extension pending queue, Supadata, and gateway consent;
- no Vercel, production hardening, WAF/firewall, SLO, quota/load, operator dashboard/status API, backup drill, multi-tenant/commercial deployment instructions.

Do not make the documentation contract brittle to harmless prose, headings, whitespace, or Markdown wrapping. Check operational facts and commands, not an essay snapshot.

## Minimal GREEN implementation

- Keep `README.md` concise; put detail in `docs/operations/local-self-host.md` and link the three operational guides plus existing extension install guide.
- Support one local topology only: Next.js + local Supabase + local worker + unpacked Chrome extension.
- A short clearly optional hosted note may state that hosted deployments need equivalent environment values and HTTPS, but must not become a deployment tutorial.
- Tell the reader to copy `.env.example` to `.env.local`, use `pnpm exec supabase status` to obtain current local values, and never commit `.env.local`.
- Explain that the anon key is public configuration; service-role, Supadata, and job secret stay server-only. Recommend generating a personal random job secret, without adding secret-management infrastructure.
- Document the default `enable_confirmations = false` path. Mention Mailpit only as the local place to view confirmation email if the user intentionally enables confirmations.
- `pnpm db:reset` is destructive to the **local Popcorn database**; state this immediately adjacent to the command and never suggest it for a hosted database.
- For single local account removal, use Supabase Studio Authentication/Users; for a full local reset, use `pnpm db:reset`. Do not promise an in-product account-delete action.
- Document only bounded school-demo recovery: keep/restart Web and worker, inspect generic worker categories, reload regenerated extension, preserve/retry pending queue, use one exact user scope for demo seed, and restart local services. No commercial operations platform.

## Setup-safe verification

Required before implementation commit:

```bash
pnpm vitest run tests/release/self-host-docs.test.ts
pnpm typecheck
pnpm eslint tests/release/self-host-docs.test.ts
git diff --check
```

Also run every documented read-only or setup-safe command that does not require destructive reset or live credentials. At minimum verify actual `package.json` scripts, `pnpm exec supabase --version`, `pnpm exec supabase status` when local state is available, and `pnpm extension:local` with local public placeholder/actual values into its normal generated directory. Do **not** run `pnpm db:reset`, create/delete accounts, use Provider credentials, perform live YouTube/model calls, or alter the current disposable database for this documentation task. If a documented long-running command is started for a smoke, terminate it cleanly and record the bounded evidence.

Do not run pgTAP, full E2E, production build, concurrency/load, or full application verification: this is documentation plus a release-contract test and does not change runtime/shared/database boundaries.

## Upstream reuse and licensing

- YouTube Digest: `zarazhangrui/youtube-digest` at `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; no upstream code should be copied for this task. Preserve existing MIT attribution links when referencing extension behavior.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9 / `723e259309aea5e3850265b631f80224f66dd9f6`; method-only reference remains isolated. Do not copy GPLv3 code, tests, prompts, components, text, or assets.
- Root project remains MIT. Do not paste third-party documentation text; write original operational prose.

## Submission protocol

1. Commit the implementation and RED/GREEN test as one task commit.
2. Append a handoff with RED output, GREEN output, setup-safe command evidence, exact changed files, unresolved risks, upstream/license result, and implementation SHA.
3. Commit the handoff separately.
4. Return both commit SHAs, test summary, risks, and handoff path. Do not integrate or push.
