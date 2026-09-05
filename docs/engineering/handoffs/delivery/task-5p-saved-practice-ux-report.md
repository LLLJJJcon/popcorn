# Delivery recovery Task 5P — Saved candidate UX report

## Delivered

- Candidate expressions are now visually separated cards with a clear English purpose label, readable learning details, source evidence, and distinct Watch and Practice actions.
- Every Saved timeline entry exposes the stable `saved-item-<UUID>` anchor used by the return journey.
- Candidate activation builds a same-app return target from the displayed Saved video source and item IDs. The Practice route accepts a return target only when it exactly matches `/saved/<UUID>#saved-item-<UUID>`; all other query values are ignored.
- Practice shows `Back to this Saved moment` only for a validated Saved return target.

## Safety

The return link is both controller-constructed in the Saved candidate flow and revalidated on the Practice server route. It cannot resolve to an external URL, another application route, a query string, or a malformed Saved anchor.

## Verification

No tests were added or run, per the approved quick-repair brief. Static verification performed:

- `git diff --check` before commit.
- Post-commit `git diff --check 8acfcd9..HEAD`.
- Post-commit baseline-to-HEAD changed-file allowlist inspection.

## Residual risk

The strict target pattern establishes an internal navigation boundary but does not independently prove that the URL's Saved IDs belong to the Practice task; authorization on the Saved route remains the existing session-scoped service responsibility.
