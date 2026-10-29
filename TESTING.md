# Verification

## Automated checks

- `npm test`: 19 unit tests covering native speech and API state transitions, stale callbacks, pause/end races, cancellation, timeout, bounded responses, MiMo WAV validation, credential consent, ZDR request fields, error sanitization and scope limits.
- `npm run test:browser`: generated public webpage/PDF fixtures, selection and continuation, PDF zoom and nonblank canvas, iframe isolation, hidden/input text exclusion, invalid-file recovery, native speech mocked, and 320/390/768 px layouts.
- `npm run test:api-browser`: actual browser audio playback using generated silent WAV fixtures and intercepted OpenRouter/MiMo responses. Tests consent, headers, caching, error handling, cancellation, credential removal and rejection of unsolicited parent document/play messages. No paid requests.
- `npm run test:csp-browser`: restrictive GitHub-like CSP and Trusted Types fixtures. Checks that the original inline script remains blocked, while local-only compatibility controls support selection, continuation, pause/resume, stale-event rejection, page-hide cleanup and 320/390/768 px layouts. No API/file fields or outgoing requests are allowed. Speech is mocked.
- `npm run test:tampermonkey`: optional local check against official installed Tampermonkey code, in a separate test-only profile under ignored `output/`. Imports the script using the manager UI and opens a page without a script tag, verifying genuine manager injection and MiMo settings. Set `TAMPERMONKEY_PATH` to extension program files only; never use a personal browser profile. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an existing test browser.

Browser tests expect the local preview server on port 5199. Set `BASE_URL` if different. They default to Edge; use `BROWSER_CHANNEL=chromium` with an installed Playwright Chromium for CI.

Set `LIVE_GITHUB_CHECK=1` for the optional Tampermonkey test to visit this public repository in the isolated browser. No existing browser profile or account is used.

## Local verification for 0.2.1

Windows: unit tests, Edge webpage/PDF tests, API mocks and CSP compatibility tests passed. Actual Tampermonkey 5.5.1 installation/injection passed in isolated Chromium, including a restrictive-policy fixture and this repository's live GitHub page. Unauthenticated CORS preflights accepted the required headers at the two fixed API endpoints during 0.2.0 testing; this is not evidence that a paid synthesis request succeeds.

## Not established by these tests

- Live API synthesis, actual voice quality, provider uptime or billing.
- All custom OpenRouter models/voices, or continued CORS compatibility.
- Firefox, Safari, mobile userscript managers, phone interruption/lock-screen behavior or sustained background playback.
- Perfect layout extraction for every PDF, OCR, word-level alignment or operation inside native browser PDF viewers.

All fixtures are generated or public sample text. Test reports, browser profiles and local screenshots stay in ignored `output/`; they are not release assets. Do not use private documents or real credentials in CI.
