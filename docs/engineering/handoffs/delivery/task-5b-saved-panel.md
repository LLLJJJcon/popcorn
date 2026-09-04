# Delivery Task 5B Handoff — Real Saved Panel

## Outcome

The extension's obsolete Notes shell now displays the authenticated Popcorn Saved library. Opening the Saved tab issues one fixed `getSavedLibrary` request through the trusted background worker, refreshes on every later activation, and renders only the existing `SavedVideoSummary[]` response. The panel keeps `This video` and `All saved` filters and exposes loading, empty, signed-out, expired-session, and temporary-unavailable recovery states.

The new `GET /api/v1/extension/saved` endpoint authenticates with `authenticateCaptureRequest`, passes only the verified `userId` to the existing owner-scoped Saved library service/repository, and returns its standard summary envelope with `Cache-Control: no-store`. Query parameters and headers cannot select an owner.

## Files

- `extension/sidepanel.html`: replaced retired Notes markup with Saved filters, state/recovery actions, and the summary list.
- `extension/sidepanel.js`: removed `getNotes`, `notesList`, note copy/delete/play behavior; added refresh, safe normalization/rendering, filtering, and fixed navigation messages.
- `extension/sidepanel.css`: replaced Notes styles with Saved summary/state styles.
- `extension/background.js`: added trusted `getSavedLibrary`, `openSavedLibrary`, and validated `openSavedDetail` actions.
- `extension/tests/saved-panel.test.js`: added Saved behavior, recovery, authentication, trust-boundary, and navigation coverage.
- `extension/tests/release.test.js`: updated the retired Notes filter expectations to the Saved filter controls while preserving the existing release-test selector.
- `src/app/api/v1/extension/saved/route.ts`: added the fixed bearer-authenticated list endpoint.
- `src/features/saved/api.ts`: added a small service-only runtime factory that reuses `createSavedLibraryService` and `createSavedLibraryRepository`.
- `tests/integration/saved/extension-library-route.test.ts`: added authentication, owner binding, summary-only response, and no-store coverage.

No schema, migration, shared contract, queue behavior, Provider path, dependency, lockfile, generated extension output, or credential file changed.

## RED evidence

### Saved panel and background actions

Command:

```text
node --test extension/tests/saved-panel.test.js
```

Baseline result: exit 1; 0 passed, 9 failed. The failures showed no `getSavedLibrary` message, missing Saved state elements, and undefined background responses for the absent fetch/navigation actions.

After reviewing the local authenticator boundary, a second focused RED cycle covered pre-request authentication:

```text
node --test --test-name-pattern='background distinguishes signed-out and expired authentication before fetching Saved' extension/tests/saved-panel.test.js
```

Result before the corrective mapping: exit 1; 0 passed, 1 failed. A signed-out session incorrectly proceeded to the endpoint fixture instead of returning `AUTH_REQUIRED`; the same test also covered local refresh failure as `SESSION_EXPIRED`.

### Extension Saved endpoint

Command:

```text
pnpm --config.verify-deps-before-run=false vitest run tests/integration/saved/extension-library-route.test.ts
```

Baseline result: exit 1; one failed suite and zero collected tests because `src/app/api/v1/extension/saved/route.ts` did not exist.

## GREEN evidence

- `node --test extension/tests/saved-panel.test.js`: exit 0; 11 passed, 0 failed.
- `pnpm --config.verify-deps-before-run=false vitest run tests/integration/saved/extension-library-route.test.ts tests/integration/saved/video-library.test.ts`: exit 0; 2 files passed, 8 tests passed.
- `node --test extension/tests/recovery-accessibility.test.js extension/tests/release.test.js extension/tests/worker-restart.test.js extension/tests/translation.test.js`: exit 0; 46 passed, 0 failed.
- `pnpm --config.verify-deps-before-run=false exec eslint src/app/api/v1/extension/saved/route.ts src/features/saved/api.ts tests/integration/saved/extension-library-route.test.ts`: exit 0.
- `pnpm --config.verify-deps-before-run=false typecheck`: exit 0.
- `node --check extension/background.js` and `node --check extension/sidepanel.js`: exit 0.
- `pnpm --config.verify-deps-before-run=false test:extension`: exit 0; 4 passed, 0 failed.
- `git diff --check`: exit 0.

The first lint/type invocation omitted the repository's dependency-verification bypass and was stopped by pnpm before analysis because it wanted to reconcile the shared `node_modules` directory without a TTY. It made no dependency or lockfile change; the no-install commands above are the authoritative results.

## Security and privacy checks

- The Side Panel never receives a bearer token and never talks to Supabase directly.
- The background ignores message-supplied `userId` and arbitrary URL fields.
- Web navigation is limited to `${POPCORN_API_ORIGIN}/saved` and `${POPCORN_API_ORIGIN}/saved/:sourceId`; detail IDs must be UUIDs.
- Titles and channels are bounded and assigned with `textContent`; malicious-looking fixture strings create no `img` or `script` elements.
- The endpoint returns Saved summaries only. The integration fixture proves saved payload text is absent from the response.
- A locally queued save may remain absent until synchronization; the empty-state copy says so, while the existing save-status UI remains authoritative.

## Remaining risk

The Side Panel behavior is covered in JSDOM and the background worker in a VM harness, but this corrective item did not include a manual Chrome visual smoke. The existing generated-extension packaging flow should be exercised later at the delivery-wide acceptance gate.
