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

## Mutation evidence

- Omitting the create-flow consent POST failed the normal-flow test.
- Storing a rotated key under a wrong configuration ID failed the matching-card
  lifecycle test.
- Removing the pending recovery refetch failed the activation-failure test.
- Retaining a session key after revoke failed the revoked-card lifecycle test.

Each mutation was restored before final verification.

## Final verification

- Component suite: 19/19 passed.
- Settings integration regressions: 39/39 passed across 4 files.
- Targeted ESLint, `pnpm typecheck`, and `git diff --check`: passed.

## Residual risk

Transient keys deliberately disappear on refresh, navigation, sign-out,
unmount, or new login. The recovery fallback can display the server's returned
public pending configuration when a settings refetch is unavailable; it never
reconstructs or requests a stored secret.

Commit SHA: `HEAD` (this delivery commit).
