# Project Instructions

Project-specific rules for AI assistants. Trellis workflow lives in `AGENTS.md` / `.trellis/`; this file holds repo conventions not covered there.

## Releases

- GitHub release descriptions / notes for this repository MUST be written in Chinese (user-facing content).
- This repo is a fork of the archived `BewlyBewly/BewlyBewly`. `gh pr create` / `gh release create` default to the archived upstream and fail as read-only — always pass `--repo decade6666/BewlyLinuxDo` to scope gh PR/release commands to this fork.
- Release tags are `vX.Y.Z` on `main`, marked `--latest`, with assets `extension.zip` and `extension-firefox.zip` (built via `pnpm build` / `pnpm build-firefox` + `pnpm pack:zip*`).
