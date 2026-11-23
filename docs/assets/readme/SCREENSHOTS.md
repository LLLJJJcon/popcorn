# README screenshot sources / 截图来源

Updated: 2026-11-23 (Asia/Shanghai).

## Current desktop Web

The desktop Web images listed below render the real React presentation components and CSS with isolated visual fixture records. They are not screenshots of a personal account, and no learning mutations, model calls, credentials or authentication bypass were used. Examples, answers, counts and feedback scores are illustrative UI records, not measured learning results. Source-video metadata in the fixture illustrates the retained fields; it does not establish that the demonstration sentences came from that video.

| File | Content |
| --- | --- |
| `home-current.png` | Confirmed compact slogan-left / comic-right Home and real Home component structure |
| `saved-workspace-current.png` | Fixed navigation; two-stage outer scrolling followed by independent sentence and learning-card scrolling |
| `learning-card-current.png` | Complete numbered learning card, meaning, use conditions, contrast, example and practice action |
| `learning-card-more-current.png` | Same card with additional usage details expanded |
| `practice-current.png` | Single-expression situation and response workspace |
| `practice-feedback-current.png` | Same type of practice with a fixed first-answer feedback example |
| `feedback-panels-current.png` | Complete current feedback component, including three dimensions and next actions |
| `today-practice-current.png` | Reviews, Second tries and New expressions queue |
| `vault-current.png` | Expression, source evidence, attempt history and Next step |
| `progress-current.png` | Existing metrics and mastery distribution in the shared palette |

Captures use a 1440px browser viewport. Complete learning-card captures expand the capture canvas to avoid clipping content inside the application's scroll pane; no text or scores are composited onto the screenshots.

The Home comic is a generated illustration, created with built-in ImageGen from the approved character and dialogue references. It is stored in `public/brand/home-comic.png`, with a text transcript in the Home component. Interface text outside the illustration remains ordinary HTML.

## Current Chrome extension

The extension screenshots listed below capture the actual unpacked `dist/popcorn-extension` HTML, CSS and JavaScript in isolated Chromium. The source is `tests/e2e/extension/explain-ui.spec.ts`, using the existing closed-egress mock-cloud fixture. A fresh temporary browser profile uses a fixed simulated account via an explicit test click; it never signs in to a real account or contacts a model. Save mutations exist only in fixture memory.

- `extension-transcript-compact.png`: latest 384px compact sidebar in bilingual mode, captured during the isolated density measurement.
- `extension-transcript-chinese-compact.png`: the same real extension in Chinese-only mode, with timestamp and Save sharing a row. Captured by the isolated density measurement alongside the bilingual view.
- `extension-explanation-current.png`: four real explanation fields and Save Explanation.
- `extension-overview-current.png`: overview, chapters and key quotes.
- `extension-saved-current.png`: video-level summary from a captured fixture save, with title, channel, count and processing state.
- `extension-settings-current.png`: independent 800px extension-account page before sign-in; no credentials shown.
- `extension-explanation-recovery-current.png`: a mocked 401 causes session-expired recovery while retaining the Chinese selection. The browser test also reconnects in a separate window and successfully retries the original selection.

These records demonstrate UI and recovery behavior; they do not establish the original user's failed HTTP status or live-model availability.

## Historical assets

`youtube-watching.png` retains the earlier real YouTube / Chrome-extension viewing capture. It predates the extension redesign; the current extension screenshots are listed above. Other older images in this folder are retained as historical assets but are no longer referenced by the current README.

The English and Chinese README Mermaid diagrams use the same orange, sky blue and lemon families as the application; the source remains editable in Markdown.

Transcript density was tightened after the desktop review: timestamp and Save share one row, Chinese text uses 18px / 1.6, and row padding is reduced. At a 384px viewport the same short fixture line measures about 78px in Chinese (previously 150px), or 103px bilingually (previously 181px). Longer text grows naturally; no subtitle content is clipped.

The compact transcript assets use new filenames so both README language versions point directly to the new captures, without relying on an earlier image URL being refreshed.
