# Command Center Themes

Shared theme package for Main Sequence Command Center and embedded applications.

## Purpose

This package is the source of truth for reusable Command Center theme contracts, presets,
data-visualization palettes, density metrics, surface hierarchy metrics, bundled CSS, font stacks,
and DOM CSS-variable application helpers.

Command Center imports this package locally from the monorepo. External iframe applications can
install the published package and resolve the active `themeId` sent by the host application.

## Main Entry Points

- `src/types.ts`: stable `ThemePreset`, token, density, and data-viz palette contracts.
- `src/presets/`: built-in theme presets exported by id-stable objects.
- `src/chart-palettes.ts`: data-viz palette resolution and palette helper functions.
- `src/tightness.ts`: density metrics used by tables and compact UI surfaces.
- `src/surface-hierarchy.ts`: nested-surface chrome metrics.
- `src/css-vars.ts`: helpers for building CSS-variable maps or style blocks.
- `src/apply-theme.ts`: DOM helper for applying a resolved theme to an element.
- `styles.css`: browser-ready base stylesheet, theme chrome variables, body typography, and reusable
  Command Center chrome selectors.
- `utilities.css`: optional text-size, line-clamp, token-swatch, and positive/negative utility
  classes.
- `tailwind.css`: Tailwind v4 theme-variable mapping for apps that use Tailwind utilities.
- `fonts.css`: shared Command Center font-stack custom properties.
- `markdown.css`: optional scoped markdown skin for `.command-center-markdown`.
- `ag-grid.css`: optional AG Grid skin keyed off Command Center CSS variables.
- `react-flow.css`: optional React Flow workspace graph controls and handle skin.
- `react-grid-layout.css`: optional React Grid Layout resize and placeholder skin.

## Usage

Import the CSS bundle once in the embedded application:

```ts
import "@dev-mainsequence/command-center-themes/styles.css";
```

Tailwind v4 applications should also import the theme mapping after `tailwindcss`:

```css
@import "tailwindcss";
@import "@dev-mainsequence/command-center-themes/tailwind.css";
@import "@dev-mainsequence/command-center-themes/styles.css";
@import "@dev-mainsequence/command-center-themes/utilities.css";
```

Then apply the active preset to the iframe document root:

```ts
import {
  applyThemePresetToRoot,
  commandCenterThemes,
  resolveCommandCenterThemeById,
} from "@dev-mainsequence/command-center-themes";

const theme = resolveCommandCenterThemeById("main-sequence-space") ?? commandCenterThemes[0];

if (theme) {
  applyThemePresetToRoot(document.documentElement, { theme });
}
```

For host-to-iframe messaging, the host can send either the `themeId` or a serialized style block:

```ts
import { buildThemeStyleText, resolveCommandCenterThemeById } from "@dev-mainsequence/command-center-themes";

const theme = resolveCommandCenterThemeById("main-sequence-space");
const cssText = theme ? buildThemeStyleText({ theme }) : "";
```

Import optional skins only when the consuming application uses those surfaces:

```css
@import "@dev-mainsequence/command-center-themes/markdown.css";
@import "@dev-mainsequence/command-center-themes/ag-grid.css";
@import "@dev-mainsequence/command-center-themes/react-flow.css";
@import "@dev-mainsequence/command-center-themes/react-grid-layout.css";
```

## Maintenance Notes

- Keep theme ids stable once published. Command Center persists selected theme ids in user
  preferences.
- Add new presets to `src/presets/` and export them from both `src/presets/index.ts` and
  `src/index.ts`.
- Treat token key removals or renames as breaking changes.
- Keep browser-ready portable base theme CSS in `styles.css`; keep framework or library-specific
  skins in separate optional CSS entrypoints.
- Keep Tailwind-specific mapping in `tailwind.css`.
- This package intentionally has no React, Vite, app-registry, auth, or storage dependencies.
