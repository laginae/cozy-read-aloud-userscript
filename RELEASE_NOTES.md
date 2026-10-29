# 0.2.0

First public GitHub release of the Cozy Read Aloud userscript.

- Read webpage articles, selections and imported local PDFs without Obsidian.
- Optional OpenRouter voices with ElevenLabs presets and mandatory ZDR routing parameters.
- Optional Xiaomi MiMo voices: 白桦, 苏打, 冰糖, 茉莉, Mia, Chloe, Milo and Dean, using separate credentials and consent. MiMo does not claim ZDR.
- Session-only keys, bounded audio caching, request cancellation, scope limits and sanitized errors; no automatic retries or provider fallback.
- Playback, outline, PDF selection/zoom, paragraph highlights and academic formula processing.
- Bundled PDF runtime and assets, third-party notices, checksums and build provenance.

Verification: 19 unit tests, Edge public webpage/PDF checks, mocked OpenRouter/MiMo audio flows, and actual Tampermonkey 5.5.1 installation/injection in isolated Chromium. No private text, API keys or paid API tests are included. Live API quality and mobile/background behavior remain unverified. Native browser PDF viewers require saving the file and importing it into the panel.

Install `cozy-read-aloud.user.js` through Tampermonkey Utilities, or extract the ZIP and open `demo.html` to try the standalone public sample. See the bilingual README before enabling online voices.
