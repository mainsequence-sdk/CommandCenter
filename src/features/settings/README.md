# Settings

Routed Settings module for account, billing, organization, application, and platform settings.

## Entry Points

- `SettingsPage.tsx`: primary routed page for `/app/settings/*`.
- `LegacyAdminSettingsRedirect`: redirects legacy `/app/admin/*` and `/app/admin-panel/*` routes
  into the equivalent Settings routes.
- `resolveSettingsSectionPath`: maps legacy shell settings section IDs to routed Settings paths.

## Behavior

- Settings is navigation-only reorganization. Existing account and organization-admin components
  keep their data fetching, mutations, confirmations, and access checks.
- Organization-admin pages retain `org_admin:view` gates and render without their old internal
  admin sidebar when embedded under `/app/settings/*`.
- Platform settings retain the same platform-admin resolver and are exposed under the `Platform`
  Settings group.
- Extension `shellMenuContributions` are adapted into Settings application routes so existing
  contribution components keep their data fetching, mutations, and permissions unchanged.
- Application-owned settings contributions are grouped under the owning application label in the
  `Applications` navigation group. For example, Main Sequence AI owns `Agents Settings` and
  `Model Providers`.

## Maintenance Notes

- Do not move backend calls into this module unless the underlying settings feature is also being
  re-owned. This module should compose existing settings pages, not normalize their API contracts.
- Keep legacy route mappings explicit so old links remain stable.
- When adding a new Settings section, update the route list, the Settings app registry metadata in
  `src/extensions/core/index.ts`, and ADR 079 if the section changes the documented structure.
