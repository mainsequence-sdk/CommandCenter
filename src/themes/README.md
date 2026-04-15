# Themes

This module owns the active shell theme runtime and applies the resolved design tokens to the document root.

## Main entry points

- `ThemeProvider.tsx`: theme context, active preset state, token override state, and DOM token application.
- `chart-palettes.ts`: default and overrideable data-viz palette resolution plus sequential,
  diverging, and categorical palette helpers.
- `presets/`: first-class theme preset objects registered through the app registry.

## Responsibilities

- Resolve the active theme preset from the registered theme catalog.
- Apply theme tokens, tightness metrics, and surface hierarchy metrics to CSS custom properties.
- Resolve a theme-level data-viz palette contract for chart widgets.
- Expose the runtime API used by theme menus, settings, and themed widgets.
- Persist the selected preset locally when backend preferences are not configured.

## Persistence behavior

- When `preferences.url` is configured, theme persistence is handled through the shared preferences snapshot, bootstrapped from the last cached snapshot, and revalidated by `CommandCenterPreferencesProvider`.
- When `preferences.url` is blank or omitted, the active preset falls back to browser-local persistence under `ms.command-center.theme`.
- This module currently persists the active preset only. Token overrides, tightness overrides, and surface hierarchy overrides remain runtime-only.

## Maintenance notes

- Keep theme preset ids stable once shipped; persisted user preferences depend on those ids.
- When a theme needs more than token swaps, keep the preset object in `presets/` and place any
  theme-specific shell chrome rules in `src/styles/globals.css` behind `html[data-theme="..."]`.
- Prefer defining chart palette behavior at the theme layer instead of hardcoding widget-local
  color ramps. Categorical palettes should be explicit or theme-derived defaults, while sequential
  and diverging ramps should be generated through `chart-palettes.ts`.
- If theme persistence expands beyond the preset id, extend the shared preferences contract instead of introducing a second backend persistence path.
