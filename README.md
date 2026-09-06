# Popcorn

Popcorn is a school capstone for English-speaking learners who save Mandarin
learning moments from the YouTube video they are currently watching. This
repository supports personal self-hosting on one machine: the Next.js Web app,
local Supabase, the local worker, and an unpacked Chrome extension.

## What the project demonstrates

The extension captures snapshots from the current YouTube video (not video
files), then the Web app organizes the source in **Saved**, turns a candidate
into a sentence in **Practice**, keeps practiced expressions and source
evidence in **Vault**, and shows evidence-based counts in **Progress**. Mastery
only moves from `tried` to `reused` to `owned`.

> 中文用户请从这里开始：[中文使用指南](docs/operations/user-guide.zh-CN.md)。

## Daily local start

After completing the one-time setup in the complete
[local self-host guide](docs/operations/local-self-host.md), start Popcorn with:

```bash
pnpm popcorn:start
```

On macOS, you can instead double-click `Start Popcorn.command`. Stop it with
`pnpm popcorn:stop` or `Stop Popcorn.command`. The guide retains the manual
commands for troubleshooting and fallback use; `pnpm db:reset` is destructive
and is never part of daily startup.

## Start here

Clone the school project and follow the complete [local self-host guide](docs/operations/local-self-host.md):

```bash
git clone https://github.com/LLLJJJcon/popcorn.git
cd popcorn
pnpm install --frozen-lockfile
```

The one-time setup copies `.env.example` to `.env.local`, fills the local
Supabase values and a Supadata key obtained from the [Supadata dashboard](https://dash.supadata.ai/)
using its [official docs](https://docs.supadata.ai/), then creates a local
account. Configure the model gateway later, only in signed-in Web settings,
using its name, exact public HTTPS DNS base URL, model ID, and API key. The
gateway URL cannot use an IP, local/internal hostname, port, credentials,
query, or fragment.

For a professor demo, start Popcorn, sign in on Web and the extension, open a
YouTube video with Mandarin captions, save a moment, complete one Practice
attempt, open it in Vault, and show the resulting Progress evidence.

Credential safety: `.env.local` is ignored by Git. Never commit or paste its
values, Supadata/model keys, or passwords into issues or chat. Enter the user
gateway key only in the signed-in Web settings page.

Related guides:

- [Recover local jobs and extension saves](docs/operations/job-recovery.md)
- [Reset or remove a local account](docs/operations/account-reset.md)
- [Install the unpacked extension](docs/operations/extension-install.md)

The project is MIT licensed. Its extension transcript integration preserves
the attribution to [YouTube Digest](https://github.com/zarazhangrui/youtube-digest)
recorded in this repository.
