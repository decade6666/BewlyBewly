# Journal - home (Part 1)

> AI development session journal
> Started: 2026-06-03

---

## Session 1: Fix Linux.do homepage hide behavior

**Date**: 2026-06-03
**Task**: Fix Linux.do homepage hide behavior
**Branch**: `main`

### Summary

Fixed Linux.do homepage cleanup to run on /latest, constrained pinned-topic selectors, updated regression tests and frontend DOM contract spec.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c4e8dc24` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Fix Linux.do homepage tag layout release

**Date**: 2026-06-17
**Task**: Fix Linux.do homepage tag layout release
**Branch**: `release/v0.1.5`

### Summary

Fixed Horizon homepage topic tags wrapping in Linux.do lists, validated in browser and tests, then republished v0.1.5 with updated artifacts after removing v0.1.6.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `321ebb38` | (see git log) |
| `a695c70a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Lock host page scroll while drawer open; release v0.1.7

**Date**: 2026-06-20
**Task**: Lock host page scroll while drawer open; release v0.1.7
**Branch**: `main`

### Summary

Added setLinuxDoDrawerHostScrollLock pure function in src/sites/linuxDo.ts to lock host page scroll (overflow:hidden + scrollbar-width padding compensation) while the iframe drawer is open, removing the external native scrollbar so users no longer mis-touch it; restores exact inline styles on close, idempotent and null-safe. Wired via watch(showIframeDrawer) in App.vue with onBeforeUnmount safety unlock. 89 unit tests + vue-tsc + eslint + Chrome/Firefox build pass; verified on linux.do/latest (external scrollbar 15px to 0, content width and main-outlet position unchanged, restored on close). Shipped through PR #2 merged to main and GitHub release v0.1.7 with extension.zip and extension-firefox.zip marked latest.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4c2a0dcb` | (see git log) |
| `48fbc734` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
