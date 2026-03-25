# Themes

This module owns the active shell theme runtime and applies the resolved design tokens to the document root.

## Main entry points

- `ThemeProvider.tsx`: theme context, active preset state, token override state, and DOM token application.

## Responsibilities

- Resolve the active theme preset from the registered theme catalog.
- Apply theme tokens, tightness metrics, and surface hierarchy metrics to CSS custom properties.
- Expose the runtime API used by theme menus, settings, and themed widgets.
- Persist the selected preset locally when backend preferences are not configured.

## Persistence behavior

- When `preferences.url` is configured, theme persistence is handled through the shared preferences snapshot and hydrated by `CommandCenterPreferencesProvider`.
- When `preferences.url` is blank or omitted, the active preset falls back to browser-local persistence under `ms.command-center.theme`.
- This module currently persists the active preset only. Token overrides, tightness overrides, and surface hierarchy overrides remain runtime-only.

## Maintenance notes

- Keep theme preset ids stable once shipped; persisted user preferences depend on those ids.
- If theme persistence expands beyond the preset id, extend the shared preferences contract instead of introducing a second backend persistence path.
