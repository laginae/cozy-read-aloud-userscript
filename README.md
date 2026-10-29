# Cozy Read Aloud: Web and PDF

English | [简体中文](README.zh-CN.md)

Listen to web articles, selected text and local PDFs in your browser, without Obsidian. Use local system voices by default, or opt in to **OpenRouter** and **Xiaomi MiMo** API voices.

## Install and Start

1. Install [Tampermonkey](https://www.tampermonkey.net/) and enable **Allow user scripts** when prompted.
2. Download `cozy-read-aloud.user.js` from the [latest release](https://github.com/laginae/cozy-read-aloud-userscript/releases/latest). Import it through Tampermonkey's **Dashboard > Utilities**, then confirm installation.
3. Refresh an ordinary webpage, click the speaker in the lower-right corner, load the article or selection, and press Play.
4. Open the voice settings to select a different engine. API engines require your own key and separate consent; the script never reads credentials from your Obsidian plugins.

The release ZIP includes a standalone `demo.html` with public sample text. Extract the entire ZIP before opening it. The demo loads the script directly, without Tampermonkey. There is no automatic update URL; import a newer release to update. Enable file-URL access only if you want Tampermonkey injection on local HTML files.

## Reading Controls

- Read an article, just the selection, or continue from the selected position.
- Pause/resume, stop, jump between segments, adjust speed, navigate an outline and follow paragraph highlights.
- Optional academic processing skips complex formulas and retains suitable short variables. Highlighting is segment-based, not word-aligned.
- Only currently loaded webpage content is read. The script does not expand chats, fetch subsequent pages, bypass logins or inspect cross-origin frames.

**Restricted sites such as GitHub:** if the isolated panel cannot start, version 0.2.1 switches to a local-voice compatibility panel after about six seconds; some restrictions can be detected immediately. It supports articles, selections, continuation, pause/resume, stop, segment jumps and speed. No site security protection needs to be disabled.

The compatibility panel belongs to the host DOM, so it deliberately has **no API-key fields, remote voices or PDF file input**. Use the release ZIP's local `demo.html` for the full script interface. [Cozy Read Aloud Web](https://laginae.github.io/cozy-read-aloud-web/) is another standalone option, with its own separately maintained voice options. The link opens that page without automatically transferring your current text. The current script interface is Chinese.

## Local PDFs

Native browser PDF viewers are protected browser interfaces and usually cannot host userscript buttons. Save the PDF first, then choose **打开 PDF** in the Cozy panel on a trusted webpage, or import it in the local demo.

The viewer includes the original pages, selectable text, selection-only reading, continuation, zoom, outline and highlights. PDF.js, CMaps and fonts are bundled: there are no runtime CDN downloads. PDF files and extracted PDF text are not passed to the host page. **If you enable API voices, text actually synthesized from your selected reading scope is sent to that provider.**

Limits: 30 MiB, 120 pages and one million extracted characters. Split larger files first. Scanned PDFs need OCR before import; password-protected files must be lawfully unlocked. OCR and audio export are not included in this script; see the standalone Cozy web app for those workflows.

## Voice Options

| Engine | Setup | Data boundary |
| --- | --- | --- |
| Browser / system | No key; local-service voices by default | Remote browser voices require a separate opt-in |
| OpenRouter | Your key, model and voice ID | Requests require ZDR routing; no silent relaxation |
| Xiaomi MiMo | Your MiMo key and voice | Separate consent; no ZDR guarantee |

**Browser voices:** availability depends on the browser and installed OS voices. A `localService=true` voice is required by default. Windows Narrator Natural / Natural HD availability is not guaranteed. Opting in to remote browser voices may send text to that browser's speech provider.

**OpenRouter:** includes ElevenLabs Multilingual v2 and Flash v2.5 presets, with `sarah` as the initial voice. Custom speech model and voice IDs are supported but not individually tested. Every request uses `provider.zdr=true` and `data_collection=deny`. If routing fails, the script stops rather than weakening those requirements. This is a routing constraint, not an absolute no-retention promise; screening and legal exceptions are governed by the [OpenRouter ZDR policy](https://openrouter.ai/docs/guides/features/zdr) and provider terms.

**MiMo:** uses `mimo-v2.5-tts`, with Chinese voices 白桦, 苏打, 冰糖, 茉莉 and English voices Mia, Chloe, Milo, Dean. See the [official speech guide](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/speech-synthesis). MiMo does not inherit OpenRouter's ZDR settings. Pricing and retention follow the [MiMo privacy policy](https://privacy.mi.com/XiaomiMiMoPlatform/zh_CN/) and account terms.

## Privacy and Cost Controls

- Online APIs are off by default. Only the text being synthesized is sent, not files, page URLs or titles. MiMo also receives a fixed, generic voice instruction. Changing engine, credentials, model, voice or document resets consent.
- Each API reading scope is limited to 20,000 characters. Requests are sequential and on demand, without prefetch, automatic retries or provider fallback. OpenRouter chunks are capped at 500 characters; MiMo uses approximately 200-character chunks, preferring sentence boundaries.
- Pause/resume reuses current audio. An in-memory cache holds at most eight chunks and 16 MiB. Stop and jump cancel pending requests, but already submitted requests can still be billed.
- Keys stay in the isolated reader frame's memory. They are not put in the userscript, parent webpage DOM, localStorage, userscript storage or GitHub. Closing the panel, refreshing or closing the page clears them. The clear button removes both API keys and the audio cache.
- No telemetry or saved reading history. Error messages never echo raw provider bodies. HTTP 400 is not treated as proof of insufficient credit; HTTP 402 is reported as the provider's payment error.
- The sandboxed frame has no same-origin access to the host page. API requests omit credentials and referrers. There is no privileged cross-origin network bridge. Use trusted pages: a malicious page could spoof UI, and isolation is not a guarantee against malicious extensions or a compromised device.

## Verification and Limits

Version 0.2.1 passes 19 unit tests, public webpage/PDF browser checks, and both API flows with mocked audio. Restrictive CSP and Trusted Types tests verify local-only compatibility playback, no credential/file inputs and no network requests. Actual Tampermonkey 5.5.1 in an isolated Chromium profile was used to check manager-driven injection, MiMo settings and the compatibility panel on this repository's live GitHub page.

**No paid API account was used in these tests.** Live voice quality, Firefox/Safari, phones, lock-screen behavior and sustained background playback remain unverified. Narrow desktop layouts do not establish mobile compatibility. See [TESTING.md](TESTING.md).

## Development

Node.js 24: `npm ci --ignore-scripts`, `npm test`, `npm run build`, then `npm start`. The preview binds only to `127.0.0.1:5199`. Browser checks use public fixtures, placeholder keys and mocked audio.

Shared public-source commits and hashes are recorded in `vendor/SOURCES.json` and verified at build time. Releases include third-party notices, SHA256 checksums and GitHub build provenance. This project does not modify the desktop or mobile Obsidian plugins.

Report reproducible problems through [GitHub Issues](https://github.com/laginae/cozy-read-aloud-userscript/issues), with browser and Tampermonkey versions, steps and sanitized screenshots. **Do not attach API keys, private text or unauthorized PDFs.**
