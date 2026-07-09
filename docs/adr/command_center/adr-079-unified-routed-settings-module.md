# ADR 079: Unified Routed Settings Module

- Status: Proposed
- Date: 2026-06-26
- Related:
  - [ADR: Extension-Contributed Shell Settings Menus](./adr-extension-contributed-shell-settings-menus.md)
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [ADR: Runtime Credential Browser Auth](./adr-runtime-credential-browser-auth.md)
  - [Access Control docs](../../access-control/README.md)
  - [Apps docs](../../apps/README.md)
  - [Platform docs](../../platform/README.md)

## Context

Command Center currently splits settings and administration across two different UX models:

- User settings live in `SettingsDialog`, a modal-style shell surface opened from the user menu.
- Platform Admin Settings also reuse `SettingsDialog` internals, and they should move into the same
  routed Settings module while preserving their platform-admin-only gates.
- Organization administration lives in the `admin` app, a routed page application surfaced through
  the Organization Admin button/menu.

This creates a UX and ownership gap:

- settings that feel related are split across different entry points
- the Organization Admin button competes with the user settings button
- the settings modal is too constrained for large account, billing, and organization pages
- the Organization Admin routed app already has the better page-level interaction model, but its
  exploration submenu is noisy and too prominent
- extension-contributed settings entries exist, but the old settings-dialog framing makes them feel
  secondary instead of first-class

The previous settings-menu ADR accepted extension-contributed settings inside a dialog. That was a
reasonable first step, but the current product direction should move settings out of a modal and
into normal routed application surfaces.

## Decision

Create one first-class routed `Settings` module and use it as the single entry point for user,
billing, organization, organization-owned application, extension-contributed, and platform
configuration.

The shell should expose one Settings entry. The standalone Organization Admin button should be
removed or reduced to a compatibility redirect. Organization administration becomes a permissioned
section inside Settings, not a separate shell-level affordance.

Canonical route shape:

```text
/app/settings
/app/settings/account/profile
/app/settings/account/preferences
/app/settings/account/security
/app/settings/account/sessions
/app/settings/account/usage-detail
/app/settings/billing/invoices
/app/settings/billing/details
/app/settings/billing/hosted-resources
/app/settings/organization/users
/app/settings/organization/plans
/app/settings/organization/security-sessions
/app/settings/organization/widgets
/app/settings/applications/main-sequence-markets
/app/settings/applications/main_sequence_ai/agents-settings
/app/settings/applications/main_sequence_ai/model-providers
/app/settings/platform/configuration
/app/settings/platform/widget-registry
/app/settings/platform/connection-registry
/app/settings/organization/github
```

The exact final route list can evolve, but the route ownership is fixed: account and organization
settings pages, extension-contributed settings pages, and platform diagnostics live under
`/app/settings/...`.

## Information Architecture

The Settings module uses a page-level shell with:

- a compact page header
- a left exploration submenu
- a content outlet for the selected settings page
- no modal frame

Top-level groups:

- `Account`
- `Billing`
- `Organization`
- `Applications`
- `Platform`

The group model should be data-driven and permission-aware. If a user cannot access a group, the
group is not shown.

Recommended initial mapping:

| Settings group | Pages |
| --- | --- |
| `Account` | profile, preferences, usage detail, security, sessions |
| `Billing` | invoices, billing details, hosted resources, manage credits |
| `Organization` | users, active plans, security sessions, GitHub organizations, widget configurations |
| `Applications` | Main Sequence Markets, Main Sequence AI provider/agent settings, and other application settings |
| `Platform` | configuration, widget registry, connection registry |

Organization pages require `org_admin:view`. Platform-only diagnostics keep their existing
platform-admin permission requirements inside Settings.

## Exploration Submenu UX

The Settings exploration submenu should look closer to the current Organization Admin page model
than the modal settings nav, but it must be quieter:

- show short group labels
- show short item labels
- keep descriptions in page headers, not in the nav list
- support group collapse and expansion
- support a collapsed rail mode with icons and tooltips
- persist collapsed group state locally per user/browser
- highlight the active route
- keep badge/count affordances optional and sparse

The submenu should not render every page as a loud card or long descriptive row. It is navigation,
not documentation.

## Routing

The new `settingsApp` should be registered through the app registry as a normal app.

Settings is the canonical frontend namespace for account, billing, organization, Access & RBAC,
application, and platform settings. The shell should not register or advertise standalone
`admin`, `access-rbac`, or internal shell-settings app ids.

The old user settings modal entry should navigate to:

```text
/app/settings/account/profile
```

Deep links to former settings-dialog section ids should map to the closest route, for example:

```text
general -> /app/settings/account/preferences
account -> /app/settings/account/profile
security -> /app/settings/account/security
configuration -> /app/settings/platform/configuration
registry -> /app/settings/platform/widget-registry
connection-registry -> /app/settings/platform/connection-registry
main_sequence_ai::agents-settings -> /app/settings/applications/main_sequence_ai/agents-settings
main_sequence_ai::model-providers -> /app/settings/applications/main_sequence_ai/model-providers
```

## App Registry Model

Settings should become a routed app, not a special shell modal. However, extension-contributed
settings still need a registry contract.

Update the existing shell settings contribution model so entries can be routed:

```ts
export type AppSettingsAudience = "user" | "organization" | "platform";

export interface AppSettingsContribution {
  id: string;
  audience: AppSettingsAudience;
  label: string;
  description?: string;
  icon?: AppIcon;
  order?: number;
  routeSegment?: string;
  group?: {
    id: string;
    label: string;
    icon?: AppIcon;
    order?: number;
    collapsible?: boolean;
  };
  component: ComponentType;
}
```

Compatibility rule:

- user-scoped shared shell contributions can be adapted into Settings during migration
- product-specific settings that already use shell settings contributions can stay in Settings until
  their owning app has a deliberate replacement IA
- platform-admin diagnostics should stay gated and route under the Settings `Platform` group

The settings registry should flatten contributions with app metadata:

- `appId`
- `appTitle`
- `appSource`
- `appIcon`
- route path
- backend shell-access surface id

## Permission Rules

Visibility requires backend shell access for:

- the concrete Settings section app such as `settings.account`, `settings.organization`,
  `settings.access-rbac`, `settings.applications`, or `settings.platform`
- the concrete Settings section surface such as `settings.platform.auth`

The Settings shell should never show inaccessible group headers.

Moving pages into one Settings module must not make organization, billing, platform, provider,
application, or diagnostic pages visible unless the backend returns the matching settings surface.
A shared Settings route is only a navigation container; it is not a permission escalation boundary.
- route-level `PermissionRoute` checks
- page-local guards that disable or hide mutations for non-admin users
- backend-enforced permission failures, which must still render as page errors instead of being
  hidden by frontend-only assumptions

If a user navigates directly to an inaccessible settings URL:

- render the normal permission boundary
- do not silently redirect to an unrelated settings page

Default route resolution:

1. first accessible account page
2. first accessible billing page
3. first accessible organization page
4. first accessible applications page
5. first accessible platform page
6. explicit no-access settings state

## Storage And Backend Contract Impact

This ADR is primarily frontend navigation and composition.

No backend API shape changes are required for the first implementation. Existing admin and user
settings API calls should be reused unchanged.

Frontend storage impact:

- add local UI state for collapsed settings navigation groups and optional collapsed rail state
- do not change workspace, widget, connection, binding, or runtime-state persistence contracts

Backend impact:

- keep existing permission names and API endpoints
- no new backend redirects are required if frontend route redirects are handled in the SPA
- backend documentation may need updated screenshots/routes, but not request/response changes

## Non-Goals

This ADR does not:

- redesign organization user management behavior
- redesign billing, credits, or plan management APIs
- change RBAC permission names
- change authentication token or MFA contracts
- create a new backend settings aggregation endpoint
- require every product extension to implement settings pages immediately
- preserve the user settings modal as a parallel primary UX

## Consequences

Positive:

- one mental model for all settings
- no duplicate user settings and organization admin affordances
- large settings/admin pages get full route, history, and page-layout support
- organization admin becomes easier to discover without being a separate shell mode
- extension settings can scale without bloating `SettingsDialog`

Negative:

- migration touches shell navigation, routing, app registry, settings sections, and tests
- old links need redirects
- the old settings dialog cannot remain the source of truth
- route-driven settings require more deliberate page headers and loading states

## Implementation Tasks

### Phase 1: Inventory And Route Contract

- [ ] Inventory every current `SettingsDialog` section, including user, platform, contributed, and
      hidden/internal sections.
- [ ] Inventory every current organization-admin Settings surface in `src/extensions/core/index.ts`.
- [ ] Inventory every current visibility gate, including backend shell-access surfaces,
      `PermissionRoute` wrappers, contributed sections, and page-local mutation guards.
- [ ] Decide the final route slug for each existing section and admin surface.
- [ ] Remove standalone admin route names from the shell route table.
- [ ] Write a section-id redirect table for old settings dialog section ids.
- [ ] Confirm the first accessible default settings route for user-only, org-admin, and
      platform-admin sessions.
- [ ] Write a permission parity matrix that maps each old section/surface to its new route and
      exact required permissions.

### Phase 2: Settings App Shell

- [ ] Add a `settingsApp` registration in `src/extensions/core/index.ts`.
- [ ] Add a routed settings layout component with page header, collapsible exploration submenu, and
      outlet/content region.
- [ ] Implement grouped navigation data with group ordering, item ordering, active-state matching,
      and permission filtering.
- [ ] Ensure permission filtering happens before group rendering so inaccessible groups and empty
      groups are not shown.
- [ ] Add local persistence for collapsed groups and optional collapsed rail mode.
- [ ] Ensure the submenu uses short labels only; move descriptions into page headers.
- [ ] Add no-access and not-found states inside the Settings app.

### Phase 3: Move User Settings Out Of The Modal

- [ ] Extract account profile content from `SettingsDialog` into a routed settings page.
- [ ] Extract preferences/theme/language content into a routed settings page.
- [ ] Extract MFA/security content into a routed settings page.
- [ ] Extract user sessions content into a routed settings page.
- [ ] Extract user credits/billing contribution into a routed settings page.
- [ ] Keep existing hooks, queries, mutations, and toasts unchanged unless a page extraction requires
      a component boundary cleanup.
- [ ] Remove modal-only assumptions such as fixed dialog height, internal section scroll anchors,
      and dialog close side effects.

### Phase 4: Move Organization Admin Into Settings

- [ ] Move `AdminOrganizationUsersPage` to `/app/settings/organization/users`.
- [ ] Move `AdminActivePlansPage` to `/app/settings/organization/plans`.
- [ ] Move `AdminLoginSessionsPage` to `/app/settings/organization/security-sessions`.
- [ ] Move `AdminWidgetConfigurationsPage` to `/app/settings/organization/widgets` or
      `/app/settings/organization/applications/widgets`.
- [ ] Move `AdminMainSequenceMarketsPage` to
      `/app/settings/organization/applications/main-sequence-markets`.
- [ ] Move `AdminGithubOrganizationsPage` to `/app/settings/organization/github`.
- [ ] Move `AdminInvoicesPage` to `/app/settings/billing/invoices`.
- [ ] Move `AdminBillingDetailsPage` to `/app/settings/billing/details`.
- [ ] Move `AdminHostedResourcesPage` to `/app/settings/billing/hosted-resources`.
- [ ] Move `AdminManageCreditsPage` to `/app/settings/billing/manage-credits`.
- [ ] Preserve each page's current data fetching, permissions, mutation behavior, and assistant
      context.

### Phase 5: Registry Contribution Migration

- [ ] Add the routed settings contribution contract to the app definition types.
- [ ] Adapt existing `shellMenuContributions` into routed settings contributions for backward
      compatibility during migration.
- [ ] Keep shared user contributions in `settingsApp` only when they are not product-specific.
- [ ] Adapt Main Sequence AI shell settings contributions into Settings application routes.
- [ ] Keep organization-owned application settings, such as Main Sequence Markets, in Settings.
- [ ] Add tests for contribution sorting, grouping, permission filtering, and route generation.

### Phase 6: Shell Entry Point Cleanup

- [ ] Change `UserMenu` Settings action to navigate to `/app/settings/account/profile`.
- [ ] Remove the standalone Organization Admin button from the shell.
- [ ] If an admin menu remains temporarily, make its entries navigate into `/app/settings/...`.
- [ ] Remove `SettingsDialog` from the primary shell flow.
- [ ] Keep a temporary compatibility wrapper only if needed for old code paths, and mark it for
      deletion.
- [ ] Update i18n keys from `settingsDialog.*` and `userMenu.settings` where labels change.

### Phase 7: Route Cleanup

- [ ] Remove old standalone admin route names from the active SPA route table.
- [ ] Add compatibility handling only for old settings section ids that are still emitted by
      existing shell controls.
- [ ] Keep backend shell-access boundaries on every Settings target.
- [ ] Add route tests for user-only, org-admin, and platform-admin access.
- [ ] Verify browser back/forward works across Settings pages.

### Phase 8: Visual And UX Polish

- [ ] Match the broad Organization Admin page feel: full-page shell, clear page header, and roomy
      content cards.
- [ ] Reduce submenu noise: no long descriptions, no dense metadata in nav rows, no heavy cards for
      every nav item.
- [ ] Add collapsible group behavior and active-route styling.
- [ ] Add responsive behavior for narrow screens, likely drawer-style settings navigation.
- [ ] Confirm keyboard navigation and focus behavior for collapsible groups.
- [ ] Confirm loading, error, empty, and permission states across migrated pages.

### Phase 9: Documentation And Removal

- [ ] Update `src/app/layout/README.md` with the new Settings ownership model.
- [ ] Update `src/extensions/core/README.md` with settings app registration and contribution rules.
- [ ] Update docs for app registry settings contributions.
- [ ] Update in-app user-facing docs if they mention Organization Admin as a separate shell button.
- [ ] Remove dead modal-only code after all routes are migrated.
- [ ] Remove obsolete admin-menu code paths after redirects are stable.

### Phase 10: Verification

- [ ] Run TypeScript checks.
- [ ] Run route and permission tests.
- [ ] Run settings contribution registry tests.
- [ ] Manually verify user-only session: Settings shows Account/Billing only.
- [ ] Manually verify org-admin session: Settings shows Organization pages and no separate
      Organization Admin button.
- [ ] Manually verify platform-admin session: Settings shows Platform diagnostics.
- [ ] Manually verify old standalone admin URLs are not advertised by the shell.
- [ ] Manually verify old settings entry opens the routed Settings app instead of a modal.

## Acceptance Criteria

- There is exactly one primary shell entry for Settings.
- User settings are no longer presented in a modal.
- Organization Admin is no longer a standalone primary shell button.
- Organization admin pages are available under `/app/settings/organization/...`.
- The Settings submenu is grouped, permission-aware, collapsible, and quiet.
- Existing admin functionality works after migration.
- Existing settings functionality works after migration.
- Existing permission gates are preserved exactly; no user can see or mutate a settings/admin page
  they could not see or mutate before the migration.
- Old admin links redirect to their new routes.
- No backend API contract changes are required.
