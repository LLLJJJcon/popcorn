# Task 5N — Supadata transcript timeout clarity

## Summary

Raised the default Supadata request/poll timeout from 4,000 ms to 30,000 ms in `src/server/transcript/supadata-provider.ts`.

## What changed

- Updated the `createSupadataTranscriptProvider` default `requestTimeoutMs` to `30_000`.
- Left the existing HTTP `206` and `404` handling unchanged so unsupported native Chinese transcript responses still resolve immediately as `NATIVE_CHINESE_TRANSCRIPT_REQUIRED`.
- Left all other request, polling, retry, and normalization behavior unchanged.

## Static review

- Confirmed the only implementation change is the default timeout value.
- Confirmed the 206 unsupported branch still returns non-retryable native Chinese transcript unsupported results.
- Confirmed no additional files were modified beyond the allowed implementation/report files.

## Risk

Low. This is a narrow default-value adjustment that preserves the current response handling and retry semantics.

