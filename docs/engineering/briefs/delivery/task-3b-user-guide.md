# Delivery Task 3B Brief — Chinese user operation guide

## Identity

- Approved amendment: user-requested README-style operation manual after revised Delivery Task 3A
- Baseline commit: `fded75f1bc9f759677a21ef67a351957ddd45357`
- Implementation branch: `codex/popcorn-user-guide`
- Implementation worktree: `/private/tmp/popcorn-user-guide`
- Integration branch: `codex/popcorn-youtube-learning`
- License: repository MIT license; all new prose must be original

## Goal

Give a non-technical Chinese-speaking self-host user one accurate guide for
installing, configuring, starting, using, stopping, and troubleshooting
Popcorn. Explain where every required value is entered and how the user obtains
it without ever asking the user to paste a secret into chat, a terminal command,
or Git.

## Allowed files

- Create `docs/operations/user-guide.zh-CN.md`
- Modify `README.md`
- Modify `tests/release/self-host-docs.test.ts`
- Create `docs/engineering/handoffs/delivery/task-3b-user-guide.md`

## Forbidden files and changes

- Do not modify application, extension, worker, migration, shared-contract,
  root configuration, dependency, lockfile, CI, or launcher files.
- Do not modify `.env.example` or the existing English operations guides.
- Do not add a dependency, screenshot, generated asset, account credential,
  Provider secret, private base URL, or copied Provider documentation.
- Do not change the product scope or imply hosted/commercial deployment.

## Consumed interfaces

- `README.md` and `docs/operations/local-self-host.md`
- `.env.example` with exactly six local runtime fields
- `package.json` scripts `popcorn:start`, `popcorn:stop`, `db:reset`,
  `extension:local`, and `demo:seed`
- `Start Popcorn.command` and `Stop Popcorn.command`
- Web route `/settings/model-gateway`
- Gateway transport rule: the user supplies an HTTPS OpenAI-compatible API
  root such as an official provider's `/v1` base; Popcorn appends
  `/chat/completions`, so the user must not enter the full completion endpoint
- Chrome loads `dist/popcorn-extension` through `chrome://extensions`
- Local Supabase defaults: API `http://127.0.0.1:54321`, Studio
  `http://127.0.0.1:54323`, Mailpit `http://127.0.0.1:54324`

## Produced interfaces

- README exposes a prominent Chinese guide link.
- The Chinese guide has a short path for daily use and a clearly separated
  one-time setup path.
- One configuration table names all six `.env.local` fields, their exact
  location, source, example shape, and whether they are secret.
- A second table explains the four Web-only gateway fields: display name,
  exact HTTPS base URL, model ID, and API key.

## Required content

1. State that the current product is a personal local school project for an
   English-native learner studying Mandarin from the YouTube video currently
   being watched.
2. Prerequisites: Git, Docker Desktop running, Node.js 20, pnpm 11.19.0, and
   Chrome 116+. Link only to official download/install documentation.
3. Explain fresh checkout, locked dependency install, Docker startup, local
   Supabase bootstrap, `.env.example` to `.env.local`, the one intentional
   initial `pnpm db:reset`, account creation, model-gateway setup, extension
   generation/loading, and first launch.
4. Explain how each `.env.local` value is obtained:
   - `APP_URL` is fixed to `http://127.0.0.1:3000`.
   - Supabase URL/anon/service-role values come from the current local
     `pnpm exec supabase status` output.
   - `SUPADATA_API_KEY` comes from the user's Supadata dashboard after signup.
   - `INTERNAL_JOB_SECRET` is generated locally with `openssl rand -hex 32`.
5. Explain that the gateway key is never placed in `.env.local`; after sign-in,
   enter display name, official OpenAI-compatible HTTPS API root, exact model
   ID, and API key at `/settings/model-gateway`, confirm the displayed exact
   destination, then activate it. State that OpenAI itself is not required.
6. Explain the actual user workflow: start, sign in to Web and extension, open
   a public YouTube watch page, choose transcript language display, save in the
   background, inspect Saved, use learning material, search Vault, complete
   Practice, and read Progress. Preserve `tried -> reused -> owned` wording.
7. Explain daily one-click start/stop and that configuration, local account,
   learning data, and unpacked extension persist across normal stops.
8. Provide symptom-based troubleshooting for Docker/Supabase, Web, extension,
   pending transcript/Supadata, pending AI/gateway consent, and the destructive
   meaning of `pnpm db:reset`.
9. Clearly distinguish what works without external keys (local UI and fixture
   demo) from what requires real Supadata and gateway credentials.
10. Never instruct the user to paste a secret into chat, commit `.env.local`,
    expose a service-role key to Chrome, or enter the gateway key in a shell.

## Official references

- Node.js downloads: `https://nodejs.org/en/download`
- pnpm installation: `https://pnpm.io/installation`
- Docker Desktop: `https://docs.docker.com/get-started/introduction/get-docker-desktop/`
- Chrome: `https://www.google.com/chrome/`
- Supadata getting started: `https://docs.supadata.ai/`
- Supadata dashboard: `https://dash.supadata.ai/`
- Model gateway values must come from the chosen Provider's own official API
  documentation and console; do not copy third-party tutorials or promise that
  an unverified Provider is compatible.

## TDD evidence

- First add a focused documentation contract to
  `tests/release/self-host-docs.test.ts` that fails because the README link and
  Chinese guide do not yet exist. The test must at minimum prove that the
  README-linked guide path resolves, all six local runtime field names are
  represented, the four Web-only gateway inputs are distinguished, and daily
  start/stop entry points are present.
- Record the exact RED command and expected missing-guide/link failure.
- Then add the minimum guide and README link required for GREEN.
- Do not add brittle assertions for whole paragraphs or vendor marketing copy.

## Verification

```bash
pnpm vitest run tests/release/self-host-docs.test.ts
pnpm exec eslint tests/release/self-host-docs.test.ts
git diff --check
git status --short
```

## Handoff contract

Commit all allowed-file changes. Write the complete RED/GREEN evidence,
verification output, files changed, risks, and self-review to
`docs/engineering/handoffs/delivery/task-3b-user-guide.md`. Return only status,
commit SHA, test summary, concerns, and the report path to the controller.
