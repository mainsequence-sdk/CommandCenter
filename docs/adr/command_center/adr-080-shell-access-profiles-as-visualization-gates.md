# ADR 080: Shell Access Profiles As Visualization Gates

- Status: Proposed
- Date: 2026-07-04
- Related:
  - [ADR 079: Unified Routed Settings Module](./adr-079-unified-routed-settings-module.md)
  - [Access Control docs](../../access-control/README.md)
  - [Access & RBAC implementation README](../../../src/extensions/core/apps/access-rbac/README.md)

## Context

Command Center has two overlapping access-control concepts.

The frontend shell already uses a top-down navigation model:

- applications declare `requiredPermissions`
- application surfaces/submenus declare `requiredPermissions`
- the shell hides inaccessible apps and surfaces
- routed Settings pages use route-level permissions plus organization/platform admin class checks

That model is simple: if a user can access the app or submenu, they can operate in that shell
surface.

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

The canonical admin unit becomes a **Shell Access Profile**:

- a named profile assigned to users or groups
- composed from applications and optional surfaces/submenus
- derived from the generated access catalog
- exposed to Command Center as a resolved, read-only app/surface tree

Command Center must not provide an organization-admin policy editor for shell-access assignment.
Shell profile definition and assignment are backend-owned responsibilities. The frontend Access &
RBAC section should keep only inspection and documentation surfaces for this contract.

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
Assigned profiles: Research Analyst

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
Save profile
Assign profile
```

Those raw ids can remain visible only in developer/debug diagnostics, migration tools, or platform
admin catalog inspection.

## Backend Contract

The frontend access catalog remains the source of shell application and surface metadata.

Backend access-policy payloads must expose app/surface profile fields directly. The frontend should
not have to infer shell visibility by reverse-engineering raw permission strings.

### Access Policy Read Response

`GET /api/v1/command_center/access-policies/` and
`GET /api/v1/command_center/access-policies/<id>/` should return:

```json
{
  "id": 7,
  "uid": "7f0e4ea6-5c2e-4602-9f5d-2e7a02de0f0d",
  "slugified_name": "research-analyst",
  "label": "Research Analyst",
  "description": "Market and workspace shell access for research users.",
  "is_system": false,
  "is_visible": true,
  "is_editable": true,
  "app_access": [
    {
      "app_uid": "workspace_studio",
      "surface_uids": ["home", "saved-widgets"],
      "include_all_surfaces": false
    },
    {
      "app_uid": "main_sequence_markets",
      "surface_uids": ["overview", "asset-screener", "curve-plot"],
      "include_all_surfaces": false
    }
  ],
  "resolved_access": {
    "accessible_apps": ["workspace_studio", "main_sequence_markets"],
    "accessible_surfaces": [
      "workspace_studio.home",
      "workspace_studio.saved-widgets",
      "main_sequence_markets.overview",
      "main_sequence_markets.asset-screener",
      "main_sequence_markets.curve-plot"
    ]
  },
  "permissions": [
    "workspaces:view",
    "main_sequence_markets:view"
  ]
}
```

Field semantics:

- `app_access` is the authoring source of truth.
- `app_access[].app_uid` must match an app in the active access catalog.
- `app_access[].surface_uids` must match surfaces for that app in the active access catalog.
- `app_access[].include_all_surfaces=true` means newly synced visible surfaces for the app are
  included automatically.
- `resolved_access` is backend-derived read output for frontend rendering and inspection.
- `permissions` is compatibility output only while legacy frontend gates still require permission
  ids.

### Backend-Owned Access Policy Write Contract

`POST /api/v1/command_center/access-policies/` and
`PATCH /api/v1/command_center/access-policies/<id>/` may exist for backend-owned admin tooling,
migrations, or platform-only operations, but they are not part of the Command Center organization
admin frontend workflow.

When a backend-owned writer updates profiles, the payload should use:

```json
{
  "slugified_name": "research-analyst",
  "label": "Research Analyst",
  "description": "Market and workspace shell access for research users.",
  "app_access": [
    {
      "app_uid": "workspace_studio",
      "surface_uids": ["home", "saved-widgets"],
      "include_all_surfaces": false
    },
    {
      "app_uid": "main_sequence_markets",
      "surface_uids": ["overview", "asset-screener", "curve-plot"],
      "include_all_surfaces": false
    }
  ]
}
```

Write rules:

- Command Center frontend clients do not write access policies.
- Backend-owned or platform-only writers write `app_access`, not `permissions`.
- The backend validates every app and surface against the active access catalog.
- The backend derives compatibility `permissions` from selected app/surface records.
- The backend rejects unknown app ids, unknown surface ids, and surfaces that do not belong to the
  selected app.
- The backend rejects writes to hidden platform-only surfaces unless the acting user is platform
  admin and the endpoint explicitly allows that operation.
- System policies may remain read-only depending on the existing system-policy lock behavior.

### User Shell Access Response

`GET /api/v1/command_center/users/<user_uid>/shell-access/` should return app/surface access
directly:

```json
{
  "user_uid": "11111111-1111-4111-8111-111111111111",
  "accessible_apps": ["workspace_studio", "main_sequence_markets"],
  "accessible_surfaces": [
    "workspace_studio.home",
    "workspace_studio.saved-widgets",
    "main_sequence_markets.overview"
  ]
}
```

Shell-access response rules:

- `accessible_apps` and `accessible_surfaces` are the canonical frontend rendering contract.
- Normal shell-access reads do not return profile ids, raw permission strings,
  `grant_permissions`, `deny_permissions`, or derived group metadata.
- Backend output must be deterministic: arrays are deduplicated and sorted by access-catalog order
  where possible.

### Backend-Owned User Shell Access Write Contract

`PATCH /api/v1/command_center/users/<user_uid>/shell-access/` may exist for backend-owned admin
tooling, migrations, or platform-only operations, but it is not part of the Command Center
organization-admin frontend workflow.

When a backend-owned writer assigns profiles, the payload should use profile ids only:

```json
{
  "policy_uids": [
    "7f0e4ea6-5c2e-4602-9f5d-2e7a02de0f0d"
  ]
}
```

Normal Command Center frontend clients should not send profile assignments, arbitrary direct
`grant_permissions`, or `deny_permissions`. If those fields remain accepted for migration or repair,
they must be platform-admin-only or otherwise protected behind an explicit compatibility path.

### Compatibility Requirements

During migration, the backend may keep existing storage fields:

- `AccessPolicy.permissions`
- `UserShellAccess.grant_permissions`
- `UserShellAccess.deny_permissions`
- `effective_permissions`

However, after this ADR is implemented:

- `app_access` is the authoring source of truth for shell profiles.
- `permissions` is derived output.
- direct grants and denies are not part of the normal organization-admin product flow.
- Command Center consumes shell access as read-only resolved visibility and does not mutate shell
  access.
- normal shell-access reads return only `user_uid`, `accessible_apps`, and
  `accessible_surfaces`.

## Enforcement Boundary

Shell access profiles are not the final backend security boundary.

They decide:

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
authorize weakening backend-side checks because a shell profile grants access to a route.

This ADR must not change Teams or sharing behavior. Team membership, team-scoped sharing, workspace
sharing, object access, and resource access remain separate product contracts and must stay intact.

## Access Catalog Role

The access catalog should become the bridge between product UX and implementation gates.

It should describe:

- apps
- surfaces/submenus
- route paths
- hidden/deep-link-only surfaces
- app-level and surface-level implementation requirements

Backend-owned Shell Access Profiles should select from that catalog.

If existing runtime code still needs permission strings, those strings should be generated from the
selected app/surface entries, not hand-authored by organization admins.

## Migration Plan

### Phase 1: Remove Frontend Authoring

- Remove the Access & RBAC policy editor from normal frontend navigation.
- Keep only the inspector/read-only access visualization surface in Command Center.
- Keep legacy `AccessPolicy.permissions`, `grant_permissions`, and `deny_permissions` readable for
  compatibility.
- Remove direct grant/deny editing from normal organization-admin UX.

### Phase 2: Add App/Surface Profile DTOs

- Add app/surface profile fields to backend access policy payloads.
- Resolve profile app/surface selections against the active access catalog.
- Return `accessible_apps` and `accessible_surfaces` from shell-access endpoints.
- Remove raw permission, profile-id, direct grant, and direct deny fields from the normal
  shell-access read response.

### Phase 3: Replace Inspector Output

- Replace inspector permission coverage/checklists with an application/submenu tree.
- Show raw implementation ids only in a collapsed developer/debug area, if needed.
- Remove frontend create/update/delete policy controls.

### Phase 4: Retire Direct Grants And Denies

- Remove normal UI support for arbitrary `grant_permissions` and `deny_permissions`.
- Preserve a controlled migration/admin repair path if old rows contain overrides.
- Add backend validation preventing new arbitrary grants from organization-admin profile writes.

### Phase 5: Clean Documentation And Legacy Fields

- Update frontend and backend docs to describe shell visualization access as separate from backend
  resource authorization.
- Document that Command Center Access & RBAC is read-only for shell profile assignment.
- Keep legacy storage or migration-only repair paths out of the normal organization-admin
  shell-access response.

## Documentation Requirements

When this ADR is implemented, documentation must be updated in the same change set.

Required documentation updates:

- `docs/access-control/README.md`: explain Shell Access Profiles as app/surface visualization
  access, not generic backend RBAC.
- `docs/auth/backend-and-auth.md`: update the shell-access contract examples to show
  `accessible_apps` and `accessible_surfaces`.
- `src/extensions/core/apps/access-rbac/README.md`: document that the Access & RBAC UI is read-only
  for shell profile assignment and only inspects resolved access.
- `extensions/command_center_docs/content/organization-admin/rbac.md`: update organization-admin
  guidance so admins understand profiles as backend-owned app/submenu access.
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
- The access catalog becomes a useful product contract instead of only a sync artifact.

### Tradeoffs

- Requires a compatibility period because existing policies store raw permissions.
- Backend DTOs need a new app/surface profile shape, and frontend DTOs need read-only support for
  that resolved shape.
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

- [x] Resolve shell-access app/surface visibility from the active access catalog.
- [x] Return `accessible_apps` and `accessible_surfaces` from shell-access endpoints.
- [x] Remove legacy policy, grant, deny, and `effective_permissions` fields from the normal
  shell-access read response.
- [x] Remove the policy editor from Access & RBAC navigation.
- [x] Remove direct grant/deny editing from normal organization-admin UX.
- [x] Redesign the inspector around read-only apps and surfaces.
- [x] Verify no Teams, team membership, workspace sharing, object sharing, or resource sharing
  contracts are changed by the shell-profile work.
- [x] Update frontend, backend, and organization-admin documentation as required above.
- [x] Add backend app/surface profile fields to access-policy payloads using the Backend Contract
  above.
