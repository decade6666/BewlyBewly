# Research: GitHub Packages npm ZIP Artifact Publishing

- **Query**: How to publish extension ZIP build artifacts to GitHub Packages from this repo's release flow.
- **Scope**: mixed (internal code + external GitHub/npm docs)
- **Date**: 2026-06-07

---

## 1. GitHub Packages Registry Constraints

**Supported registries** (official): npm, RubyGems, Maven/Gradle, NuGet, Container (OCI).

There is **no generic/arbitrary file registry**. ZIP files cannot be uploaded raw to GitHub Packages. The only path is to wrap them inside a supported package format. For this JS/pnpm project, the npm registry is the lowest-friction fit.

**Source**: [GitHub Docs - About GitHub Packages](https://docs.github.com/packages), [Working with the npm registry](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

---

## 2. npm Package Name / Scope Requirements for GitHub Packages

| Constraint | Detail |
|---|---|
| **Scoped name required** | GitHub Packages npm registry only accepts scoped packages: `@NAMESPACE/PACKAGE-NAME`. Unscoped names are rejected. |
| **Scope = owner** | NAMESPACE must match the GitHub user or org that owns the repository (`decade6666` in this case). |
| **Lowercase only** | Package names and scopes must use only lowercase letters. |
| **Tarball size limit** | Each npm version tarball must be < 256 MB. Extension ZIPs are well within this. |
| **Repository linking** | Optional. If `repository` field is absent, GitHub infers the repo from the scope + name. If present, it must match the actual repo URL. |

**Source**: [Working with the npm registry](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

---

## 3. Recommended Approach: Separate Artifact Package

### Why a separate package.json, not the source package

The main `package.json` has `"name": "bewly-linux-do"` (unscoped, `"private": true`). Changing it to a scoped name would affect the entire project's dependency resolution. Instead, create a **dedicated staging directory** (e.g. `packages/artifacts/`) with its own `package.json` whose sole purpose is to wrap the ZIPs into an npm tarball and publish it.

### Package name convention

`@decade6666/bewlylinuxdo-artifacts`

- Scope `@decade6666` matches the repo owner.
- `bewlylinuxdo-artifacts` distinguishes it from the source package.
- All lowercase, URL-safe.

### Staging directory structure

```
packages/artifacts/
  package.json    # minimal metadata, private: false
  extension.zip   # copied in at publish time
  extension-firefox.zip
```

The `package.json` for the artifact package:

```json
{
  "name": "@decade6666/bewlylinuxdo-artifacts",
  "version": "<from release-it>",
  "description": "BewlyLinuxDo browser extension build artifacts",
  "repository": "github:decade6666/BewlyLinuxDo",
  "license": "UNLICENSED",
  "files": ["*.zip"]
}
```

Key points:
- `"files": ["*.zip"]` ensures only ZIPs are included in the tarball.
- No `publishConfig` or `.npmrc` needed in this directory; the workflow handles registry routing via `setup-node`.
- `version` is set dynamically to match the release version (via `release-it` hooks or a workflow script).

---

## 4. GitHub Actions Permissions and Auth

### Required workflow permissions

```yaml
permissions:
  contents: write # already present (for git push / release upload)
  packages: write # NEW — required for npm publish to GitHub Packages
  id-token: write # already present (release-it provenance)
```

`packages: write` is mandatory. Without it, `npm publish` returns 403.

**Source**: [Publishing and installing a package with GitHub Actions](https://docs.github.com/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions), [About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages)

### Registry URL and scope

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 'lts/*'
    registry-url: 'https://npm.pkg.github.com'
    scope: '@decade6666'
```

`setup-node` generates an `.npmrc` on the runner:

```
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
@decade6666:registry=https://npm.pkg.github.com
always-auth=true
```

**Critical**: The current `release-it.yml` uses `registry-url: 'https://registry.npmjs.org'` (npmjs.org). This must be changed to `https://npm.pkg.github.com` and `scope: '@decade6666'` added, or a second `setup-node` step added before the publish step.

### Auth token

```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`GITHUB_TOKEN` is auto-generated per workflow run. No PAT or additional secret is needed for publishing to the same repo's GitHub Packages.

**Source**: [Publishing Node.js packages](https://docs.github.com/en/enterprise-server@3.13/actions/publishing-packages/publishing-nodejs-packages)

---

## 5. Mapping to Existing Repo Files

### `package.json` (root)

- **Current**: `"name": "bewly-linux-do"`, `"private": true`, no `publishConfig`.
- **Impact**: No change needed to the root package.json. The artifact package is separate. The `"private": true` flag on the root package already prevents accidental `npm publish` of the source package.

### `.npmrc` (root)

- **Current content**:
  ```
  shamefully-hoist=true
  auto-install-peers=true
  strict-peer-dependencies=false
  ```
- **Impact**: No change needed. These are pnpm settings only. The workflow uses `setup-node` to generate a runtime `.npmrc` for GitHub Packages auth; this does not conflict with the root `.npmrc`.

### `.release-it.json`

- **Current `after:bump` hooks**: build, build-firefox, pack:zip, pack:zip-firefox, pack:zip-firefox-sources.
- **Current `after:release` hooks**: `gh release upload` + `pnpm run submit`.
- **Impact**: Two options:
  1. Add a new hook (e.g. `after:release` or a custom plugin hook) that runs an npm publish script for the artifact package.
  2. Handle artifact publishing in the workflow YAML after `release-it` completes (cleaner separation; avoids `.release-it.json` complexity).

  **Option 2 is recommended**: the workflow runs `release-it`, then has a dedicated step that copies ZIPs into `packages/artifacts/`, sets the version, and runs `npm publish` from that directory.

### `.github/workflows/release-it.yml`

- **Current**: Single job, `permissions: { contents: write, id-token: write }`, `setup-node` with `registry-url: 'https://registry.npmjs.org'`, one `release-it` step.
- **Impact**: Add `packages: write` to permissions. After the `release-it` step, add a step to publish the artifact package:

  ```yaml
  - name: Publish artifacts to GitHub Packages
    run: |
      mkdir -p packages/artifacts
      cp extension.zip extension-firefox.zip packages/artifacts/
      cd packages/artifacts
      # Set version from package.json (already bumped by release-it)
      VERSION=$(node -p "require('../../package.json').version")
      npm version "$VERSION" --allow-same-version --no-git-tag-version
      npm publish
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  ```

  The `setup-node` step needs `registry-url: 'https://npm.pkg.github.com'` and `scope: '@decade6666'`. Since `release-it` itself does not publish to npmjs.org (it uses `echo 'skipping publish'`), changing the registry URL is safe.

### `.gitignore`

- **Current**: Already includes `*.zip`.
- **Impact**: After `git rm --cached extension.zip`, the git-tracked ZIP is removed and `.gitignore` prevents re-committing. No `.gitignore` change needed. The `packages/artifacts/` directory should also be gitignored since it is staging-only.

---

## 6. Publishing the Artifact Package Without Leaking the Source Package

The root `package.json` has `"private": true`, so `npm publish` from the root directory is blocked by npm. However, `setup-node` with `registry-url` and `scope` will generate `.npmrc` that routes all scoped publishes to GitHub Packages. To avoid any ambiguity:

- Always `cd packages/artifacts && npm publish` -- never publish from root.
- The artifact package.json should NOT have `"private": true`.
- The root package.json retains `"private": true` as a safety net.

---

## 7. Downloading the Published Package

Consumers (including the repo itself or CI) can download artifacts via:

```bash
npm pack @decade6666/bewlylinuxdo-artifacts@<version>
tar -xzf decade6666-bewlylinuxdo-artifacts-<version>.tgz
# ZIPs are at package/*.zip
```

Or from the GitHub Packages web UI: repository page > Packages tab > select the package > download.

---

## 8. External References

| Source | URL | Relevance |
|---|---|---|
| GitHub Docs: Publishing Node.js packages | https://docs.github.com/actions/tutorials/publish-packages/publish-nodejs-packages | Official workflow pattern with `setup-node`, `registry-url`, `scope`, `NODE_AUTH_TOKEN` |
| GitHub Docs: Working with the npm registry | https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-npm-registry | Scoped package requirements, `.npmrc` configuration, `publishConfig`, repository linking |
| GitHub Docs: Publishing with GitHub Actions | https://docs.github.com/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions | `GITHUB_TOKEN` auth, `packages: write` permission, granular permissions |
| GitHub Docs: About permissions for GitHub Packages | https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages | Permission scopes (`read:packages`, `write:packages`), repository-scoped package inheritance |
| GitHub Docs: Packages quickstart | https://docs.github.com/packages/quickstart | End-to-end example with `.npmrc` and `publishConfig` approaches |
| npm Docs: scope | https://docs.npmjs.com/cli/v8/using-npm/scope | Scoped package naming rules, registry association |

---

## Caveats / Not Found

1. **`npm pack` vs `npm publish`**: The `npm publish` command publishes the current directory as a package. It does NOT require running `npm pack` first; `npm publish` creates and uploads the tarball internally. Using `npm pack` separately is only needed if you want to inspect or upload the tarball via API.

2. **release-it version injection**: The artifact package's `version` field must match the release version. The simplest approach is `npm version $VERSION --allow-same-version --no-git-tag-version` in the workflow, reading `$VERSION` from the root `package.json` after `release-it` bumps it.

3. **`setup-node` registry conflict**: The current workflow uses `registry-url: 'https://registry.npmjs.org'`. Since `release-it` does not actually publish to npmjs.org (`publishCommand: "echo 'skipping publish'"`), changing this to `https://npm.pkg.github.com` is safe. However, if future changes add real npmjs.org publishing, a second `setup-node` step or explicit `.npmrc` management would be needed.

4. **Package visibility**: By default, packages published via `GITHUB_TOKEN` inherit the repository's visibility. If the repo is public, the package is public; if private, the package is private. No extra configuration needed.

5. **Old versions**: GitHub Packages retains all published versions. There is no automatic cleanup. Consider documenting a retention policy or using the GitHub API to delete old artifact package versions if storage is a concern.
