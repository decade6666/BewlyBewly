# BewlyLinuxDo

English | [简体中文](README-cmn_CN.md)

BewlyLinuxDo is a browser extension focused on improving the Linux.do browsing flow. It keeps topic-list pages in place and opens Linux.do topics in an iframe drawer so users can read a topic, close it, and return to the same list context quickly.

This project is a Linux.do migration of the original BewlyBewly codebase. The current scope is Linux.do-only; Bilibili-specific UI and API features are not part of the active product direction.

## Main features

- Open Linux.do topic links from list pages in a right-sized drawer overlay.
- Update the address bar to the current topic URL while the drawer is open, then restore the list URL when the drawer closes.
- Support browser Back/Forward for the drawer route state where possible.
- Keep the drawer header actions visible, with buttons for opening the topic in a new tab and closing the drawer.
- Hide selected Linux.do homepage elements, including pinned topics.
- Provide a floating settings button on Linux.do pages for the homepage cleanup toggles.
- Limit extension host permissions and content scripts to `https://linux.do/*`.

## Usage

1. Install or load the extension in Chrome or Edge.
2. Open `https://linux.do/`, `/latest`, `/top`, `/hot`, or a category topic-list page.
3. Click a valid topic link to open it in the drawer.
4. Use `Esc`, the close button, or browser Back to close the drawer.
5. Use the floating settings button at the bottom-right of the page to enable or disable homepage cleanup options.

## Local installation for Chrome or Edge

```bash
pnpm install
pnpm build
pnpm pack:zip
```

After building, use one of these methods:

- Load the generated `extension/` directory through `chrome://extensions` or `edge://extensions` with Developer mode enabled.
- Use the generated `extension.zip` as the Chromium test artifact when a packaged ZIP is required.

## Development

```bash
pnpm install
pnpm dev
pnpm start:chromium
```

`pnpm start:chromium` starts a Chromium test profile configured to open `https://linux.do/`.

## Verification commands

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm pack:zip
```

For Chromium artifact validation, also verify `extension/manifest.json`, `extension.zip`, ZIP integrity, and checksum when distributing a local test build.

## Documentation

- [Contribution guide](docs/CONTRIBUTING.md)
- [Linux.do migration plan](docs/bewly-linux-do-migration-plan-cmn_CN.md)

## Non-goals

BewlyLinuxDo does not implement AI-assisted posting, reply generation, or other content-generation features. The project is intended for UI and browsing-flow improvements only.

## Credits

- [BewlyBewly](https://github.com/hakadao/BewlyBewly) for the original extension codebase.
- [vitesse-webext](https://github.com/antfu/vitesse-webext) for the browser-extension development template.
