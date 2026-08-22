# Popcorn

Popcorn is a school capstone for English-speaking learners who save Mandarin
learning moments from the YouTube video they are currently watching. This
repository supports personal self-hosting on one machine: the Next.js Web app,
local Supabase, the local worker, and an unpacked Chrome extension.

## Local start

Use Node.js 20, pnpm 11.19.0, and Docker, then follow the complete
[local self-host guide](docs/operations/local-self-host.md). The shortest start
is:

```bash
pnpm install --frozen-lockfile
pnpm exec supabase start
pnpm db:reset
pnpm dev
```

`pnpm db:reset` is destructive to the local Popcorn database. Read the full
guide before using it.

Related guides:

- [Recover local jobs and extension saves](docs/operations/job-recovery.md)
- [Reset or remove a local account](docs/operations/account-reset.md)
- [Install the unpacked extension](docs/operations/extension-install.md)

The project is MIT licensed. Its extension transcript integration preserves
the attribution to [YouTube Digest](https://github.com/zarazhangrui/youtube-digest)
recorded in this repository.
