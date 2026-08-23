# Popcorn

Popcorn is a school capstone for English-speaking learners who save Mandarin
learning moments from the YouTube video they are currently watching. This
repository supports personal self-hosting on one machine: the Next.js Web app,
local Supabase, the local worker, and an unpacked Chrome extension.

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

Related guides:

- [Recover local jobs and extension saves](docs/operations/job-recovery.md)
- [Reset or remove a local account](docs/operations/account-reset.md)
- [Install the unpacked extension](docs/operations/extension-install.md)

The project is MIT licensed. Its extension transcript integration preserves
the attribution to [YouTube Digest](https://github.com/zarazhangrui/youtube-digest)
recorded in this repository.
