# 0.2.2

- Add a default-on "Repeat table headers for each row" control in both the isolated reader and local-voice compatibility panel. Turn it off to announce simple webpage table headers once, followed by row values.
- Keep smart/all/skip table policy independent. Preserve blank-cell positions and zero values; do not infer headers for nested/merged tables, partial selections or PDF text.
- Synchronize the portable core to 0.3.1 and pin the public web source snapshot. Existing CSP, credential isolation and explicit API consent protections remain unchanged.
- No private notes, documents, credentials or paid synthesis requests are used in the automated checks.

Import the new userscript from Releases and refresh the webpage. Existing settings and API workflows are not automatically changed.

## 0.2.1

Fix reading on websites whose security policies block the isolated reader, including GitHub.

- Switch to a local-voice compatibility panel if the isolated panel cannot start. Supports articles, selections, continuation, pause/resume, stop, jumps and speed.
- Keep API keys and PDF files out of the host webpage: compatibility mode has no credential input, remote voices or file import. Normal isolated-panel OpenRouter/MiMo and PDF workflows are unchanged.
- Keep site CSP and iframe sandbox protections intact; no new extension grants or privileged network bridge.
- Add restrictive-CSP and Trusted Types regression checks, including a real Tampermonkey check on the public GitHub repository.
- Sort bundled PDF resource names for matching Windows/Linux build output.

Verification: 19 unit tests, Edge webpage/PDF and API mock tests, restrictive-policy compatibility tests, and actual Tampermonkey 5.5.1 on ordinary and GitHub pages in isolated Chromium. No private text, keys or paid API calls were used. Live voice quality and mobile/background behavior remain unverified.

Update by importing `cozy-read-aloud.user.js` through Tampermonkey Utilities, then refresh the webpage. Restricted sites use local voices only. Use the release ZIP's `demo.html` for the full isolated interface, including optional API voices and imported PDFs.
