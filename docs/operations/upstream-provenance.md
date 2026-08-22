# Extension release provenance

Popcorn reuses the MIT-licensed YouTube Digest extension from
`zarazhangrui/youtube-digest` at immutable commit
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`. The release contains Popcorn's MIT
license as `LICENSE` and the pinned upstream MIT notice as
`third_party/youtube-digest/LICENSE`.

## Packaging and checking adaptation

| Pinned source | Source method | Popcorn target | Adaptation | License action |
| --- | --- | --- | --- | --- |
| `scripts/package-extension.sh` | Obtain the public allowlist from the checker; validate the manifest version; stage through a temporary path; use `zip -X`; reject private paths; calculate SHA-256 | `scripts/package-extension.sh` | Builds the generated Popcorn extension, stages its runtime plus both MIT notices and this provenance record, normalizes metadata, and retains both ZIP and unpacked output | This method adaptation is covered by the pinned YouTube Digest MIT notice |
| `scripts/check-release.sh` | Explicit public allowlist; regular-file and symlink checks; manifest and runtime-reference validation; JavaScript syntax checks; credential-pattern scanning | `scripts/check-extension-release.sh` | Checks the generated Popcorn origins, stable identity, exact archive entries, paired checksum, and absence of provider credentials or private material in a temporary inspection directory | This method adaptation is covered by the pinned YouTube Digest MIT notice |
| `manifest.json` | Manifest V3 release boundary and referenced runtime assets | `extension/manifest.json` and generated `dist/popcorn-extension/manifest.json` | Consumes the already-adapted Popcorn descendant; this task does not replace it | Existing source-to-target attribution remains in `extension/UPSTREAM.md` |
| `tests/release.test.js` | Public release behavior checks | `extension/tests/release.test.js` and `tests/release/extension-package.test.ts` | Reuses the already-adapted descendant and adds an independent Popcorn package-boundary test; no upstream test is copied | Existing test provenance remains in `extension/UPSTREAM.md` |

The archive is produced only from the checker's explicit allowlist. No broad
directory copy, generated test content, source map, local environment file, or
unlisted repository file is eligible for distribution.
