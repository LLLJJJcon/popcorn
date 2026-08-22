# Delivery Task 1 review fix 1 — Reject runtime Provider endpoints

- Plan/task: revised GitHub Delivery Task 1 review repair.
- Review range baseline: `d18843ce920102391ab821f8c75ce4c2169d899a`.
- Rejected candidate: `9f62c72a80502690f4c335d687c88d4b507c73d9`.
- Repair worktree: `/private/tmp/popcorn-delivery-1-fix-1`.
- Reviewer finding: P1 runtime Provider endpoint acceptance and P2 missing
  Chrome 116+ documentation.

## Allowed files

- `tests/release/extension-package.test.ts`
- `scripts/check-extension-release.sh`
- `docs/operations/extension-install.md`
- `docs/engineering/handoffs/delivery/task-1.md` (append-only repair section)
- this controller brief

Everything else is forbidden, including the packager, license/provenance
documents, package/lock files, runtime source, migrations, ledger/checkpoints,
and generated `dist/` artifacts.

## Required RED and minimal GREEN

First add negative archive tests that put direct model and transcript Provider
URLs inside an allowlisted runtime JavaScript file while leaving
`manifest.host_permissions` valid, then rebuild the archive and checksum. The
current checker must fail those assertions because it exits 0. Record the
actual RED.

Then minimally extend the archive-content checker so shipped runtime code can
reference only the generated App/Supabase origins and product-required YouTube
or YouTube media origins. It must reject direct model/transcript Provider
endpoints such as OpenAI-compatible hosted APIs, DeepSeek, and Supadata even
when they are not manifest hosts. Avoid a catalog of supported model vendors;
this is a distribution-boundary check, not a gateway catalog. Do not reject the
user's Provider-neutral gateway configuration on the server—the extension
still calls only Popcorn.

Add `Chrome 116+` to the unpacked-install prerequisites. Preserve every prior
tamper test and current valid archive.

Required focused verification:

```bash
pnpm vitest run tests/release/extension-package.test.ts
pnpm test:provenance
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
bash -n scripts/check-extension-release.sh
git diff --check
```

Package twice with the fixed public local values from the parent brief and
confirm identical checksums. No DB, E2E, app build, load, or concurrency gate.

## Upstream and license

Continue the checker-content-scan adaptation from YouTube Digest
`scripts/check-release.sh` at immutable MIT commit
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`. Preserve both MIT notices and the
existing provenance mapping. LLM Wiki `723e259309aea5e3850265b631f80224f66dd9f6`
remains GPLv3 method-only; copy no code, tests, prompts, components, or assets.

Append RED/GREEN evidence and the exact policy to the existing handoff, commit
only the allowlist, and return the repair SHA, results, risks, and handoff path.
