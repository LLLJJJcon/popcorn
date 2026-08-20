# Batch A Task 7 Brief — Extension-to-Cloud Integration Gate

## Identity and ownership

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 7.
- Controller baseline: `c3aa7e3`.
- Controller worktree: `/private/tmp/popcorn-youtube-learning`.
- Branch: `codex/popcorn-youtube-learning`.
- The primary Agent owns this integration task, root Playwright configuration, upstream execution log, ledger, and final Batch A gate.

## Allowed files

- `tests/e2e/extension/acquisition-save.spec.ts` (create)
- `tests/e2e/extension/fixtures.ts` (create)
- `tests/integration/capture/cross-user.test.ts` (create)
- `playwright.config.ts`
- `docs/engineering/UPSTREAM_EXECUTION_LOG.md` (create)
- `docs/engineering/handoffs/batch-a/task-7.md` (create)
- `docs/engineering/execution-ledger.md` only after independent review PASS

Do not modify frozen contracts, migrations, generated types, application/extension production files, root dependencies/lockfile, environment schema, notices/licenses, or plans/specs. Any production defect discovered by these tests requires a separate TDD repair brief and independent review before Task 7 resumes.

## Frozen interfaces consumed

- Tasks 1–6: explicit extension sign-in, native-Chinese transcript/status APIs, Provider-neutral artifact routes, atomic six-kind capture, exact UI payloads, and owner-bound durable queue.
- `POST /api/v1/extension/sync` accepts at most 50 events and returns ordered per-event results.
- Queue correctness: storage before network, matching-ID acknowledgements only, serialized mutation paths, account isolation, worker reload/alarm recovery, and no silent loss.
- User model gateway credentials remain server/Vault-only; CI is fixture-only and never contacts a transcript or model Provider.

## Interfaces produced

- A persistent Chromium extension fixture using the absolute unpacked extension path and a temporary user-data directory.
- A deterministic mocked YouTube watch page and Popcorn/Supadata/AI service boundary.
- One end-to-end scenario proving explicit sign-in, Chinese/English/Bilingual rendering, playback unchanged by six save entrypoints, storage-first recovery after service-worker termination, rapid consecutive saves, and idempotent cloud sync under one video parent.
- A focused cross-user integration proof that user B cannot read or claim user A source/snapshot/segment/save/job and that a service worker supplied the wrong expected owner fails closed.
- A concrete upstream execution log mapping every required pinned YouTube Digest function to its target diff/test and recording method-only GPL separation.

## Strict RED before implementation

Create the three test/fixture files first, with imports and assertions against missing fixture/project/log behavior, then run:

```bash
./node_modules/.bin/vitest run tests/integration/capture/cross-user.test.ts
./node_modules/.bin/playwright test tests/e2e/extension/acquisition-save.spec.ts --project=chromium-extension
```

Expected RED: the cross-user integration harness and Chromium extension project/fixture are absent or incomplete; the E2E scenario cannot launch/complete.

Tests must be mutation-sensitive to:

1. implicit/pre-seeded sign-in being treated as user action;
2. any direct Provider call from the extension;
3. saving pausing/seeking/navigating/opening a form;
4. loss or reassignment of queued events after worker termination/account change;
5. missing one of six save kinds, duplicate retry creating a second row, or more than one video parent;
6. user B reading user A source, snapshot, segment, saved item, job, or artifact;
7. a service-role worker accepting an incorrect expected owner;
8. generic text/URL/image/screenshot inputs entering capture.

## Persistent Chromium and fixture rules

- Use `chromium.launchPersistentContext` with `--disable-extensions-except=<absolute extension path>` and `--load-extension=<absolute extension path>`.
- Use a temporary per-test user-data directory; do not write into the repository or a broad user directory.
- Run only in the `chromium-extension` project. Do not add Firefox/WebKit extension projects.
- All YouTube, Popcorn, transcript, and model responses are deterministic local/network-route fixtures. CI performs zero real Provider egress.
- Exercise actual extension pages/service worker/content/Side Panel paths where feasible. A bounded test hook may observe rows/events but must not duplicate production save, auth, queue, or capture logic.
- Do not rely on a permanently open port or `setInterval`; force worker termination/reload through Playwright-supported lifecycle controls and verify durable storage/alarm recovery.

## Upstream and license

- YouTube Digest: `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT. The log must name every planned Task 1–6 reused function, source path, target path, adaptation, copied/derived regression test, and any exception.
- LLM Wiki: `nashsu/llm_wiki` `v0.6.9@723e259309aea5e3850265b631f80224f66dd9f6`, GPLv3. Record only the approved method-level ideas; no code/test/SQL/prompt/component/asset copying.

## Verification gate

During TDD use only the focused Vitest/Playwright commands. Once GREEN, run one proportionate Batch A gate:

```bash
node --test extension/tests/*.test.js
./node_modules/.bin/vitest run tests/integration/capture tests/contract/transcript
./node_modules/.bin/playwright test tests/e2e/extension/acquisition-save.spec.ts --project=chromium-extension
./node_modules/.bin/eslint . --max-warnings 0
./node_modules/.bin/tsc --noEmit
env NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key SUPABASE_SERVICE_ROLE_KEY=service-role-key APP_URL=https://popcorn.example ./node_modules/.bin/next build --webpack
./node_modules/.bin/supabase test db
./node_modules/.bin/vitest run tests/provenance --passWithNoTests
git diff --check
git status --short
```

Because Task 7 adds cross-user/worker/browser/root-config integration, one pgTAP and production build run is justified. Do not reset the database unless the existing local schema is missing or stale; no migration changed in Tasks 3–7.

Commit implementation as `test: prove extension-to-cloud capture`. Write the handoff with RED/GREEN, exact browser/fixture behavior, upstream mappings, test outputs, failures/repairs, risks, and clean status. Then assign a fresh independent reviewer before updating the ledger or declaring Batch A complete.
