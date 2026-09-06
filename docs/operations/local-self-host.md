# Run Popcorn locally

This is the supported personal setup for the school project: one Next.js Web
app, one local Supabase stack, one local worker, and one unpacked Chrome
extension on the same computer.

Complete the one-time setup below after cloning. Once it is complete, use the
daily one-click launcher instead of repeating the manual commands:

```bash
pnpm popcorn:start
```

On macOS, double-click `Start Popcorn.command` in the repository instead. The
launcher starts local Supabase, the Web app, and the worker; waits for `APP_URL`;
then opens Popcorn in your browser. Keep the launcher terminal open while you
use Popcorn. To stop it without resetting accounts or learning data, run:

```bash
pnpm popcorn:stop
```

Or double-click `Stop Popcorn.command` on macOS. The manual commands below are
the troubleshooting and fallback path when a setup step needs attention.

This is a personal school-project deployment, not a hosted service. It is
designed for English-speaking learners studying Mandarin and stores learning
snapshots from the current YouTube video rather than downloading video files.

## 0. Clone the project

```bash
git clone https://github.com/LLLJJJcon/popcorn.git
cd popcorn
```

## 1. Prerequisites

- Node.js 24.5 or later (Node 24.5 introduced the built-in environment proxy
  support used by the optional setting below)
- pnpm 11.19.0
- Docker running locally
- Chrome 116+

The Supabase CLI is a project-local development dependency. Use it through
`pnpm exec`; a separate global CLI install is not needed.

## 2. Install the pinned dependencies

From the repository root:

```bash
pnpm install --frozen-lockfile
```

## 3. Start local Supabase

```bash
pnpm exec supabase start
pnpm exec supabase status
```

The defaults in `supabase/config.toml` are:

- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`

Copy the environment template and keep the local copy out of Git:

```bash
cp .env.example .env.local
```

Use the current `pnpm exec supabase status` output to fill `.env.local`:

- `APP_URL=http://127.0.0.1:3000`
- API URL → `NEXT_PUBLIC_SUPABASE_URL`
- publishable/anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- secret/service-role key → `SUPABASE_SERVICE_ROLE_KEY`
- your Supadata key → `SUPADATA_API_KEY`
- a personal random value → `INTERNAL_JOB_SECRET`
- optional local HTTP/Mixed proxy origin → `POPCORN_PROXY_URL`

The URL and anon key are public, browser-safe configuration. The service-role
key, Supadata key, and job secret are server-only. Generate a personal job
secret with `openssl rand -hex 32`, paste the output into `.env.local`, and use
the same value when starting the worker. Never commit `.env.local`.

The user model gateway API key is deliberately not an environment value. You
enter it only in the signed-in Web settings described below.

### Optional local HTTP proxy

`POPCORN_PROXY_URL` is optional and affects only the local Web app and worker.
Use one exact `http://` or `https://` proxy origin, with no path, query, hash,
username, or password.

- **Direct access:** leave it blank.
- **True TUN/global routing:** normally leave it blank; that routing already
  covers Node as well as the browser.
- **Browser/system-proxy-only routing:** enter your own local **HTTP/Mixed**
  proxy origin once, for example `http://127.0.0.1:8080` if that is the port
  shown by your proxy application. Do not use a SOCKS-only port here.

Open the proxy application's network, port, or listener page and find the HTTP/Mixed proxy port; use that port to form the origin above. Popcorn does
not auto-detect or change macOS, Windows, or Linux proxy settings. It does not
need the value for direct access or true TUN/global routing.

After changing the value, stop and restart with the usual one-click commands:
`pnpm popcorn:stop`, then `pnpm popcorn:start` (or the matching macOS command
files). If the proxy is wrong or unavailable, correct its host/port or leave
the setting blank and restart. The model API key still belongs only in the
signed-in gateway page, never in `.env.local`.

## 4. Apply the local schema

**Destructive to the local Popcorn database:** the following command erases
its local accounts and learning data, reapplies migrations, and loads the
local seed. Never use it against a hosted database.

```bash
pnpm db:reset
```

Run this for a fresh school demo or when you intentionally want a full local
reset. It is not needed on every start.

## 5. Start the Web app and create the local account

In Terminal 1:

```bash
pnpm dev
```

Open `http://127.0.0.1:3000/sign-in`. Choose **Create account** with an email
and a 6–128 character password, then use **Sign in**. Local Supabase defaults
to `enable_confirmations = false`, so this path does not require an email.
When **Create account** commits successfully, Popcorn automatically initializes
the fixed default `en → zh-CN` profile before you configure the model gateway.
Mailpit at `http://127.0.0.1:54324` is only where a confirmation email appears
if you intentionally enable email confirmation later.

## 6. Configure the user model gateway

After you sign in, open `http://127.0.0.1:3000/settings/model-gateway`. Enter
the gateway display name, its exact OpenAI-compatible HTTPS base URL, the
model name, and the API key. The API key is entered only in Web settings; do
not put it in `.env.local`, a shell command, the extension, logs, or a commit.

Review the exact destination shown by Popcorn, grant exact-destination consent,
and activate the configuration. The worker will use this user-owned gateway;
it is not limited to an OpenAI-hosted model.

## 7. Start the local worker

Keep Terminal 1 running. In a separate Terminal 2, load the server values and
start the worker:

```bash
set -a
source .env.local
set +a
pnpm worker:local
```

The Web app and worker must run in separate terminals. The worker repeatedly
processes a bounded number of durable jobs and continues after an empty or
transiently failed cycle. Stop it cleanly with Ctrl-C.

## 8. Generate and load the extension

In a separate Terminal 3, load the same local configuration and generate the
unpacked extension:

```bash
set -a
source .env.local
set +a
pnpm extension:local
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load
unpacked**, and select the repository's `dist/popcorn-extension` directory.
Sign in to the extension with the same local account. For packaging details
and reload behavior, see [extension installation](extension-install.md).

## 9. Optional fixed demo data

After the account exists, you may add the fixed school-demo learning history.
Use exactly one existing local email or UUID as the scope:

```bash
set -a
source .env.local
set +a
pnpm demo:seed -- --user your-local-email@example.test
```

This is optional; it does not create an account and does not call Supadata or
the model gateway.

## 10. Local troubleshooting

- Web unavailable: keep Supabase running, confirm `.env.local`, and restart
  `pnpm dev` in Terminal 1.
- Worker reports `failed`: confirm Web is reachable, `APP_URL` and
  `INTERNAL_JOB_SECRET` match the Web environment, then restart the worker.
- Transcript work remains pending: check `SUPADATA_API_KEY`, then leave Web
  and worker running so the durable job can retry.
- AI work remains pending: return to `/settings/model-gateway` and verify the
  exact gateway destination is active with consent.
- Extension save remains pending: preserve the extension queue, sign in as
  the same local account, restore Web/worker, and follow the
  [recovery guide](job-recovery.md).
- Extension changed: run `pnpm extension:local` again and select **Reload** in
  `chrome://extensions`.
- Service unavailable or a save is queued: keep Supabase, Web, worker, and the
  extension running; confirm the Web session uses the same local account, then
  wait for the durable retry. Do not repeatedly create the same save.
- No transcript: confirm the current video has usable captions and that
  `SUPADATA_API_KEY` is present locally; leave the worker running and retry the
  save after correcting the key.
- Model timeout or malformed output: check that the active gateway's exact
  base URL and model ID are correct, check the optional proxy below, then retry
  the organization step. The original snapshot remains in Saved.
- Practice evaluation failure: keep the sentence and source evidence on the
  page, verify the active gateway and proxy, and submit the same attempt again.
- Local proxy routing: `POPCORN_PROXY_URL` must be your own exact HTTP/Mixed
  origin (for example `http://127.0.0.1:8080`), never a SOCKS-only port. Leave
  it blank for direct access or true TUN/global routing; after changing it,
  run `pnpm popcorn:stop` and `pnpm popcorn:start`.

## 11. End-to-end learning flow

1. Sign in to the Web app and the unpacked extension with the same local
   account, then open a public YouTube video with Mandarin captions.
2. In the extension, save the current moment, caption lines, selected text,
   Key Quote, or AI Explanation. Popcorn keeps a snapshot and processes it in
   the background; it does not save a video file.
3. Click **Open Popcorn**, open the video in **Saved**, and review the original
   evidence and processing state.
4. Choose a candidate and click **Practice this expression**. Write a new
   Chinese sentence; if evaluation fails, the input and evidence remain for a
   retry.
5. After a valid first attempt, choose **Open in Vault**. Vault groups the
   expression, source evidence, and attempt history; it is not a duplicate
   Saved list.
6. Use **Practice** for due new-context reviews and **Progress** for weekly
   practice, due completions, independent reuse, and `tried`/`reused`/`owned`
   distribution. Saving more items alone does not increase mastery.

## 12. Professor-demo checklist

- [ ] `pnpm popcorn:start` opens the local app; show that `pnpm db:reset` is
      not a daily command.
- [ ] Sign in on Web and in the extension with one local account.
- [ ] Save one current-YouTube snapshot, then show it in **Saved**.
- [ ] Complete one **Practice** attempt and show the expression in **Vault**.
- [ ] Show the corresponding evidence in **Progress**.
- [ ] Explain that `.env.local` and all keys stay local, and that the gateway
      key is entered only in signed-in Web settings.

## 13. Shutdown and manual fallback

For daily one-click use, run `pnpm popcorn:stop` (or double-click `Stop
Popcorn.command` on macOS). It stops the launcher and local Supabase without
resetting or deleting local accounts or learning data.

If you started the services manually, press Ctrl-C in the worker terminal and
the Web terminal, then stop local Supabase:

```bash
pnpm exec supabase stop
```

Chrome keeps the unpacked extension installed. Disable it from
`chrome://extensions` when you are not using Popcorn.

An optional hosted adaptation would need equivalent environment values and
HTTPS, but it is outside this personal local guide.
