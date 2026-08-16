# YouTube Digest upstream intake

This directory is a verbatim allowlisted intake from [zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest.git) at immutable commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.

Reuse mode: copied exactly by `scripts/vendor-youtube-digest.sh`; no extension behavior has been regenerated or adapted in Foundation Task 1. Expected Popcorn adaptation and the owning later task are recorded per path below.

| Upstream source | Popcorn target | Reuse mode | Expected adaptation | Owning future task |
| --- | --- | --- | --- | --- |
| `manifest.json` | `extension/manifest.json` | Exact copy | Configure Popcorn extension linking | Batch A Task 1 |
| `background.js` | `extension/background.js` | Exact copy | Move transcript, player, and sync handlers by behavior | Batch A Tasks 2, 5, and 6 |
| `content.js` | `extension/content.js` | Exact copy | Adapt player, subtitle, quote, and explanation saves | Batch A Task 5 |
| `settings.js` | `extension/settings.js` | Exact copy | Store Popcorn linking settings | Batch A Task 1 |
| `sidepanel.html` | `extension/sidepanel.html` | Exact copy | Retain Side Panel structure for transcript and translation | Batch A Task 3 |
| `sidepanel.css` | `extension/sidepanel.css` | Exact copy | Retain Side Panel styling | Batch A Task 3 |
| `sidepanel.js` | `extension/sidepanel.js` | Exact copy | Adapt transcript, overview, and translation behavior | Batch A Task 3 |
| `options.html` | `extension/options.html` | Exact copy | Replace provider-key setup with Popcorn linking | Batch A Task 1 |
| `options.css` | `extension/options.css` | Exact copy | Retain options styling for linking | Batch A Task 1 |
| `options.js` | `extension/options.js` | Exact copy | Replace provider-key setup and storage behavior | Batch A Task 1 |
| `prompts/analysis.md` | `extension/prompts/analysis.md` | Exact copy | Adapt only under later transcript/overview work | Batch A Task 3 |
| `prompts/explain.md` | `extension/prompts/explain.md` | Exact copy | Adapt source-grounded Mandarin explanation discipline | Batch B Task 4 |
| `prompts/note-cleanup.md` | `extension/prompts/note-cleanup.md` | Exact copy | Adapt source-grounded Mandarin explanation discipline | Batch B Task 4 |
| `prompts/translation.md` | `extension/prompts/translation.md` | Exact copy | Adapt Mandarin translation behavior | Batch A Task 3 |
| `tests/digest-button.test.js` | `extension/tests/digest-button.test.js` | Exact copy | Preserve player-button behavior coverage | Batch A Task 5 |
| `tests/options-language.test.js` | `extension/tests/options-language.test.js` | Exact copy | Update linking/options coverage | Batch A Task 1 |
| `tests/release.test.js` | `extension/tests/release.test.js` | Exact copy | Reuse accessibility and release checks | Batch C Task 5 |
| `tests/settings.test.js` | `extension/tests/settings.test.js` | Exact copy | Update linking/settings coverage | Batch A Task 1 |
| `tests/transcript-selection.test.js` | `extension/tests/transcript-selection.test.js` | Exact copy | Preserve transcript selection coverage | Batch A Task 5 |
| `tests/translation.test.js` | `extension/tests/translation.test.js` | Exact copy | Preserve translation coverage | Batch A Task 3 |
| `icons/icon16.png` | `extension/icons/icon16.png` | Exact copy | Retain extension icon asset | Batch A Task 7 |
| `icons/icon48.png` | `extension/icons/icon48.png` | Exact copy | Retain extension icon asset | Batch A Task 7 |
| `icons/icon128.png` | `extension/icons/icon128.png` | Exact copy | Retain extension icon asset | Batch A Task 7 |
| `LICENSE` | `third_party/youtube-digest/LICENSE` | Exact copy | Preserve MIT attribution | All downstream extension tasks |
