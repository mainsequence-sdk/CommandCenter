# App Providers

This directory owns top-level React provider wiring for the shell.

## Entry Points

- `AppProviders.tsx`: mounts query, config, theme, preferences, and toast providers around the router.

## Notable Behavior

- Provider wiring must not trigger backend widget-catalog writes during normal sign-in. Widget registry publication is now an explicit platform-admin action exposed through `SettingsDialog.tsx`.

## Maintenance Notes

- Keep provider-level session side effects here when they are app-wide concerns rather than page concerns.
