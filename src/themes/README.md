# Themes

This module owns the active shell theme runtime. Reusable theme contracts, presets, palette helpers,
density metrics, surface hierarchy metrics, and DOM application helpers live in the local workspace
package `@dev-mainsequence/command-center-themes`.

## Main entry points

- `ThemeProvider.tsx`: theme context, active preset state, token override state, and document-root
  application through `applyThemePresetToRoot`.
- `ThemeContext.ts`: React context and hooks for app-local theme runtime access.
- `build-theme-snippet.ts`: Theme Studio snippet generation for copied or edited presets.
- `packages/command-center-themes/`: shared package source for portable theme presets and helpers.

## Responsibilities

- Resolve the active theme preset from the registered theme catalog.
- Apply package-owned theme tokens, tightness metrics, and surface hierarchy metrics to CSS custom
  properties.
- Resolve the package-owned data-viz palette contract for chart widgets.
- Expose the runtime API used by theme menus, settings, and themed widgets.
- Persist the selected preset locally when backend preferences are not configured.
- Feed Theme Studio with the resolved categorical, sequential, and diverging palette families so
  operators can inspect and export the actual palette contract used by palette-driven charts.

## Persistence behavior

- When `preferences.url` is configured, theme persistence is handled through the shared preferences snapshot, bootstrapped from the last cached snapshot, and revalidated by `CommandCenterPreferencesProvider`.
- When `preferences.url` is blank or omitted, the active preset falls back to browser-local persistence under `ms.command-center.theme`.
- This module currently persists the active preset only. Token overrides, tightness overrides, and surface hierarchy overrides remain runtime-only.

## Maintenance notes

- Keep theme preset ids stable once shipped; persisted user preferences depend on those ids.
- Define built-in preset objects in `packages/command-center-themes/src/presets/`.
- When a theme needs more than token swaps, keep package presets app-neutral and place any
  Command Center shell chrome rules in `src/styles/globals.css` behind `html[data-theme="..."]`.
- Prefer defining chart palette behavior at the theme layer instead of hardcoding widget-local
  color ramps. Categorical palettes should be explicit or theme-derived defaults, while sequential
  and diverging ramps should be generated through package palette helpers.
- Theme Studio now exports the resolved palette families into generated preset snippets so copied
  themes carry an explicit default data-viz palette contract instead of relying only on implicit
  runtime fallback.
- If theme persistence expands beyond the preset id, extend the shared preferences contract instead of introducing a second backend persistence path.
