# App Providers

This directory owns top-level React provider wiring for the shell.

## Entry Points

- `AppProviders.tsx`: mounts query, config, theme, preferences, and toast providers around the router.
- `GoogleTagProvider.tsx`: reads the optional platform Google tag settings from
  `config/command-center.yaml` and injects the `gtag.js` bootstrap only when a non-empty
  measurement id is enabled.

## Notable Behavior

- Provider wiring must not trigger backend widget-catalog writes during normal sign-in. Widget registry publication is now an explicit platform-admin action exposed through `SettingsDialog.tsx`.
- The app shell now also mounts `WidgetOrganizationConfigurationProvider`, which loads sparse
  organization-scoped widget type configuration overrides once for the signed-in user when the
  endpoint is configured. Widgets that do not opt into organization configuration ignore it.
- Google tag bootstrap is intentionally config-driven and empty-safe. Leaving the measurement id
  blank keeps the provider as a no-op so the application does not crash or load analytics scripts.

## Maintenance Notes

- Keep provider-level session side effects here when they are app-wide concerns rather than page concerns.
