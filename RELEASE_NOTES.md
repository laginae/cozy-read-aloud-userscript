# 0.2.1

Fix reading on websites whose security policies block the isolated reader, including GitHub.

- Switch to a local-voice compatibility panel if the isolated panel cannot start. Supports articles, selections, continuation, pause/resume, stop, jumps and speed.
- Keep API keys and PDF files out of the host webpage: compatibility mode has no credential input, remote voices or file import. Normal isolated-panel OpenRouter/MiMo and PDF workflows are unchanged.
- Keep site CSP and iframe sandbox protections intact; no new extension grants or privileged network bridge.
- Add restrictive-CSP and Trusted Types regression checks, including a real Tampermonkey check on the public GitHub repository.
- Sort bundled PDF resource names for matching Windows/Linux build output.

Verification: 19 unit tests, Edge webpage/PDF and API mock tests, restrictive-policy compatibility tests, and actual Tampermonkey 5.5.1 on ordinary and GitHub pages in isolated Chromium. No private text, keys or paid API calls were used. Live voice quality and mobile/background behavior remain unverified.

Update by importing `cozy-read-aloud.user.js` through Tampermonkey Utilities, then refresh the webpage. Restricted sites use local voices only. Use the release ZIP's `demo.html` for the full isolated interface, including optional API voices and imported PDFs.
