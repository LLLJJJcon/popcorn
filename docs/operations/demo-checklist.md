# Popcorn classroom demo checklist

This checklist keeps the deterministic automated fixture proof separate from
Delivery Task 5's manual real-service smoke. Never print, show, copy, or record
passwords, API keys, tokens, cookies, service-role values, or other secret
values in screenshots, terminal output, or the release report.

## Automated fixture acceptance

Before presenting, build and validate the generated extension, then run the
single fixture-backed acceptance entry:

```bash
pnpm extension:package
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
pnpm playwright test tests/e2e/demo-acceptance.spec.ts --project=chromium-extension
```

The automated run uses `POPCORN_PROVIDER_MODE=fixtures`. It must not contact
live YouTube, Supadata, or a model Provider.

- [ ] A local fixture account signs in only after the explicit account action.
- [ ] Persistent Chromium loads the generated `dist/popcorn-extension`.
- [ ] The known Mandarin YouTube fixture opens with Chinese, English, and
      bilingual transcript modes.
- [ ] All six background save entry points preserve playback, remain on the
      current page, and open no save form.
- [ ] Saved shows the captured evidence and `Use It Now` creates the first
      independent attempt.
- [ ] Vault shows the expression, source occurrence, attempt history, and
      search result.
- [ ] Due Practice completes the transfer and Progress shows the resulting
      mastery evidence without increasing saved volume.
- [ ] The extension worker stops with pending saves, then alarm recovery drains
      the queue idempotently with no unapproved network egress.

## Delivery Task 5 manual smoke

Only after automated fixture acceptance passes, Task 5 uses one real public
Mandarin video, Supadata, and the learner's user-configured model gateway. That
manual smoke records only bounded success/failure categories, public video ID,
date, gateway display name/model, and observable product behavior. It never
records or requests secret values, full transcripts, Provider responses,
request bodies, cookies, or private gateway URLs.
