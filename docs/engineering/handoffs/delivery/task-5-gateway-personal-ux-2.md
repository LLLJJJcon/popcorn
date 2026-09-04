# Task 2 delivery: gateway recovery and transient key lifecycle

## Scope and provenance

- Changed only the model-gateway settings component and its component tests.
- No server, API, shared contract, schema, migration, generated type, dependency,
  lockfile, Provider, worker, queue, or execution-ledger file changed.
- No credentials were read or used. No LLM Wiki or YouTube Digest code, tests,
  prompts, components, or assets were copied.

## Recovery behavior

- A successful create followed by a failed or malformed activation retains the
  submitted key only in component memory under the created configuration ID,
  resets all Step 1 fields and confirmation, and makes one settings refetch.
- A valid refetch is authoritative; a failed refetch inserts or replaces the
  non-secret created public configuration without duplicating its ID.
- Pending cards show their stored exact destination/data summary and one
  `Confirm and finish activation` action. It sends the existing consent DTO;
  no pending checkbox or duplicate create request is issued.
- The partial-failure alert is exactly `Gateway saved but not activated. Finish
  activation below.`. Creation failures before a valid public configuration
  retain the entered form values and use the existing generic alert.

## Transient key lifecycle

- Successful rotations update the matching card's masked, page-memory key,
  close the editor, and keep Show/Hide request-free.
- Revoke removes both the transient key and rotation draft before closing its
  confirmation. Keys remain absent from storage, URL/history, status, and
  generic errors.

## Evidence

| Area | RED evidence | GREEN evidence |
| --- | --- | --- |
| Recovery | The focused recovery run failed 2/2: it showed the generic combined-flow error and lacked `Confirm and finish activation`. | Focused recovery run passed 2/2; component suite passed 19/19. |
| Rotation/revoke | The focused lifecycle run failed 2/2: rotation left its editor open and created no matching transient key. | Focused lifecycle run passed 2/2; component suite passed 19/19. |

The recovery fixture makes exactly four requests: initial settings GET, one
create PUT, one failed consent POST, and one recovery GET. It asserts a single
create PUT. The recovery action and normal path assert the unchanged exact
consent DTO. Rotation and revoke assert their unchanged existing DTOs.

## Review fix round

- Recovery consent no longer uses the generic mutation helper. Its response is
  checked for the requested ID and `active` state, then the settings refetch is
  authoritative: only that same configuration appearing active completes the
  action. Malformed, wrong-ID, and still-pending mutation responses otherwise
  leave the card pending with the generic retryable error.
- The review regressions first ran RED with 3 failures and 4 controls passing:
  malformed consent never refetched, while wrong-ID and pending responses were
  announced as activated. The focused fix round then passed 7/7.
- The fixtures cover malformed, wrong-ID, and non-active responses; an
  authoritative active refetch; rapid recovery-action double click (one POST);
  and HTTP, parse, and network rotation failures retaining the typed key without
  status/error or storage leakage.

## Final cumulative review fix round

- Step 1 only renders its confirmation after an HTTP(S) base URL is valid; any
  base-URL edit clears confirmation before another create can be submitted.
- The normal final settings refetch must contain the created ID in `active`
  state. Pending, missing, or wrong-ID views fall through to the existing
  deterministic recovery path, which merges the created public view without a
  duplicate create request.
- HTTP, malformed-response, and network failures of the post-create recovery
  refetch retain one masked pending-card key and clear the form for recovery.
- Session-key inputs now have stable configuration-specific IDs. Visible
  Show/Hide text is unchanged, while their controls identify the target card
  accessibly through `aria-label` and `aria-controls`.
- The final focused RED run had 6 failures and 3 passing controls: destination
  binding, final-refetch authority, and control linkage were absent. The focused
  GREEN run passed 9/9.

## Mutation evidence

- Omitting the create-flow consent POST failed the normal-flow test.
- Storing a rotated key under a wrong configuration ID failed the matching-card
  lifecycle test.
- Removing the pending recovery refetch failed the activation-failure test.
- Retaining a session key after revoke failed the revoked-card lifecycle test.

Each mutation was restored before final verification.

## Final verification

- Component suite: 34/34 passed.
- Settings integration regressions: 39/39 passed across 4 files.
- Targeted ESLint, `pnpm typecheck`, and `git diff --check`: passed.

## Residual risk

Transient keys deliberately disappear on refresh, navigation, sign-out,
unmount, or new login. The recovery fallback can display the server's returned
public pending configuration when a settings refetch is unavailable; it never
reconstructs or requests a stored secret.

Commit SHA: `HEAD` (this delivery commit).
