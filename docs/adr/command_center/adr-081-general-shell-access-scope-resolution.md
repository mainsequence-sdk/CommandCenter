# ADR 081: General Shell Access Scope Resolution

- Status: Accepted
- Date: 2026-07-05
- Related:
  - [ADR 080: Resolved Shell Access As Visualization Gates](./adr-080-resolved-shell-access-as-visualization-gates.md)
  - [ADR 079: Unified Routed Settings Module](./adr-079-unified-routed-settings-module.md)
  - [Settings implementation README](https://github.com/mainsequence-sdk/CommandCenter/blob/main/src/features/settings/README.md)

## Context

Command Center needs section-level shell access for Settings, Foundry, Main Sequence Markets, and
Main Sequence AI without creating one-off access logic for each product area.

The previous direction solved Settings by mapping Settings routes into shell access ids, but that is
too narrow. Foundry needs the same kind of control for sections such as Tenancy Infrastructure.
Markets and AI need the same model for their own internal application sections. This must be a
general shell resolution rule, not a Settings-only or Foundry-only exception.

The frontend app registry is still the product/navigation registry. We are not splitting these
sections into separate frontend applications just to make access checks work. Shell access should
resolve against product apps and their registered sections.

## Decision

Shell access is a dot-delimited scope tree.

The backend may grant access at either:

- app scope: `app`
- section/subapp scope: `app.subapp`

The allow rule is prefix based:

```text
accessible_apps includes "app"
=> allow every shell surface under "app."

accessible_apps includes "app.subapp"
=> allow every shell surface under "app.subapp."
```

In code terms, a shell surface key is allowed when any granted app scope is equal to the surface key
or is a prefix followed by a dot:

```ts
surfaceKey === grantedScope || surfaceKey.startsWith(`${grantedScope}.`)
```

This is the primary shell visibility rule. The frontend must not require app-specific hardcoded
branches such as `if appId === "settings"` to decide whether a sectioned route is allowed.

## Canonical Shell Keys

Shell access keys use dot delimiters only:

```text
settings.account.profile
settings.access-rbac.inspector
settings.platform.auth
main-sequence-foundry.tenancy-infrastructure.clusters
main_sequence_markets.assets.instruments
main_sequence_ai.agents.project-agents
```

Route paths may still use slashes:

```text
/app/settings/account/profile
/app/settings/access-rbac/inspector
```

Route paths are not shell access ids. Any existing slash-shaped shell ids such as
`settings.account/profile` are migration artifacts and should be normalized to the dot-delimited
scope tree.

## Resolution Model

Each registered app has a product app id:

```text
settings
main-sequence-foundry
main_sequence_markets
main_sequence_ai
workspace-studio
```

Each registered surface resolves to a shell surface key through one generic resolver:

```ts
resolveShellAccessTarget(app, surface) => {
  appScopeId: string;
  sectionScopeId?: string;
  surfaceKey: string;
}
```

Flat apps resolve as:

```text
appScopeId = app.id
surfaceKey = app.id + "." + surface.id
```

Sectioned apps resolve as:

```text
appScopeId = app.id
sectionScopeId = app.id + "." + section.id
surfaceKey = app.id + "." + section.id + "." + sectionRelativeSurfaceId
```

The section comes from generic registry metadata, normally `surface.navigationSection.id`. A surface
may provide an explicit section-relative shell id if its route id is not already section-relative.
The resolver can strip a leading `sectionId/` or `sectionId.` from route-like surface ids, but that
must be generic behavior, not a special case for a named app.

## Backend Contract

The backend shell-access response should return granted scopes in `accessible_apps`.

Example broad app grant:

```json
{
  "user_uid": "11111111-1111-4111-8111-111111111111",
  "accessible_apps": ["main_sequence_markets"]
}
```

This allows all shell surfaces whose canonical key starts with `main_sequence_markets.`.

Example section grant:

```json
{
  "user_uid": "11111111-1111-4111-8111-111111111111",
  "accessible_apps": ["settings.access-rbac"]
}
```

This allows all shell surfaces whose canonical key starts with `settings.access-rbac.`.

The backend catalog must use the same canonical key space as the frontend resolver. The backend
should not return legacy names such as `admin.*` for Settings surfaces when the route and product
area are now `settings.*`.

## Examples

```json
{
  "accessible_apps": ["settings"]
}
```

Allows:

```text
settings.account.profile
settings.account.preferences
settings.billing.invoices
settings.organization.users
settings.access-rbac.inspector
settings.platform.auth
```

```json
{
  "accessible_apps": ["settings.platform"]
}
```

Allows:

```text
settings.platform.auth
settings.platform.configuration
settings.platform.widget-registry
settings.platform.connection-registry
```

Does not allow:

```text
settings.account.profile
settings.organization.users
settings.access-rbac.inspector
```

```json
{
  "accessible_apps": ["main-sequence-foundry.tenancy-infrastructure"]
}
```

Allows:

```text
main-sequence-foundry.tenancy-infrastructure.clusters
main-sequence-foundry.tenancy-infrastructure.timescaledb-services
```

## Implementation Plan

1. Add generic shell access metadata to the app registry only where the default app-level behavior
   is not enough.
2. Add one shared shell-access resolver in the app registry utilities.
3. Remove Settings-specific shell access parsing helpers and replace them with the shared resolver.
4. Update app and surface visibility checks to use prefix-scope matching against
   `accessible_apps`.
5. Apply the same metadata model to Settings, Foundry, Markets, and Main Sequence AI.
6. Normalize backend and mock shell catalogs to dot-delimited keys.
7. Update Access & RBAC inspector output to show app scopes and section scopes from the same
   resolver.
8. Add tests for broad app grants, section grants, nested route ids, hidden surfaces, and denied
   sibling sections.

## Non-Goals

This ADR does not change backend resource authorization.

It does not change:

- teams
- team membership
- workspace sharing
- object access
- portfolio groups
- connection instance permissions
- billing backend enforcement
- platform staff enforcement

Shell access decides whether Command Center renders a shell route. Backend APIs remain responsible
for enforcing resource and action permissions.

## Consequences

Backend access assignment becomes simpler because it can grant `app` or `app.subapp` instead of
enumerating every surface for common cases.

Frontend routing becomes consistent because Settings, Foundry, Markets, and AI use the same
resolution path.

The Access & RBAC inspector can show a clean top-down tree:

```text
Settings
  Account
  Billing
  Organization
  Access & RBAC
  Platform

Main Sequence Foundry
  Development
  Data Engineering
  Tenancy Infrastructure
```

Legacy exact permission strings and legacy app names should not drive shell visibility.
