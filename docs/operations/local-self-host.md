# Run Popcorn locally

This is the supported personal setup for the school project: one Next.js Web
app, one local Supabase stack, one local worker, and one unpacked Chrome
extension on the same computer.

## 1. Prerequisites

- Node.js 20
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

The URL and anon key are public, browser-safe configuration. The service-role
key, Supadata key, and job secret are server-only. Generate a personal job
secret with `openssl rand -hex 32`, paste the output into `.env.local`, and use
the same value when starting the worker. Never commit `.env.local`.

The user model gateway API key is deliberately not an environment value. You
enter it only in the signed-in Web settings described below.

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

## 11. Shutdown

Press Ctrl-C in the worker terminal and the Web terminal, then stop local
Supabase:

```bash
pnpm exec supabase stop
```

Chrome keeps the unpacked extension installed. Disable it from
`chrome://extensions` when you are not using Popcorn.

An optional hosted adaptation would need equivalent environment values and
HTTPS, but it is outside this personal local guide.
