# Write BewlyLinuxDo migration plan document

## Goal

Persist the previously produced analysis of BewlyBewly, the current BewlyLinuxDo repository, and Linux.do architecture into a durable Markdown file so future implementation work can reference the migration strategy without relying on chat context.

## What I already know

* The user asked to write the plan into a file after a Chinese analysis/report was produced.
* Current repository is a Trellis-managed browser extension project derived from BewlyBewly.
* Existing user-facing analysis identified current project state, upstream BewlyBewly architecture, Linux.do/Discourse traits, and prioritized transplant opportunities.
* The repository has a `docs/` directory for Markdown documentation.
* Existing localized documentation uses language suffixes such as `README-cmn_CN.md` and `docs/CONTRIBUTING-cmn_CN.md`.
* `.trellis/spec/frontend/index.md` says project documentation should be written in English, but this task is preserving a Chinese user-facing migration plan. To avoid confusing it with English canonical docs, the output path will use the localized suffix `cmn_CN`.

## Requirements

* Write the migration/porting plan into `docs/bewly-linux-do-migration-plan-cmn_CN.md`.
* Include the major sections from the previous analysis:
  * evidence and scope;
  * BewlyBewly upstream architecture summary;
  * current BewlyLinuxDo repository state;
  * Linux.do architecture characteristics;
  * prioritized transplant opportunities;
  * recommended migration roadmap;
  * explicit non-goals and risks.
* Keep the document concise enough to be maintainable while preserving actionable paths and code evidence.
* Do not modify application behavior.

## Acceptance Criteria

* [ ] `docs/bewly-linux-do-migration-plan-cmn_CN.md` exists.
* [ ] The file contains a clear prioritized roadmap for future migration work.
* [ ] The file references important local source paths and relevant external URLs.
* [ ] The file documents validation boundaries, including the failed `latest.json` / `top.json` fetches.
* [ ] No source code behavior is changed.

## Definition of Done

* Markdown document written.
* Narrow validation performed by checking the file exists and reviewing the diff.
* No lint/typecheck required because this is documentation-only.

## Technical Approach

Create a localized Markdown planning document under `docs/`, using the previous report as the source of truth and preserving the most actionable recommendations. The task PRD records why the localized filename was chosen.

## Decision (ADR-lite)

**Context**: The user requested persisting a Chinese migration analysis into the repository. The project has English primary docs but also localized Chinese documentation files.

**Decision**: Write the plan to `docs/bewly-linux-do-migration-plan-cmn_CN.md` instead of an unsuffixed English canonical filename.

**Consequences**: The content remains immediately useful to the user and avoids implying that the English documentation convention has changed globally. A future task can translate/summarize it into an English canonical plan if desired.

## Out of Scope

* Implementing any migration feature.
* Changing extension behavior, settings, or tests.
* Creating an English translation of the plan.
* Updating README navigation.

## Technical Notes

* `package.json` confirms the current project description and Linux.do start URL.
* `src/manifest.ts` confirms extension permissions and content-script scope are Linux.do-only.
* `src/sites/linuxDo.ts`, `src/contentScripts/index.ts`, `src/contentScripts/views/App.vue`, and `src/components/IframeDrawer.vue` are the core current Linux.do adaptation files.
* `src/stores/mainStore.ts`, `src/stores/topBarStore.ts`, `src/utils/main.ts`, and `src/styles/adaptedStyles/index.ts` contain major Bilibili legacy references.
* `https://linux.do/site.json` was fetched and fully read from the saved tool result before summarization; `https://linux.do/latest.json` and `https://linux.do/top.json` extraction failed and should not be assumed stable without browser verification.
