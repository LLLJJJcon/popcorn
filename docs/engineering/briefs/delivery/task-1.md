# Delivery Task 1 — Package and license the local extension/repository

- Plan/task: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`, Task 1.
- Recorded baseline: `d18843ce920102391ab821f8c75ce4c2169d899a`.
- Implementation worktree: `/private/tmp/popcorn-delivery-1`.
- Implementation branch: `codex/popcorn-delivery-1`.
- Execution mode: strict RED, minimal GREEN, task commit, handoff, then a new read-only review Agent.

## Ownership

The implementation Agent may create or modify only:

- `LICENSE`
- `scripts/package-extension.sh`
- `scripts/check-extension-release.sh`
- `docs/operations/extension-install.md`
- `docs/operations/upstream-provenance.md`
- `tests/release/extension-package.test.ts`
- `docs/engineering/handoffs/delivery/task-1.md`

The controller owns the already-added root `package.json` command,
`docs/engineering/execution-ledger.md`, checkpoints, final integration, and
release publication. Do not modify `package.json`, `pnpm-lock.yaml`, root
configuration, migrations, generated database types, application/extension
runtime source, existing tests, existing upstream notices, or generated
`dist/` artifacts. The task may generate `dist/` locally for evidence, but it
must remain ignored and uncommitted.

## Interfaces and required behavior

Consumes:

- `pnpm extension:local` and its exact `dist/popcorn-extension` output;
- the stable public manifest key and generated runtime origins;
- `extension/UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`, and
  `third_party/youtube-digest/LICENSE`;
- the controller-owned `pnpm extension:package` command.

Produces:

- a deterministic, loadable `dist/popcorn-extension.zip`;
- the retained unpacked `dist/popcorn-extension/` directory;
- `dist/popcorn-extension.sha256`, containing the archive SHA-256 in a clear,
  checkable format;
- an MIT root license and installation/provenance documentation.

The packaging flow must build through `pnpm extension:local`, stage only an
explicit allowlist, include the generated runtime files plus the Popcorn root
MIT license, pinned YouTube Digest MIT license, and provenance, and write the
archive with stable entry order and normalized archive metadata. Repeated
packaging from identical input must yield the same SHA-256. It must not infer
files through broad directory copying.

The checker must accept the archive path, verify the recorded checksum, inspect
archive contents without extracting into the repository, and enforce:

- Manifest V3 and minimum Chrome 116;
- the unchanged stable public key;
- permissions containing Side Panel and storage support, with no retired
  `identity` permission;
- exactly the generated YouTube, App, and Supabase hosts and no direct model or
  transcript Provider host;
- all runtime references present and no unexpected archive entry;
- both MIT notices and pinned provenance present;
- no tests, source maps, `.env*`, service/job/transcript/model keys, passwords,
  tokens, cookies, source-machine paths, or other private credentials;
- no LLM Wiki source, tests, prompts, components, assets, or GPLv3 material.

The install guide must explain generating the local extension, the exact
unpacked directory and zip/checksum outputs, `chrome://extensions`, Developer
mode, Load unpacked, the stable identity, and reload/regenerate behavior. It
must not promise a Chrome Web Store release or hosted service.

## TDD evidence and verification

Write `tests/release/extension-package.test.ts` first. Expected RED:

```text
pnpm vitest run tests/release/extension-package.test.ts
```

It must fail because the root license, packaging/check scripts, and archive are
absent. Capture the concrete failing assertions before implementation. Tests
must also create safe temporary poison inputs or tampered archives to prove the
checker rejects forbidden content without exposing or deleting real secrets.

Required GREEN evidence:

```bash
APP_URL=http://127.0.0.1:3000 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-public-anon-key \
pnpm extension:package
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
pnpm vitest run tests/release/extension-package.test.ts
pnpm test:provenance
bash -n scripts/package-extension.sh
bash -n scripts/check-extension-release.sh
git diff --check
```

Also package twice and demonstrate identical checksums. Do not run the broad
application, database, concurrency, or browser suites because this task does
not modify their boundaries.

## Upstream reuse and license

- Repository: `zarazhangrui/youtube-digest`.
- Immutable commit: `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
- MIT source files/methods to adapt in place:
  - `scripts/package-extension.sh`: obtain one allowlist from the checker,
    validate version, package from a temporary path with `zip -X`, reject
    forbidden paths, and calculate SHA-256;
  - `scripts/check-release.sh`: explicit public allowlist, regular-file and
    symlink checks, manifest/runtime-reference validation, JavaScript syntax
    checks, and credential-pattern scanning;
  - `manifest.json` and `tests/release.test.js`: consume their already-adapted
    Popcorn descendants; do not replace them or copy the upstream test.
- Reuse mode: adapt the above packaging/check method to the already-generated
  Popcorn extension and its exact runtime origins. Do not create an unrelated
  parallel release pipeline.
- License action: preserve the pinned upstream notice at
  `third_party/youtube-digest/LICENSE`, include it in the distribution, add the
  Popcorn root MIT license, and record the source/commit/method mapping in
  `docs/operations/upstream-provenance.md`.
- LLM Wiki v0.6.9 / commit
  `723e259309aea5e3850265b631f80224f66dd9f6` is GPLv3 and method-only. This task
  consumes no LLM Wiki method and must copy none of its code, tests, prompts,
  components, assets, or license text into the extension archive.

## Handoff and commit

The handoff must record changed files, exact RED and GREEN command output
summaries, archive entries, checksum determinism evidence, source-to-target
reuse, license action, risks, and any generated/untracked files. Commit only
the allowlisted task files and return the commit SHA, test results, risks, and
handoff path. Do not integrate or push the task branch.
