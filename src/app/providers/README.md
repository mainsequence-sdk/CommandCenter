# App Providers

This directory owns top-level React provider wiring for the shell.

## Entry Points

- `AppProviders.tsx`: mounts query, config, theme, preferences, toast, and authenticated-session bootstrap providers around the router.
- `WidgetRegistrySyncBootstrap.tsx`: authenticated-session side effect that triggers widget-type sync from the live runtime registry.

## Notable Behavior

- Widget-type sync runs from the provider layer on purpose so it follows authenticated session state instead of being coupled to any one page.
- The bootstrap is fire-and-forget; sync deduplication and failure reporting live in the registry sync module.

## Maintenance Notes

- Keep provider-level session side effects here when they are app-wide concerns rather than page concerns.
