# Research: linux.do Dark Mode Detection from Content Script

- **Query**: How can a content script reliably detect whether the linux.do site (Discourse forum) is in dark vs light mode at runtime, and react to user toggles without a full page reload?
- **Scope**: external (Discourse source + Meta docs) + internal (existing extension code)
- **Date**: 2026-06-20

## Candidate Signal Analysis

### Signal 1: `--scheme-type` CSS custom property on `:root` (RECOMMENDED PRIMARY)

**Status: Present and reliable on all modern Discourse instances, including linux.do.**

Discourse's `color_definitions.scss` (compiled per color scheme) sets both of these on `:root`:

```scss
:root {
  color-scheme: #{schemeType()}; // standard CSS property
  --scheme-type: #{schemeType()}; // custom CSS property
  // ... all color variables follow
}
```

The `schemeType()` SCSS function resolves to the literal string `"light"` or `"dark"` at compile time. Every Discourse color scheme produces a stylesheet with these declarations.

**Source**: [Discourse `color_definitions.scss` (main branch)](https://github.com/discourse/discourse/blob/834ea70b1ce3f06e6e03d25ebee0567596ad26c2/app/assets/stylesheets/color_definitions.scss) -- lines 10-12:
```scss
color-scheme: #{schemeType()};
--scheme-type: #{schemeType()};
```

**Source**: [Discourse Meta: "How do colors work and how to change them?"](https://meta.discourse.org/t/how-do-colors-work-and-how-to-change-them/358122) -- confirms the `:root` block with `color-scheme` and `--scheme-type`.

**Source**: [Discourse Meta: "Update themes and plugins to support automatic dark mode"](https://meta.discourse.org/t/update-themes-and-plugins-to-support-automatic-dark-mode/161595) -- staff confirms: "Our color schemes come with a `--scheme-type` property that is `light` for light schemes and `dark` for dark schemes."

**DOM read code**:
```js
function isDiscourseDarkMode() {
  const schemeType = getComputedStyle(document.documentElement)
    .getPropertyValue('--scheme-type')
    .trim()
  if (schemeType === 'dark' || schemeType === 'light') {
    return schemeType === 'dark'
  }
  return null // property not found, fall through to fallback
}
```

### Signal 2: `color-scheme` CSS property on `:root` (USABLE ALTERNATIVE)

**Status: Present on the same `:root` declaration alongside `--scheme-type`.**

The standard `color-scheme` CSS property is set to `"light"` or `"dark"` on `document.documentElement`. It is functionally identical to `--scheme-type` on modern Discourse.

```js
const colorScheme = getComputedStyle(document.documentElement).colorScheme
// Returns 'light' or 'dark'
```

Note: `color-scheme` was added to `color_definitions.scss` more recently than `--scheme-type` (around Feb 2025, per [Meta discussion #353354](https://meta.discourse.org/t/is-this-still-the-solution-for-checking-for-dark-mode/353354)). Older Discourse versions may have `--scheme-type` but not `color-scheme`.

### Signal 3: `<meta name="color-scheme">` tag

**Status: NOT a reliable signal for runtime scheme detection.**

Discourse does set `<meta name="color-scheme">` tags, but these reflect `prefers-color-scheme` media queries for mobile browser chrome theming, not the user's active Discourse color scheme selection. They are set with `media="(prefers-color-scheme: light)"` and `media="(prefers-color-scheme: dark)"` attributes. Source: [PR #18832](https://github.com/discourse/discourse/pull/18832).

### Signal 4: `.dark-mode` / `.light-mode` class on `<html>` (DOES NOT EXIST)

**Status: Never merged; does not exist on any production Discourse instance.**

PR [#31397](https://github.com/discourse/discourse/pull/31397) proposed adding `html.dark-mode` and `html.light-mode` classes via a synchronous inline script. It was a **draft** by davidtaylorhq, marked stale, and **closed without merging** (Apr 2025).

[Meta discussion #353354](https://meta.discourse.org/t/is-this-still-the-solution-for-checking-for-dark-mode/353354) confirms: "As for 'right now'... A pure CSS solution would probably use the `--scheme-type` CSS variable." Multiple users confirm there is no class-based indicator: "As far as I can see Discourse does not add any classes to indicate whether the dark scheme is active" ([Meta #191365](https://meta.discourse.org/t/use-color-scheme-color-if-dark-scheme-otherwise-use-my-color/191365)).

The Discourse `html_classes` helper in `application_helper.rb` only outputs: `mobile-view`/`desktop-view`, `mobile-device`/`not-mobile-device`, `rtl`, `anon`. No dark-mode class. Source: [application_helper.rb](https://github.com/discourse/discourse/blob/14af90df5b68548872eb06d0875c9ba41c9ecf70/app/helpers/application_helper.rb).

### Signal 5: `prefers-color-scheme` media query (INSUFFICIENT ALONE)

**Status: Reflects OS/browser preference, NOT the Discourse-level scheme selection.**

Many linux.do users manually select a dark color scheme in their Discourse preferences regardless of OS setting. The `prefers-color-scheme` media query only detects OS-level dark mode preference. Multiple Discourse Meta threads confirm this limitation:

- [Meta #242218](https://meta.discourse.org/t/css-element-based-on-color-scheme-selected/242218): "This works if the theme is set as the dark mode theme and dark mode is activated by the OS, but not if the dark mode theme is chosen as the 'Regular' theme."
- [Meta #342331](https://meta.discourse.org/t/how-to-make-the-automatic-dark-theme-the-same-as-selected-dark-theme/342331/11): User reports dark palette "identifies itself as a light color scheme somehow" when using `prefers-color-scheme`.

**Conclusion**: `prefers-color-scheme` is NOT a correct signal for detecting the site's active color scheme. It should only be used as a last-resort fallback when `--scheme-type` is absent.

### Signal 6: Background color luminance (FALLBACK)

**Status: Reliable framework-agnostic fallback.**

Discourse itself determines dark vs light using the same principle in its SCSS `variables.scss`:

```scss
@function is-light-color-scheme() {
  @if dc-color-brightness($primary) < dc-color-brightness($secondary) {
    @return true;
  } @else {
    @return false;
  }
}
```

The `dc-color-brightness` function uses the W3C AERT formula: `R * 0.299 + G * 0.587 + B * 0.114`.

Source: [Discourse `variables.scss`](https://github.com/discourse/discourse/blob/master/app/assets/stylesheets/common/foundation/variables.scss).

The runtime JavaScript equivalent, reading from `--secondary` (the background color in Discourse):

```js
function isDarkByLuminance() {
  const secondary = getComputedStyle(document.documentElement)
    .getPropertyValue('--secondary').trim()
  // Parse hex (#222222 or #fff) to RGB
  const rgb = parseCssColor(secondary)
  if (!rgb)
    return null
  const brightness = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114
  // In dark scheme: secondary is dark (#222222, brightness ~34) -> primary is light
  // In light scheme: secondary is light (#ffffff, brightness ~255) -> primary is dark
  return brightness < 128 // dark background = dark mode
}
```

This works because in Discourse's dark scheme, `--secondary` is `#222222` (dark background) and in light scheme it is `#ffffff` (white background).

## How Discourse Theme Toggling Works at Runtime

Since Discourse core v3.4+ (with the `interface_color_selector` setting), users can toggle dark/light mode via a sidebar or header button. This was folded into core from the deprecated [discourse-color-scheme-toggle](https://github.com/discourse/discourse-color-scheme-toggle) theme component.

Source: [PR #31086](https://github.com/discourse/discourse/pull/31086) -- "Dark/light mode selector" merged into core.

When the user toggles the scheme, Discourse **swaps the stylesheet link element's `href`** and its `data-*` attributes (like `data-theme-name` and `data-theme-id`) for the `color_definitions` stylesheet. The `:root` CSS custom properties change accordingly because a different compiled stylesheet is now active.

## Change Observation Strategy

### Primary: MutationObserver on stylesheet link elements

The `color_definitions` stylesheet is loaded via a `<link>` element whose `data-target` attribute contains `"color_definitions"`. When the user toggles dark/light, this link element's `href` and `data-theme-*` attributes change.

```js
function observeSchemeChange(callback) {
  // Initial check
  callback(isDiscourseDarkMode())

  // Observe <link> attribute changes for color_definitions stylesheet
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const target = mutation.target
      if (target.tagName === 'LINK'
        && target.dataset?.target?.includes('color_definitions')) {
        // Small delay to let the new stylesheet apply
        requestAnimationFrame(() => {
          callback(isDiscourseDarkMode())
        })
        break
      }
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'data-theme-name', 'data-theme-id'],
  })

  return observer
}
```

### Fallback: Periodic polling + `prefers-color-scheme` listener

For robustness, combine with a `prefers-color-scheme` change listener (catches OS-level toggles) and optional low-frequency polling:

```js
// OS dark mode change
window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    // Re-check the actual site scheme (not just the OS preference)
    requestAnimationFrame(() => callback(isDiscourseDarkMode()))
  })
```

## Recommendation

### Primary Signal: `--scheme-type` CSS custom property

- Present on `:root` on all modern Discourse instances
- Value is exactly `"light"` or `"dark"` -- no ambiguity
- Survives anonymous cache (the stylesheet is compiled per scheme, not per user)
- Read via: `getComputedStyle(document.documentElement).getPropertyValue('--scheme-type').trim()`

### Fallback: `--secondary` color luminance

- For the rare edge case where `--scheme-type` is not present (very old Discourse)
- Read `--secondary` from `:root`, compute W3C AERT brightness, threshold at 128
- In dark scheme: `--secondary` = `#222222` (brightness ~34)
- In light scheme: `--secondary` = `#ffffff` (brightness ~255)

### Change Observation: MutationObserver on `<link data-target*="color_definitions">`

- Watch `href` and `data-theme-*` attribute changes on the stylesheet link element
- Debounce with `requestAnimationFrame` to let the new stylesheet apply
- Supplement with `matchMedia('(prefers-color-scheme: dark)')` change listener

## Existing Extension Dark Mode Implementation

The extension's current `useDark.ts` composable (`src/composables/useDark.ts`) does NOT read the host site's dark mode. It uses VueUse's `usePreferredDark()` (OS-level `prefers-color-scheme`), then overrides with the user's `settings.theme` preference (`'light' | 'dark' | 'auto'`). It applies a `.dark` class to `document.documentElement` and `#bewly`, and dispatches a `global.themeChange` custom event.

For the linux.do overlay buttons/panels, the detection logic described above would be used independently of the existing `useDark()` composable -- it reads the **site's** actual dark state rather than the **extension's** preference.

## Caveats

- `--scheme-type` resolves to an empty string (not `null`) when the property is absent; always check for `'dark'`/`'light'` explicitly rather than just truthiness.
- Linux.do may use custom Discourse plugins or themes that override the default `color_definitions.scss`. However, the `--scheme-type` property is set in the core SCSS compilation pipeline and is extremely unlikely to be removed.
- The `MutationObserver` approach depends on the `<link>` element having a `data-target` containing `"color_definitions"`. If linux.do uses a non-standard stylesheet loading strategy, the luminance fallback covers this.
- The `color-scheme` CSS property (standard) was added to Discourse `color_definitions.scss` around Feb 2025. Older Discourse installations may have `--scheme-type` but not `color-scheme`.
