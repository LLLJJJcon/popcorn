# Task 4 Report — Model Settings and Extension Web Entry

## Scope and baseline

Implemented only the Task 4 allowlist on branch `codex/popcorn-youtube-learning` from baseline `96cabbe`. The read-only regressions `tests/integration/model-gateway/settings-web-auth.test.ts` and `extension/tests/auth.test.js` were not modified.

Baseline verification before Task 4 edits:

```text
Web settings/auth: 2 files passed, 50 tests passed
Extension saved/release/auth: 31 tests passed, 0 failed
```

The pre-existing `next-env.d.ts`, `.DS_Store`, `AGENTS.md`, `CLAUDE.md`, and `extension/.DS_Store` worktree changes were preserved and excluded from this task.

## TDD evidence

### RED

Exact commands:

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx
node --test extension/tests/saved-panel.test.js extension/tests/release.test.js
```

The first command failed for the intended duplicate-shell behavior:

```text
Test Files  1 failed (1)
Tests       1 failed | 48 passed (49)
expected document not to contain the Sign out button
```

The second command failed for the intended missing extension entry behavior:

```text
tests 22
pass 20
fail 2
false !== true for the unhandled openPopcorn action
actual "Settings", expected "Open Popcorn"
```

The initial sandboxed baseline Vitest attempt could not write Vite's temporary config (`EPERM`) and was not accepted as test evidence. The unchanged baseline and all subsequent Vitest commands ran with worktree cache-write permission.

### GREEN

Fresh completion-gate commands:

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx tests/integration/model-gateway/settings-web-auth.test.ts
node --test extension/tests/saved-panel.test.js extension/tests/release.test.js extension/tests/auth.test.js
```

Results:

```text
Web: 2 files passed, 51 tests passed
Extension: 33 tests passed, 0 failed
```

The extension total adds two behavior tests: the real Side Panel header click sends exactly `{ action: "openPopcorn" }`, and only the exact trusted Side Panel sender can open `http://127.0.0.1:3000/`.

## Implementation

- Removed the model-settings component's duplicate sign-out form while retaining its single page heading, single setup form, configured-gateway list, consent, rotation, revocation, and mounted-session key behavior.
- Replaced component-owned page background, width, spacing, color, radius, and shadow values with the shared authenticated-shell tokens. The high-contrast shared cocoa/paper pair is used for the primary form action.
- Renamed the Side Panel header action to `Open Popcorn` and changed its message to `{ action: "openPopcorn" }`.
- Added one branch to the existing background worker. It validates the exact trusted Side Panel sender, derives the root with `new URL("/", POPCORN_API_ORIGIN).toString()`, and opens it with `chrome.tabs.create`.
- Left the trusted sender helpers, auth/key/session handling, Saved deep links, existing `openOptions` recovery branch, single-worker structure, upstream provenance, and Overview timeout/retry behavior unchanged.

## Verification

All fresh completion checks exited 0:

```bash
pnpm typecheck
pnpm exec eslint src/app/settings/model-gateway/model-gateway-settings.tsx src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm exec eslint --no-ignore --rule '@typescript-eslint/no-require-imports: off' --rule '@typescript-eslint/no-unused-vars: off' extension/sidepanel.js extension/background.js extension/tests/saved-panel.test.js extension/tests/release.test.js
node --check extension/background.js
node --check extension/sidepanel.js
git diff --check
```

The repository globally ignores `extension/**` in ESLint. The JS command therefore opts those files in while disabling the Web-only CommonJS import prohibition and pre-existing unused-variable rule; it still parses and lints every modified JS file without changing root configuration. A forced run without those rule overrides reported only existing CommonJS imports and existing unused variables.

After commit, `git diff --check 96cabbe..HEAD` is the final baseline-to-Task-4 whitespace gate.

## Modified files

- `src/app/settings/model-gateway/model-gateway-settings.tsx`
- `src/app/settings/model-gateway/model-gateway-settings.module.css`
- `src/app/settings/model-gateway/model-gateway-settings.test.tsx`
- `extension/sidepanel.html`
- `extension/sidepanel.js`
- `extension/background.js`
- `extension/tests/saved-panel.test.js`
- `extension/tests/release.test.js`
- `.superpowers/sdd/2026-09-05-popcorn-unified-learning-workspace/task-4-report.md`

## Risks

- `openPopcorn` intentionally trusts the existing generated `POPCORN_API_ORIGIN`; malformed or absent runtime configuration remains an installation/configuration failure rather than gaining a fallback origin.
- This task has fixture-backed behavior, type, lint, syntax, and whitespace coverage. The later integration pass still owns visual inspection at the complete 320/899/900/1440 viewport matrix.
- The `openOptions` message remains restricted to the exact trusted Side Panel sender for the existing extension connection/recovery path; it is no longer emitted by the general header action.

## Commit

Commit message: `feat: connect the extension to the Popcorn workspace`

## Fix round 1 — Extension recovery and badge contrast

Review identified two Important regressions: the general header correctly opened the Web root, but no remaining Side Panel control emitted the worker's trusted `openOptions` recovery action; and the two normal-size semantic badge pairings did not meet 4.5:1 contrast. The Minor sender-hardening request was included in the extension test cycle without changing the trusted predicate.

Fix-round baseline: `ca73c4b`.

### Important 1 RED — reachable extension-session recovery

Focused command:

```bash
node --test extension/tests/saved-panel.test.js extension/tests/release.test.js
```

Result before the production fix:

```text
tests 23
pass 19
fail 4
queued-save recovery link: actual hidden true, expected false
signed-out Saved recovery: actual { action: "openSavedLibrary" }, expected { action: "openOptions" }
expired Saved recovery: actual { action: "openSavedLibrary" }, expected { action: "openOptions" }
```

The parent Saved-state test is counted alongside its two failing signed-out/expired subtests. Empty and temporary-failure subtests continued to pass with `openSavedLibrary`.

### Important 1 fix and GREEN

- An admitted save returning `AUTH_REQUIRED` still renders the existing queued-save copy, now reveals `Sign in to sync`, and emits `{ action: "openOptions" }` from the Side Panel without changing or discarding the queued item.
- Signed-out and expired Saved library states select `openOptions` and label the action `Sign in to Popcorn`.
- Empty and temporary Saved states keep `openSavedLibrary` and `Open Saved in Popcorn`.
- The header remains `Open Popcorn` and continues to emit only `openPopcorn`.
- The background worker and its exact trusted-sender predicate were not changed.

Focused GREEN:

```text
tests 23
pass 23
fail 0
```

The existing hostile Side Panel fixtures were extracted into one test helper and reused for `openPopcorn`. Other-extension, query, hash, other-page, fractional-tab, query/hash tab mismatch, and other-page tab mismatch senders all remain rejected with no tab creation.

### Important 2 RED — authored badge contrast

Focused command:

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx
```

The regression reads the authored global tokens and settings CSS, resolves the current direct-token and sRGB color-mix forms, and computes WCAG relative luminance. Both cases failed before the CSS fix:

```text
Test Files  1 failed (1)
Tests       2 failed | 49 passed (51)
pending_consent: 3.582664364745153:1
active: 3.9916396312628306:1
```

### Important 2 fix and GREEN

Kept the distinct attention/success tinted backgrounds and changed only their foreground to the existing `--cocoa` token. The visible `Pending consent` and `Active` text remains the non-color state carrier. No global token was added or modified.

Focused GREEN:

```text
Test Files  1 passed (1)
Tests       51 passed (51)
```

### Full fix-round verification

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx tests/integration/model-gateway/settings-web-auth.test.ts
node --test extension/tests/saved-panel.test.js extension/tests/release.test.js extension/tests/auth.test.js
node --test extension/tests/recovery-accessibility.test.js
pnpm typecheck
pnpm exec eslint src/app/settings/model-gateway/model-gateway-settings.tsx src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm exec eslint --no-ignore --rule '@typescript-eslint/no-require-imports: off' --rule '@typescript-eslint/no-unused-vars: off' extension/sidepanel.js extension/background.js extension/tests/saved-panel.test.js extension/tests/release.test.js
node --check extension/background.js
node --check extension/sidepanel.js
git diff --check ca73c4b
```

Results:

```text
Web Task 4/auth: 2 files passed, 53 tests passed
Extension Task 4/auth: 34 tests passed, 0 failed
Recovery/accessibility: 9 tests passed, 0 failed
Typecheck, both scoped lint commands, both syntax checks, and diff check: exit 0
```

The read-only `extension/tests/auth.test.js`, `tests/integration/model-gateway/settings-web-auth.test.ts`, and `extension/tests/recovery-accessibility.test.js` files were not modified.

### Fix-round risks

- The recovery action deliberately opens the extension Options connection surface rather than the Web sign-in page because the service worker owns its separate session. The existing owner-bound queue remains the source of truth and is not mutated by this UI action.
- The contrast regression supports the direct token and current two-token sRGB mix forms authored by this module. A future intentional switch to a different CSS color syntax must extend the test resolver while preserving the numeric threshold.
- Independent re-review remains required before Task 4 can be accepted.

Fix commit message: `fix: restore extension recovery and badge contrast`
