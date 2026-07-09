# Settings

Routed Settings module for account, billing, organization, application, and platform settings.

## Entry Points

- `SettingsPage.tsx`: primary routed page for `/app/settings/*`.
- `resolveSettingsSectionPath`: maps shell settings section IDs to routed Settings paths.

## Behavior

- Settings is navigation-only reorganization. Existing account and organization-admin components
  keep their data fetching, mutations, confirmations, and access checks.
- Organization-admin pages render when the backend shell-access response grants the matching
  Settings app or section scope and render without their old internal admin sidebar under
  `/app/settings/*`.
- Access & RBAC is exposed as its own Settings navigation group when the backend grants the
  matching `settings.access-rbac` scope or a broader `settings` scope. Its existing pages render
  without the standalone Access & RBAC sidebar when embedded here.
- Platform settings are exposed under the `Platform` Settings group only when the backend grants
  `settings.platform` or a broader `settings` scope.
- Extension `shellMenuContributions` are adapted into Settings application routes so existing
  contribution components keep their data fetching and mutations unchanged.
- Application-owned settings contributions are grouped under the owning application label in the
  `Applications` navigation group. For example, Main Sequence AI owns `Agents Settings` and
  `Model Providers`.
- Personal credit usage is shown as `Account > Usage Detail` at
  `/app/settings/account/usage-detail`, while its shell-access key remains
  `settings.billing.credits`. The legacy `/app/settings/billing/credits` URL redirects to the
  account-owned route.
- Settings routes declare a layout mode instead of sharing one fixed content width. Profile and
  preference pages use `narrow`, ordinary forms use `standard`, and registry/table-heavy
  organization, billing, Access & RBAC, and platform pages use `wide`.

## Maintenance Notes

- Do not move backend calls into this module unless the underlying settings feature is also being
  re-owned. This module should compose existing settings pages, not normalize their API contracts.
- Settings is the only frontend route namespace for account, billing, organization, Access & RBAC,
  application, and platform settings. Do not add standalone `admin` or `access-rbac` app routes
  back into the shell registry.
- Pick a route layout deliberately. Do not put data tables or registry tools in the default
  constrained content width; use `wide` unless the page is a compact form/detail surface.
- When adding a new Settings section, update the route list, the Settings app registry metadata in
  `src/extensions/core/index.ts`, ADR 079 if the section changes the documented structure, and
  [ADR 081](/Users/jose/code/MainSequenceClientSide/CommandCenter/docs/adr/command_center/adr-081-general-shell-access-scope-resolution.md)
  if it changes shell-access scope resolution.
