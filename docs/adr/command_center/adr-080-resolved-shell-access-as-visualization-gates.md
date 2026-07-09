# ADR 080: Resolved Shell Access As Visualization Gates

- Status: Accepted
- Date: 2026-07-04
- Related:
  - [ADR 079: Unified Routed Settings Module](./adr-079-unified-routed-settings-module.md)
  - [Access Control docs](../../access-control/README.md)
  - [Access & RBAC implementation README](../../../src/extensions/core/apps/access-rbac/README.md)

## Context

Command Center has two overlapping access-control concepts.

The frontend shell uses a top-down navigation model:

- the backend returns accessible applications
- the backend returns accessible application surfaces/submenus
- the shell hides apps and surfaces missing from that backend response
- routed Settings pages use backend-returned Settings surface ids

That model is simple: if a user can access the app or submenu according to the backend shell-access
response, they can operate in that shell surface.

The current Access & RBAC policy model is more complicated. It exposes low-level permission strings
through:

- reusable `AccessPolicy.permissions`
- per-user `grant_permissions`
- per-user `deny_permissions`
- derived group permissions such as `<group>:access`
- effective permission coverage views

This makes the product feel like it is editing backend-enforced authorization rules, but that is not
the right boundary. Command Center shell access is mostly about visualization and navigation. Real
backend security is enforced by backend-owned concerns such as organization ownership, object access,
connection permissions, workspace ownership, public-link publication checks, billing authority, and
platform staff status.

The current UI therefore mixes concepts:

- shell visibility
- application/submenu navigation
- backend resource permissions
- widget/workspace metadata
- connection/query action checks
- direct grants and deny overrides

That produces an admin experience that is too technical and too easy to misread as the final
security boundary.

## Decision

Command Center Access & RBAC should model **shell visualization access**, not arbitrary backend
permission grants.

Command Center must not provide an organization-admin policy editor for shell-access assignment.
Shell access definition and assignment are backend-owned responsibilities. The frontend Access &
RBAC section should keep only inspection and documentation surfaces for the resolved app/surface
contract.

Admins should not edit raw permission strings in Command Center.

Raw permission ids remain implementation metadata used to bridge the existing app registry and
legacy API contracts. They are not the primary product model and should not be presented as the
main admin workflow.

## Target Read-Only UX

The Access & RBAC UI should keep the inspector, but remove the policy editor from normal
navigation. The inspector should show the resolved shell access as a tree, not as an editable
permission-string checklist.

Example:

```text
Inspected user: analyst@main-sequence.io

Applications
[x] Workspaces
    [x] Workspace Home
    [x] Saved Widgets
    [ ] Public Publishing

[x] Main Sequence Markets
    [x] Market Overview
    [x] Asset Screener
    [x] Curve Plot

[ ] Main Sequence Foundry

Settings
[ ] Access & RBAC
[ ] Billing
[ ] Platform
```

The UI must not expose this as an editable workflow:

```text
main_sequence_markets:view
orders:read
widget.catalog:view
grant_permissions
deny_permissions
Save policy
Assign policy
```

Those raw ids can remain visible only in developer/debug diagnostics, migration tools, or platform
admin catalog inspection.

## Backend Contract

The normal frontend contract is the resolved user shell-access response only. Command Center
organization-admin UI must not depend on access-policy authoring DTOs, policy ids, raw permission
bundles, or scope metadata.

### User Shell Access Response

`GET /api/v1/command_center/users/<user_uid>/shell-access/` should return app/surface access
directly:

```json
{
  "user_uid": "11111111-1111-4111-8111-111111111111",
  "accessible_apps": ["workspace-studio", "main_sequence_markets", "settings.platform"],
  "accessible_surfaces": [
    "workspace-studio.workspaces",
    "workspace-studio.widgets",
    "main_sequence_markets.assets",
    "settings.platform.auth"
  ]
}
```

Shell-access response rules:

- `accessible_apps` and `accessible_surfaces` are the canonical frontend rendering contract.
- Normal shell-access reads do not return policy ids, raw permission strings,
  `grant_permissions`, `deny_permissions`, `surface_profiles`, or derived group metadata.
- Backend output must be deterministic: arrays are deduplicated and sorted by backend catalog order
  where possible.
- Command Center frontend clients do not write access policies or user shell-access assignments.
- Access-policy storage and write payloads are backend-internal or platform-only implementation
  details, not part of the normal Command Center organization-admin contract.

## Enforcement Boundary

Resolved shell access is not the final backend security boundary.

It decides:

- which apps appear in the shell
- which submenus/surfaces appear in the shell
- whether a routed frontend surface should render for the signed-in user

They do not replace:

- organization ownership checks
- teams, team membership, or team administration models
- workspace, object, or resource sharing models
- object-level access models
- workspace ownership and sharing checks
- public workspace publication validation
- connection instance query/edit checks
- billing and platform staff authorization
- DRF permission classes for backend APIs

Backend endpoints must continue to enforce their own resource and action rules. The ADR does not
authorize weakening backend-side checks because shell access grants visibility to a route.

This ADR must not change Teams or sharing behavior. Team membership, team-scoped sharing, workspace
sharing, object access, and resource access remain separate product contracts and must stay intact.

## Backend Shell Catalog Role

Backend shell cataloging should become the bridge between product UX and implementation gates.

It should describe:

- apps
- surfaces/submenus
- route paths
- hidden/deep-link-only surfaces
- app-level and surface-level implementation requirements

Backend-owned shell-access resolution should use that catalog.

Runtime shell code must consume `accessible_apps` and `accessible_surfaces` directly. It must not
map those ids back into local permission strings.

## Migration Plan

### Phase 1: Remove Frontend Authoring

- Remove the Access & RBAC policy editor from normal frontend navigation.
- Keep only the inspector/read-only access visualization surface in Command Center.
- Remove normal frontend parsing of `AccessPolicy.permissions`, `grant_permissions`, and
  `deny_permissions`.
- Remove direct grant/deny editing from normal organization-admin UX.

### Phase 2: Expose Resolved App/Surface Access

- Return `accessible_apps` and `accessible_surfaces` from shell-access endpoints.
- Remove raw permission, policy-id, direct grant, and direct deny fields from the normal
  shell-access read response.

### Phase 3: Replace Inspector Output

- Replace inspector permission coverage/checklists with an application/submenu tree.
- Show raw implementation ids only in a collapsed developer/debug area, if needed.
- Remove frontend create/update/delete policy controls.

### Phase 4: Retire Direct Grants And Denies

- Remove normal UI support for arbitrary `grant_permissions` and `deny_permissions`.
- Preserve a controlled migration/admin repair path if old rows contain overrides.
- Add backend validation preventing new arbitrary grants from normal organization-admin shell
  access workflows.

### Phase 5: Clean Documentation And Legacy Fields

- Update frontend and backend docs to describe shell visualization access as separate from backend
  resource authorization.
- Document that Command Center Access & RBAC is read-only for shell-access assignment.
- Keep legacy storage or migration-only repair paths out of the normal organization-admin
  shell-access response.

## Documentation Requirements

When this ADR is implemented, documentation must be updated in the same change set.

Required documentation updates:

- `docs/access-control/README.md`: explain resolved shell access as app/surface visualization
  access, not generic backend RBAC.
- `docs/auth/backend-and-auth.md`: update the shell-access contract examples to show
  `accessible_apps` and `accessible_surfaces`.
- `src/extensions/core/apps/access-rbac/README.md`: document that the Access & RBAC UI is read-only
  for shell-access assignment and only inspects resolved access.
- `extensions/command_center_docs/content/organization-admin/rbac.md`: update organization-admin
  guidance so admins understand shell access as backend-owned app/submenu access.
- Backend Command Center docs should document that `AccessPolicy.permissions`, `grant_permissions`,
  `deny_permissions`, and `effective_permissions` are not part of the normal shell-access read
  response.

Docs must explicitly state that shell access is not a replacement for backend resource-level
authorization.

## Consequences

### Positive

- Organization admins inspect the product model they understand: apps and sections.
- Access & RBAC becomes consistent with the Settings navigation model.
- The frontend remains focused on visualization and route access.
- Backend authorization boundaries become clearer instead of being implied by UI permission strings.
- Backend shell cataloging becomes a useful product contract instead of a frontend sync artifact.

### Tradeoffs

- Requires a compatibility period because existing policies store raw permissions.
- Existing coverage/inspector views need to be redesigned around app/surface access.
- Some action-level capabilities, such as public publishing or connection query, still need careful
  product placement because they are not pure visualization gates.

## Rejected Alternatives

### Keep Raw Permission Bundles As The Main Admin UX

Rejected because it continues to expose implementation details and suggests stronger backend
enforcement semantics than the shell can guarantee.

### Make Frontend Shell Permissions The Backend Security Boundary

Rejected because backend security must remain resource- and action-specific. Shell route visibility
cannot replace DRF permission classes, object ownership, connection authorization, or platform staff
checks.

### Remove Backend Shell Access Completely

Rejected because the frontend still needs a server-owned way to resolve the signed-in user's shell
visibility and to keep app/surface access consistent across sessions and devices.

## Implementation Tasks

- [x] Resolve shell-access app/surface visibility from the active backend shell catalog.
- [x] Return `accessible_apps` and `accessible_surfaces` from shell-access endpoints.
- [x] Remove legacy policy, grant, deny, and `effective_permissions` fields from the normal
  shell-access read response.
- [x] Remove the policy editor from Access & RBAC navigation.
- [x] Remove direct grant/deny editing from normal organization-admin UX.
- [x] Redesign the inspector around read-only apps and surfaces.
- [x] Gate shell apps, surfaces, Settings routes, search, favorites, and shell menu contributions
  from backend `accessible_apps` / `accessible_surfaces`.
- [x] Remove frontend role/group/policy derivation for shell visibility.
- [x] Remove app/surface `requiredPermissions` metadata from the app registry.
- [x] Verify no Teams, team membership, workspace sharing, object sharing, or resource sharing
  contracts are changed by the shell-access work.
- [x] Update frontend, backend, and organization-admin documentation as required above.
