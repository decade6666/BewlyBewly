# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

This project uses repository-wide linting and type checking for both extension source code and project metadata. Treat `.claude/` and `.trellis/` Markdown/YAML/JSON files as linted project files when they are tracked.

---

## Scenario: Finish-work Verification and Local Metadata Hygiene

### 1. Scope / Trigger

- Trigger: before committing code or project metadata after implementation, migration, or Trellis workflow updates.
- Applies to source files, `.claude/` agent/command files, `.trellis/` specs/tasks/workspace files, and root project configuration.

### 2. Signatures

Use the scripts defined in `package.json`:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Local-only Claude settings path:

```text
.claude/settings.local.json
```

### 3. Contracts

| Item | Contract |
|------|----------|
| Lint command | `pnpm lint` runs `eslint` across the repository. |
| Typecheck command | `pnpm typecheck` runs `vue-tsc`; do not use `pnpm type-check` unless the script exists. |
| Test command | `pnpm test` runs `vitest test`; relevant tests must pass for code changes. |
| Local Claude settings | `.claude/settings.local.json` is machine-local and must stay ignored by Git. |
| Tracked metadata | Markdown/YAML/JSON under `.claude/` and `.trellis/` must remain lint-clean. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| `pnpm type-check` is referenced | Use `pnpm typecheck`, matching the actual project script. |
| Markdown contains JSON Lines examples | Mark fenced blocks as `jsonl`, not `json`, so each line can be parsed correctly. |
| Markdown/YAML has trailing spaces, repeated blank lines, bad comment spacing, or missing EOF newline | Run `pnpm exec eslint --fix <files>` or edit manually, then rerun `pnpm lint`. |
| `.claude/settings.local.json` appears in Git status | Add or keep `.claude/settings.local.json` in `.gitignore`; do not stage it. |
| Source code changed but only metadata checks ran | Run the relevant source tests before claiming finish-work completion. |

### 5. Good/Base/Bad Cases

- Good: code changes pass `pnpm lint`, `pnpm typecheck`, and relevant `pnpm test`; local settings remain ignored.
- Base: metadata-only updates pass `pnpm lint`, with `git status --short` confirming no local settings are staged.
- Bad: documenting `pnpm type-check`, committing `.claude/settings.local.json`, or leaving invalid Markdown fenced as `json` when the content is JSON Lines.

### 6. Tests Required

- `pnpm lint`: assert zero lint errors after source or metadata changes.
- `pnpm typecheck`: assert Vue/TypeScript types pass after source changes.
- `pnpm test`: assert relevant Vitest coverage passes after behavior changes.
- `git status --short`: assert `.claude/settings.local.json` does not appear as a staged or untracked file.

### 7. Wrong vs Correct

#### Wrong

```bash
pnpm type-check
```

````markdown
```json
{"file": "...", "reason": "TypeCheck"}
{"file": "...", "reason": "Lint"}
```
````

#### Correct

```bash
pnpm typecheck
```

````markdown
```jsonl
{"file": "...", "reason": "TypeCheck"}
{"file": "...", "reason": "Lint"}
```
````

---

## Scenario: Documentation-only Migration Plan Updates

### 1. Scope / Trigger

- Trigger: preserving migration, porting, or research plans as repository documentation without changing runtime behavior.
- Applies to Markdown planning documents under `docs/` and the matching Trellis task metadata.

### 2. Signatures

Localized plan filename pattern:

```text
docs/<topic>-cmn_CN.md
```

Validation commands:

```bash
pnpm lint
git diff --name-only
git status --short --untracked-files=all
```

### 3. Contracts

| Item | Contract |
|------|----------|
| Localized Chinese plan | Use a `-cmn_CN.md` suffix when preserving user-facing Chinese analysis instead of changing the English canonical documentation convention. |
| Evidence scope | Include local source paths and external URLs used as evidence. |
| Validation boundaries | Mark failed or blocked external fetches as unverified; do not promote them to stable API assumptions. |
| Runtime behavior | Documentation-only tasks must not modify `src/`, build config, extension permissions, or storage schemas. |
| Task metadata | Keep Trellis JSON/JSONL metadata lint-clean and remove template `_example` rows before finish-work. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| The plan is Chinese user-facing content | Use `docs/<topic>-cmn_CN.md` and keep `.trellis/spec/frontend/index.md` English-doc convention unchanged. |
| External endpoint fetch failed or was blocked by Cloudflare/Turnstile | Document the failure as a validation boundary and require real-browser verification before implementation. |
| Source files appear in `git diff --name-only` for a docs-only task | Stop and review scope; remove unrelated behavior changes unless a new task explicitly authorizes them. |
| Trellis JSONL still contains `_example` template rows | Delete the template rows and keep only task-specific implementation/check records. |

### 5. Good/Base/Bad Cases

- Good: `docs/bewly-linux-do-migration-plan-cmn_CN.md` lists source paths, external URLs, failed `latest.json` / `top.json` boundaries, and no source files changed.
- Base: a docs-only plan passes `pnpm lint` and `git diff --name-only` shows only docs and Trellis metadata.
- Bad: an unsuffixed Chinese plan looks like canonical English docs, or a failed endpoint is described as a verified contract.

### 6. Tests Required

- `pnpm lint`: assert Markdown and Trellis metadata are lint-clean.
- `git diff --name-only`: assert no source/runtime files changed for documentation-only tasks.
- `git status --short --untracked-files=all`: assert the new plan and task metadata are the only relevant untracked paths before staging.
- Manual document review: assert the plan includes priority, roadmap, evidence paths, external URLs, non-goals, and validation boundaries.

### 7. Wrong vs Correct

#### Wrong

```text
docs/bewly-linux-do-migration-plan.md
```

```markdown
`https://linux.do/latest.json` is available for the migration.
```

#### Correct

```text
docs/bewly-linux-do-migration-plan-cmn_CN.md
```

```markdown
`https://linux.do/latest.json` was blocked during extraction and must be verified in a real browser session before implementation.
```

---

## Forbidden Patterns

- Do not commit `.claude/settings.local.json`; it contains local session hooks and developer-machine settings.
- Do not leave tracked project metadata outside lint coverage or assume `.md`, `.yaml`, and `.json` files are exempt from `pnpm lint`.
- Do not claim finish-work completion for source changes without running the relevant source validation.

---

## Required Patterns

- Use the exact project scripts in `package.json`: `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Keep tracked Trellis and Claude metadata lint-clean when those directories are part of the change.
- For JSON Lines examples in Markdown, use `jsonl` fenced code blocks.

---

## Testing Requirements

- Source or behavior change: run `pnpm lint`, `pnpm typecheck`, and relevant `pnpm test`.
- Metadata-only change: run `pnpm lint` and inspect `git status --short` / `git diff --name-only` for scope.
- If a user already completed manual or automated tests outside the agent session, record that fact explicitly instead of rerunning or overstating coverage.

---

## Code Review Checklist

- [ ] Validation commands match `package.json` script names.
- [ ] `.claude/settings.local.json` is ignored and not staged.
- [ ] Markdown code fences match their content format, especially `jsonl` for JSON Lines.
- [ ] Trellis/Claude metadata changes are intentional and lint-clean.
- [ ] Source changes have relevant typecheck and test evidence.
