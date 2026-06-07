# Publish build zips to GitHub Packages

## Goal

Remove Git-tracked build ZIP artifacts from the repository and publish generated extension ZIP files through GitHub Packages during the release flow, so source commits no longer carry binary build outputs while release artifacts remain downloadable from the repository package area.

## What I already know

* User requested: delete the Git-pushed build artifact and publish build artifacts (ZIP archives) to Packages instead.
* `extension.zip` is currently tracked by Git.
* `.gitignore` already ignores `*.zip`, so removing tracked ZIPs should prevent future accidental commits once `git rm --cached` is applied.
* `package.json` already defines ZIP generation scripts:
  * `pack:zip` → `extension.zip`
  * `pack:zip-firefox` → `extension-firefox.zip`
  * `pack:zip-firefox-sources` → `extension-firefox-sources.zip`
* `.release-it.json` currently builds and packs ZIPs after version bump, uploads Chrome/Firefox ZIPs to GitHub Releases, then runs browser-store submission.
* `.github/workflows/release-it.yml` currently grants `contents: write` and `id-token: write`, but not `packages: write`.
* GitHub Packages supports native registries such as npm, RubyGems, Maven/Gradle, NuGet, and Container; it does not provide a generic arbitrary ZIP package registry. ZIP artifacts therefore need to be wrapped in a supported package format. For this JS project, npm package publication to GitHub Packages is the least invasive fit.

## Assumptions (temporary)

* “packages” means GitHub Packages, not a local `packages/` directory.
* The desired package should be published from the release workflow, not on every CI push.
* The package should contain ZIP build artifacts only and should not replace the existing browser-store submission flow.
* The package can be private by default unless repository/package visibility is configured on GitHub.

## Open Questions

* None. Confirmed package identity: `@decade6666/bewlylinuxdo-artifacts`.
* None. Confirmed MVP scope: current requirement only.

## Requirements (evolving)

* Remove tracked build ZIP artifact(s) from Git while preserving source build scripts.
* Keep generated ZIPs ignored in normal working trees.
* Add a release-flow step that publishes the generated ZIP artifact package `@decade6666/bewlylinuxdo-artifacts` to GitHub Packages using `GITHUB_TOKEN`.
* Grant the release workflow `packages: write` permission.
* Package publication should not require hardcoded secrets.
* Keep existing GitHub Release upload and `pnpm run submit` behavior.

## Acceptance Criteria (evolving)

* [ ] `extension.zip` is no longer tracked by Git.
* [ ] `*.zip` remains ignored by `.gitignore`.
* [ ] Release workflow has `packages: write` permission.
* [ ] A generated package tarball for GitHub Packages includes the extension ZIP artifact(s) and minimal package metadata.
* [ ] Package publication uses `NODE_AUTH_TOKEN=${{ secrets.GITHUB_TOKEN }}` or equivalent GitHub Actions auth, with no hardcoded token.
* [ ] Existing build/pack scripts still generate non-empty ZIP artifacts.
* [ ] Lint/type/test or the closest relevant validation has been run and recorded.

## Definition of Done (team quality bar)

* Tests/validation commands run where appropriate.
* Lint / typecheck / CI-equivalent checks are green or failures are documented.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered for release workflow changes.
* No unrelated dirty files remain.

## Out of Scope (explicit)

* Publishing arbitrary generic ZIPs without a supported package registry wrapper.
* Changing browser-store submission behavior.
* Replacing or removing GitHub Release asset upload.
* Adding old GitHub Packages version cleanup/retention automation.
* Publishing from normal CI pushes.
* Introducing new third-party publishing services.

## Research References

* [`research/github-packages-npm-zip-artifacts.md`](research/github-packages-npm-zip-artifacts.md) — GitHub Packages registry constraints and npm wrapper recommendation.

## Research Notes

### Feasible approaches here

**Approach A: npm artifact package in GitHub Packages** (Recommended)

* How it works: create a small package metadata file for artifacts, copy generated ZIPs into a package staging directory, run `npm pack` / `npm publish` against `https://npm.pkg.github.com` in the release workflow.
* Pros: Uses GitHub Packages’ supported npm registry; fits existing Node/pnpm project; no new external service; supports versioned downloads.
* Cons: ZIPs are nested inside an npm package tarball instead of being a raw generic ZIP package.

**Approach B: OCI artifact in GitHub Container Registry**

* How it works: wrap ZIP files as OCI artifacts and publish to GHCR.
* Pros: GitHub Packages supports container/OCI storage; can hold arbitrary blobs.
* Cons: Adds Docker/OCI tooling and makes downloads less friendly for extension users.

**Approach C: GitHub Release assets only**

* How it works: keep uploading ZIPs to GitHub Releases and remove Git tracking, but do not publish to GitHub Packages.
* Pros: Simplest; raw ZIP download UX is excellent.
* Cons: Does not satisfy the explicit “publish to packages” requirement.

## Technical Approach

Use Approach A unless the user chooses otherwise: keep normal source package private/non-published, add a dedicated artifact package staging/publish script, publish that package only from `.github/workflows/release-it.yml`, and remove `extension.zip` from Git tracking.

## Decision (ADR-lite)

**Context**: Git-pushed binary ZIP artifacts bloat repository history and conflict with `.gitignore`; GitHub Packages does not support raw generic ZIP package uploads.

**Decision**: Publish ZIP artifacts as the scoped npm package `@decade6666/bewlylinuxdo-artifacts` in GitHub Packages.

**Consequences**: Build ZIPs become versioned GitHub Packages entries. Consumers may need to download/extract an npm package tarball to access the ZIPs, while GitHub Release assets remain the easiest raw ZIP download path if retained.

## Technical Notes

* Inspected `package.json`, `.release-it.json`, `.github/workflows/release-it.yml`, `.github/workflows/ci.yml`, `.gitignore`.
* External official-doc evidence collected from GitHub Docs via grok-search:
  * GitHub Packages supported registries: npm/RubyGems/Maven/Gradle/NuGet/Container.
  * GitHub Actions npm publish example uses `permissions: packages: write`, `actions/setup-node`, registry URL `https://npm.pkg.github.com`, and `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.
