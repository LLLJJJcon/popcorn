# Local-First Task 4 — Exact unpacked extension generator

- Plan/task: `2026-08-22-popcorn-local-first-amendments.md`, Task 4.
- Baseline commit: `3fdf173`.
- Worktree: `/private/tmp/popcorn-local-extension`.
- Ownership: runtime-config template, local extension generator, manifest
  permission reduction, background runtime-config wiring, focused release/auth
  tests, and this task's brief/handoff.
- Controller-owned: root `package.json`, checkpoint, ledger, final integration,
  and the one production `dist/popcorn-extension/` build.
- Forbidden: lockfile, migrations, generated types, auth implementation,
  Options/Side Panel/content behavior, contracts, and unrelated tests.

The generator consumes only `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and the
public `NEXT_PUBLIC_SUPABASE_ANON_KEY`. App and Supabase settings must be exact
origins: HTTPS is accepted; plain HTTP is accepted only for `localhost`, IPv4
loopback, or `[::1]`. Credentials, query strings, fragments, non-root paths,
non-HTTP protocols, and non-loopback plain HTTP are rejected.

The generated output is rebuilt from an explicit runtime allowlist. It contains
only the manifest, `runtime-config.js`, worker/auth/settings/queue/content,
Options and Side Panel HTML/CSS/JS, four prompt files, and three icons. Tests,
`UPSTREAM.md`, the source template, repository files, credentials, and arbitrary
source-directory contents are not copied. The source manifest's public key is
preserved byte-for-byte, so the unpacked extension ID remains
`meocnghfgmmcnnjiihpcgjnaameioddp`.

Expected RED: the build module and template did not exist, and `background.js`
did not load runtime configuration before auth/settings. GREEN requires exact
host permissions, deterministic repeated output, secret absence, source-value
absence, runtime-config-first execution, extension auth/queue recovery,
provenance, TypeScript, Node syntax, and baseline diff checks.

This continues the MIT adaptation of YouTube Digest commit
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`. The established manifest/package
shape, runtime files, stable key, `extension/UPSTREAM.md`,
`third_party/youtube-digest/LICENSE`, and `THIRD_PARTY_NOTICES.md` remain
preserved. LLM Wiki v0.6.9 / commit
`723e259309aea5e3850265b631f80224f66dd9f6` supplied no packaging method; no
GPLv3 code, tests, prompts, components, or assets were copied. New code remains
MIT-intended.
