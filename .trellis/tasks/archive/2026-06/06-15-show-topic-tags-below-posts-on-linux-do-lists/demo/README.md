# BewlyLinuxDo Demo Harness

Local verification harness for the BewlyLinuxDo browser extension against a
fake Linux.do Horizon-style homepage, without hitting Cloudflare.

## What It Does

1. Generates a self-signed TLS certificate for `linux.do` (stays in `demo/certs/`).
2. Starts a Node.js HTTPS server serving a static HTML page that mimics the
   Horizon topic-list DOM structure (rows with `tag-*` classes, hidden
   `.link-bottom-line` with category anchors, visible `td.topic-category-data`).
3. Opens Chromium with `--load-extension` pointing at the built extension,
   `--host-resolver-rules` mapping `linux.do` to `127.0.0.1`, and
   `--ignore-certificate-errors` for the self-signed cert.
4. The page includes a live diagnostic panel at the bottom that counts
   `[data-bewly-topic-tags]` containers, checks their parent/visibility, and
   flags any injected inside hidden `.link-bottom-line` elements.

## Prerequisites

- Node.js >= 18 (tested with v24)
- A Chromium-based browser on PATH (`chromium`, `google-chrome`, etc.)
  or set `CHROMIUM_BIN=/path/to/chrome`
- The extension must be built:
  ```bash
  cd /root/github/BewlyLinuxDo
  npm run build
  ```

## Quick Start

```bash
cd /root/github/BewlyLinuxDo/.trellis/tasks/06-15-show-topic-tags-below-posts-on-linux-do-lists/demo
bash launch.sh
```

That single command will:

1. Generate the self-signed certificate (skip if `demo/certs/` already has it).
2. Start the HTTPS server on port 8443.
3. Open Chromium with an isolated profile (in `demo/chromium-profile/`).
4. Navigate to `https://linux.do:8443/latest`.
5. Clean up everything on Ctrl+C.

## Expected Result

- Topic rows with `tag-*` classes should show golden-tagged badge links
  (styled differently from native tags so they are easy to spot).
- The diagnostic panel at the bottom should report:
  - Number of `[data-bewly-topic-tags]` containers found.
  - Zero containers inside hidden `.link-bottom-line` (the extension must place
    them after the **visible** category anchor).
  - Per-row breakdown showing which rows got tags and where they were placed.

## Files

| File | Purpose |
|------|---------|
| `gen-cert.sh` | Generates self-signed cert in `demo/certs/` |
| `server.js` | Node.js HTTPS server (port 8443) |
| `index.html` | Fake Horizon topic-list page with diagnostic panel |
| `launch.sh` | All-in-one launcher (cert + server + Chromium) |
| `certs/` | Generated certificate and key (gitignored) |
| `chromium-profile/` | Ephemeral Chromium user data dir (gitignored) |

## Overriding the Browser

```bash
CHROMIUM_BIN=/usr/bin/google-chrome-stable bash launch.sh
```

## Notes

- The Chromium profile directory (`demo/chromium-profile/`) is ephemeral and can
  be safely deleted at any time.
- The self-signed cert is only valid for 365 days and only for demo purposes.
- The server serves the same HTML for all paths, so both `/` and `/latest` work.
