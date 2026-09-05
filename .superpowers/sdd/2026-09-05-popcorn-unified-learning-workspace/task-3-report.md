# Task 3 Report — Evidence-based Progress

## Scope

Implemented only the Task 3 Progress presentation allowlist. `ProgressSummary`, repository behavior, page data loading, and the read-only integration regression remain unchanged.

## RED evidence

Command:

```bash
pnpm vitest run src/features/progress/progress-dashboard.test.tsx
```

Result: 1 failed file, 3 failed tests. The assertions failed for the intended missing presentation behavior:

```text
Unable to find an accessible element with the role "heading" and name "Your Mandarin in use"
Unable to find an accessible element with the role "progressbar"
Unable to find an accessible element with the role "link" and name "Review Saved material"
```

## GREEN evidence

```bash
pnpm vitest run src/features/progress/progress-dashboard.test.tsx tests/integration/progress/progress-summary.test.ts
```

```text
Test Files  2 passed (2)
Tests       23 passed (23)
```

```bash
pnpm typecheck
```

```text
$ tsc --noEmit
exit 0
```

```bash
pnpm eslint 'src/app/(app)/progress/page.tsx' src/features/progress/progress-dashboard.tsx src/features/progress/progress-dashboard.test.tsx
```

```text
exit 0 with no warnings or errors
```

## Implementation

- Added four compact cards sourced only from the existing weekly and due summary values.
- Added exactly three semantic, directly labeled mastery bars using the existing `tried`, `reused`, and `owned` values.
- Added a Practice CTA when work is due and a secondary Saved link when it is not.
- Explained that mastery represents the highest evidence and does not fall after a weaker later attempt.
- Added responsive CSS-module layout rules that collapse without horizontal scrolling at narrow widths.

## Risks

- The bars show the distribution share of the three existing mastery states; no progress percentage, trend, streak, or collection total is inferred or persisted.
- This task covers fixture-backed component behavior. It does not add browser viewport automation, Provider work, or data-model changes.

## Fix round 1 — contrast and presentation hardening

### Root cause

The Task 3 module used normal-size paper text on the existing coral token for the primary CTA, and the same coral token for the 0.78rem eyebrow on the cream background. The combinations were below WCAG 2.2 SC 1.4.3's 4.5:1 requirement.

### RED evidence

The focused test reads the authored Progress and global palette CSS and calculates the rendered token pairings. Before the CSS repair it failed on the CTA's actual values:

```bash
pnpm vitest run src/features/progress/progress-dashboard.test.tsx
```

```text
expected 3.536556541232046 to be greater than or equal to 4.5
```

### Repair and GREEN evidence

- Changed only the two Progress-module uses to the existing `--cocoa` token: CTA background with `--paper` text is 14.83:1; eyebrow text on `--cream` is 13.29:1.
- Hardened the component contract to assert exactly four metric cards; all `Tried`, `Reused`, and `Owned` bar `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` values; and the absence of percentage, trend, collection-total, legacy saved-item, and health-score vanity terms.

```bash
pnpm vitest run src/features/progress/progress-dashboard.test.tsx tests/integration/progress/progress-summary.test.ts
```

```text
Test Files  2 passed (2)
Tests       24 passed (24)
```

```bash
pnpm typecheck
pnpm eslint 'src/app/(app)/progress/page.tsx' src/features/progress/progress-dashboard.tsx src/features/progress/progress-dashboard.test.tsx
git diff --check d100bab..HEAD
```

All commands exited 0 with no warnings or errors.
