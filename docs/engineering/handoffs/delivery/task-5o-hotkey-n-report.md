# Delivery recovery Task 5O — YouTube N shortcut capture report

## Root cause

The content script registered its document-level `keydown` listener in the
default bubbling phase. YouTube can consume its own `n` shortcut before the
listener receives the event, so the note save path is skipped.

## Implementation

- Registered the existing `handleNoteKeyboardShortcut` listener in the capture
  phase so it runs before YouTube's bubbling shortcut handling.
- Accepted both character-based `n`/`N` events and the physical `KeyN` code.
- Preserved the existing watch-page guard, input/textarea/contenteditable
  exclusions, `saveCurrentNote` → `enqueueSavedItem` chain, and save feedback.
- Regenerated `dist/popcorn-extension/content.js` from the source file.

## Verification

- `cmp -s extension/content.js dist/popcorn-extension/content.js`: passed;
  source and generated content scripts are identical.
- `git diff --check 8acfcd9..HEAD`: run before commit; result recorded in the
  handoff response.
- No test commands were added or run, per the task brief.

## Risk

The capture-phase listener now intercepts matching N key events earlier in the
document event path. Existing focus exclusions remain in place; no background
queue, authentication, contract, migration, or web behavior was changed.
