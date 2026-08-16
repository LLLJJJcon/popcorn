# Task Handoff
- Status: DONE
- Plan and task: `2026-08-16-popcorn-foundation-contracts.md`, Foundation Task 1
- Worktree and branch: `/private/tmp/popcorn-foundation-1`, `codex/popcorn-foundation-1`
- Baseline SHA: `abb4a271a7bbe9d04ad3ace12615e853b8c50e85`
- Commit SHA: recorded by the commit that includes this handoff

## Implemented
Scaffolded the minimal Next.js/Tailwind/ESLint baseline, package scripts, Vitest/Playwright configuration, and product heading. Added the reproducible YouTube Digest intake script and exact vendored allowlist with preserved MIT attribution.

## Upstream provenance used
Source: `https://github.com/zarazhangrui/youtube-digest.git`; immutable ref: `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; action: exact allowlisted reuse via `scripts/vendor-youtube-digest.sh`. The script clones, checks out, and verifies `HEAD`; `extension/UPSTREAM.md` maps every source to target. A fresh re-clone byte-compared all 24 copied files (including `LICENSE`) successfully.

## Interfaces consumed and produced
Consumed the approved product headline and pinned upstream commit. Produced all required root scripts, a buildable Next.js baseline, `extension/`, provenance tests, `third_party/youtube-digest/LICENSE`, and third-party notice.

## Files changed
Added Task 1 root/config support: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, TypeScript/Next/Vitest/Playwright/ESLint/PostCSS configs, `.gitignore`, `.env.example`, and `THIRD_PARTY_NOTICES.md`; app/test sources under `src/`; vendor script; provenance test; `extension/UPSTREAM.md`; the 23 allowlisted extension files; and `third_party/youtube-digest/LICENSE`. Added no later contracts, migrations, or Supabase initialization.

## TDD evidence
### RED
`pnpm vitest run src/app/page.test.tsx tests/provenance/youtube-digest.test.ts` exited 1 before vendor/page implementation: the page test could not find heading `Turn Chinese videos into language you can use`; provenance failed `ENOENT` for `extension/UPSTREAM.md`.

### GREEN
The same command exited 0 after the minimum heading and pinned intake implementation: 2 files passed, 2 tests passed.

## Broader verification
All exited 0 with fresh output: `pnpm lint`; `pnpm typecheck`; `pnpm build`; `bash -n scripts/vendor-youtube-digest.sh`; `pnpm test:unit` (1/1); `pnpm test:provenance` (1/1); `pnpm test`; `pnpm verify`; `pnpm test:e2e` (no suite, pass-with-no-tests); `git diff --check`; and a fresh pinned-clone byte comparison (`verified commit and 24 allowlisted files`).

## Contract or migration changes requested
None.

## Risks and follow-up
No unresolved implementation risks. The vendored source is intentionally excluded from application lint because it is exact upstream reuse; its mapped future adaptation owners are documented in `extension/UPSTREAM.md`. `pnpm-workspace.yaml` explicitly permits the required `unrs-resolver` postinstall so the locked test tooling runs reproducibly.
