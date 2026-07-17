# Command Center Themes

Shared theme package for Main Sequence Command Center and embedded applications.

## Purpose

This package is the source of truth for reusable Command Center theme contracts, presets,
data-visualization palettes, density metrics, surface hierarchy metrics, and DOM CSS-variable
application helpers.

Command Center imports this package locally from the monorepo. External iframe applications can
install the published package and resolve the active `themeId` sent by the host application.

## Main Entry Points

- `src/types.ts`: stable `ThemePreset`, token, density, and data-viz palette contracts.
- `src/presets/`: built-in theme presets exported by id-stable objects.
- `src/chart-palettes.ts`: data-viz palette resolution and palette helper functions.
- `src/tightness.ts`: density metrics used by tables and compact UI surfaces.
- `src/surface-hierarchy.ts`: nested-surface chrome metrics.
- `src/apply-theme.ts`: DOM helper for applying a resolved theme to an element.

## Usage

```ts
import {
  applyThemePresetToRoot,
  commandCenterThemes,
  resolveCommandCenterThemeById,
} from "@mainsequence/command-center-themes";

const theme = resolveCommandCenterThemeById("main-sequence-space") ?? commandCenterThemes[0];

if (theme) {
  applyThemePresetToRoot(document.documentElement, { theme });
}
```

## Maintenance Notes

- Keep theme ids stable once published. Command Center persists selected theme ids in user
  preferences.
- Add new presets to `src/presets/` and export them from both `src/presets/index.ts` and
  `src/index.ts`.
- Treat token key removals or renames as breaking changes.
- This package intentionally has no React, Vite, app-registry, auth, or storage dependencies.
