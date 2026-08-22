# Delivery Task 1 handoff

- Plan/task: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`, Task 1.
- Review baseline: `d18843ce920102391ab821f8c75ce4c2169d899a`.
- Task start: `2eb7ed04d6c7095bf06442f39c74da4d525cf581`.
- Worktree: `/private/tmp/popcorn-delivery-1`.

## Changed files

- `LICENSE`
- `scripts/package-extension.sh`
- `scripts/check-extension-release.sh`
- `docs/operations/extension-install.md`
- `docs/operations/upstream-provenance.md`
- `tests/release/extension-package.test.ts`
- `docs/engineering/handoffs/delivery/task-1.md`

No runtime source, root configuration, package/lock file, migration, existing
test, ledger, checkpoint, or tracked `dist/` artifact was changed.

## RED evidence

The test was created before the implementation. A direct focused Vitest run
reported 6/6 failures because the release entry point did not exist:

```text
bash: scripts/package-extension.sh: No such file or directory
expected 127 to be +0
```

The first attempt through the Codex `pnpm` fallback stopped before Vitest
because the isolated worktree reused another worktree's dependency tree. That
environment error was not counted as RED; the same Vitest binary was run
directly from the read-only dependency tree to obtain the product-level RED.

During GREEN hardening, a focused tampered-archive test also demonstrated that
a JSON credential assignment (`{"apiKey":"delivery-poison-secret-value"}`)
was initially accepted. It failed 1/7 at the expected non-zero-exit assertion.
Allowing the optional JSON key quote in the upstream-derived generic
credential-assignment scanner made that test pass without loosening the
archive contract.

## GREEN evidence

- `pnpm vitest run tests/release/extension-package.test.ts`: 1 file, 7/7 tests passed.
- `pnpm test:provenance`: 2 files, 11/11 tests passed.
- `bash scripts/check-extension-release.sh dist/popcorn-extension.zip`: 23 allowlisted files accepted.
- `bash -n scripts/package-extension.sh`: passed.
- `bash -n scripts/check-extension-release.sh`: passed.
- `git diff --check`: passed.

The isolated worktree verification set
`pnpm_config_verify_deps_before_run=false` when invoking `pnpm` so pnpm would
not try to rewrite the read-only linked dependency tree. The package script
uses the existing `pnpm extension:local` entry point with the same no-repair
setting; a normal clone with its own installed dependencies needs no special
environment setting.

Two consecutive packages from the same three public fixture settings produced
the identical SHA-256:

```text
cd1990b2829a537aef92ae712b4bf27e64f852b8647d9e959b74d83d9fd2666c
cd1990b2829a537aef92ae712b4bf27e64f852b8647d9e959b74d83d9fd2666c
```

## Archive entries

```text
LICENSE
UPSTREAM.md
auth.js
background.js
content.js
icons/icon128.png
icons/icon16.png
icons/icon48.png
manifest.json
options.css
options.html
options.js
prompts/analysis.md
prompts/explain.md
prompts/note-cleanup.md
prompts/translation.md
runtime-config.js
settings.js
sidepanel.css
sidepanel.html
sidepanel.js
sync-queue.js
third_party/youtube-digest/LICENSE
```

The checker rejects a mismatched checksum, an extra `.env.local`, a direct
model Provider host, a private credential in an allowlisted JavaScript file,
and an allowlisted entry stored as a symbolic link. Poison artifacts are made
under an operating-system temporary directory and removed after each test.

## Upstream reuse and license

Pinned source: `zarazhangrui/youtube-digest` commit
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`.

- `scripts/package-extension.sh` adapts the upstream checker-owned allowlist,
  version validation, temporary staging, `zip -X`, private-path rejection, and
  SHA-256 method to the generated Popcorn extension.
- `scripts/check-extension-release.sh` adapts the upstream explicit public
  allowlist, regular-file/symlink checks, manifest/runtime-reference checks,
  JavaScript syntax checks, and credential scanning.
- Existing Popcorn descendants of upstream `manifest.json` and
  `tests/release.test.js` are consumed rather than replaced or recopied.
- The root repository and archive include the Popcorn MIT license. The archive
  also preserves the pinned YouTube Digest MIT notice at
  `third_party/youtube-digest/LICENSE` and packages the reviewable mapping as
  `UPSTREAM.md`.
- No LLM Wiki method is consumed. No LLM Wiki/GPLv3 code, tests, prompts,
  components, assets, or license text is copied.

## Generated and untracked state

`dist/popcorn-extension/`, `dist/popcorn-extension.zip`, and
`dist/popcorn-extension.sha256` remain generated and ignored. The worktree used
an untracked `node_modules` symlink to the controller's read-only dependency
tree for verification; it must be removed before committing.

## Risks

- Packaging requires local `pnpm`, Node.js, Info-ZIP `zip`/`unzip`, and
  `shasum`, which are documented by command failure if absent.
- Byte-for-byte determinism is proven for repeated builds with identical
  inputs and the same ZIP implementation. Different ZIP implementations may
  choose different compression bytes even though timestamps, entry order, and
  extra metadata are normalized.
- The Supabase anonymous key is intentionally public extension configuration;
  private service, job, transcript, or model-provider credentials are not
  eligible for the archive.

## Review repair 1 — runtime Provider endpoint rejection

Review repair baseline: `9d4bbac1956627665c7c59e31bc32aef4389f077`.
The repair changed only the release test, archive checker, Chrome installation
guide, and this append-only handoff section.

### Repair RED evidence

Two negative archive tests tampered allowlisted `background.js` while leaving
the generated manifest and its host permissions unchanged:

- model Provider: `https://api.deepseek.com/v1/chat/completions`;
- transcript Provider: `https://api.supadata.ai/v1/youtube/transcript`.

Before changing the checker, the focused run reported 2 failures and 7 passes.
Both failures were the expected `expected +0 not to be +0`, proving the current
checker accepted each tampered archive.

### Repair policy and GREEN evidence

The checker now scans absolute HTTP(S) URLs in every allowlisted runtime
JavaScript file. An origin is accepted only when it exactly matches the
generated Popcorn App origin, generated Supabase origin,
`https://www.youtube.com`, or the required YouTube thumbnail origin
`https://i.ytimg.com`. Every other runtime origin is rejected as a direct
Provider endpoint or disallowed runtime URL. This is an origin boundary, not a
Provider catalog, and does not constrain the server-side Provider-neutral
gateway configuration.

The installation guide now states Chrome 116+ as a prerequisite. Focused
verification after the repair:

- `pnpm vitest run tests/release/extension-package.test.ts`: 1 file, 9/9 tests passed;
- `pnpm test:provenance`: 2 files, 11/11 tests passed;
- `bash scripts/check-extension-release.sh dist/popcorn-extension.zip`: 23 allowlisted files accepted;
- `bash -n scripts/check-extension-release.sh`: passed;
- `git diff --check`: passed.

The isolated worktree again used
`pnpm_config_verify_deps_before_run=false` to prevent the Codex pnpm wrapper
from trying to replace its linked dependency tree. Without that setting the
wrapper stopped before running the repository script with
`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; this was an environment setup
failure, not a product test failure.

Two consecutive fixed-input packages retained the valid generated bundle and
produced the same SHA-256:

```text
cd1990b2829a537aef92ae712b4bf27e64f852b8647d9e959b74d83d9fd2666c
cd1990b2829a537aef92ae712b4bf27e64f852b8647d9e959b74d83d9fd2666c
```

No packager, runtime source, root configuration, package/lock file, migration,
ledger/checkpoint, tracked `dist/` artifact, upstream mapping, or license text
was changed. Existing MIT notices and the GPLv3 method-only boundary remain
unchanged.
