# Batch A Task 7 handoff: extension-to-cloud integration gate

## Scope and baseline

- Plan: Batch A Task 7.
- Controller baseline: `5f1151d` (Task 7 brief); production repair baseline `496e792`.
- Task 7 files: persistent Chromium fixture/spec, cross-user integration test, Playwright Chromium project, and the exact upstream execution log.
- Production defect found by E2E was repaired separately in reviewed commit `5105c4f`; obsolete scaffold tests were retired separately in reviewed commit `5f4538f`.

## RED evidence

1. Before the Playwright project/fixture existed, the requested `chromium-extension` project was absent.
2. The first real extension run reached Options but returned `{ ok:false }`: production rejected the legitimate `open_in_tab` Options sender because it assumed trusted extension pages never have `sender.tab`.
3. After the independently reviewed TDD repair, the browser reached translation. Two fixture-only assumptions were then corrected: Playwright Chromium keeps `launchWebAuthFlow` pending, and transcript stable IDs must be 64 lowercase hex characters.

The production repair recorded its own RED 26/28 and GREEN 28/28 evidence in `task-7-trusted-extension-tab-senders.md`. The two fixture corrections changed no production code.

## GREEN evidence

- Persistent Chromium E2E: 1/1 passed. It proves explicit login click/PKCE boundary, Chinese/English/Bilingual modes, six exact save kinds, unchanged playback, one video parent, dropped-acknowledgement idempotency, service-worker termination/alarm recovery, zero pending events, and zero unapproved egress.
- Cross-user integration: 3/3 passed, including wrong-owner service-role evidence refusal.
- Batch A capture/transcript: 4 files, 29/29 passed.
- Extension suite: 92/92 passed.
- Provenance: 11/11 passed.
- Database pgTAP: 3 files, 461/461 passed. A database reset was intentionally not repeated because Task 7 changes no migration or database contract.
- ESLint and TypeScript passed.
- Next.js production build passed with fixed non-secret test environment values and emitted all expected API/auth/settings routes.
- `git diff --check` passed.

## Upstream and license evidence

`docs/engineering/UPSTREAM_EXECUTION_LOG.md` names every planned YouTube Digest function/pattern reused by Tasks 1-6, its current target, adapted test and approved exception. YouTube Digest remains attributed at pinned MIT commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`. LLM Wiki remains method-only; no GPLv3 code, test, prompt, component or asset was copied.

## Residual risk

- Playwright's test Chromium cannot finish the real `chrome.identity` webview. The test requires a real sign-in click and observes persisted PKCE state before injecting a deterministic post-callback session; unit/integration auth tests cover the full PKCE exchange. A real signed-in Chrome account remains a Delivery manual smoke item.
- Provider endpoints remain fixture-backed in CI. Real user-configured gateway egress is deferred until local product acceptance and explicit Delivery verification.

## Review note

This candidate has not self-approved. A fresh independent reviewer must inspect the full Task 7 diff and verification evidence before the controller updates the ledger or starts Batch B.
