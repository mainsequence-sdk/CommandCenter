# Access & RBAC App

## Overview

Access control in Command Center no longer lives as a loose utility page. It is an organization
admin section inside Settings for inspecting shell visibility and opening team administration.

In the core extension, that app is `Access & RBAC`.

Its implementation now lives under:

- `src/extensions/core/apps/access-rbac/`

It lives in Settings under `Access & RBAC`, not in the primary left rail, and it is
permission-gated with `org_admin:view`.

The standalone app registration remains for legacy/deep-link metadata, but normal users reach it
through Settings.

## Why it is an app

This matters once access management becomes substantial.

A dedicated settings section gives you:

- focused routes instead of one overloaded page
- grouped Settings navigation
- searchability through the same app-and-surface model as the rest of the platform
- a clean separation between resolved shell access inspection and team administration
- a clean separation between organization-admin workflows and the platform-only `Admin Settings`
  modal

## Surface model

The shipped `Access & RBAC` Settings section is organized around two normal surfaces:

- `Inspector`: lookup one user and inspect resolved shell access as applications and submenus
- `Teams`: organization team registry, membership management, and sharing

The conceptual RBAC overview lives in the Documentation app. Legacy `Overview`, `Policies`,
`Coverage`, and assignment links redirect to the inspector or documentation as appropriate.

## Registration pattern

Register the app like any other `AppDefinition`, but place it in the admin menu:

```ts
const inspectionSection = {
  id: "inspection",
  label: "User access inspection",
  order: 30,
};

const teamsSection = {
  id: "teams",
  label: "Teams",
  order: 35,
};

const accessRbacApp: AppDefinition = {
  id: "access-rbac",
  title: "Access & RBAC",
  description: "Organization access governance for resolved shell access inspection and teams.",
  source: "core",
  icon: KeyRound,
  navigationPlacement: "admin-menu",
  topNavigationStyle: "hidden",
  requiredPermissions: ["org_admin:view"],
  defaultSurfaceId: "user-inspector",
  surfaces: [
    {
      id: "user-inspector",
      title: "Organization user inspector",
      kind: "page",
      navigationSection: inspectionSection,
      component: AccessRbacInspectorPage,
    },
    {
      id: "teams",
      title: "Teams",
      kind: "page",
      navigationSection: teamsSection,
      component: AccessRbacTeamsPage,
    },
  ],
};
```

## Legacy compatibility

The legacy `/app/access` route can stay alive as a redirect to the Settings inspector:

```ts
<Navigate to="/app/settings/access-rbac/inspector" replace />
```

That keeps old links working while the platform converges on the app-and-surfaces model.

The legacy `/app/teams` route can also redirect into the RBAC app:

```ts
<Navigate to="/app/settings/access-rbac/teams" replace />
```

## Shell Access Contract

Access & RBAC no longer exposes a frontend policy editor. Shell profile definition and assignment
are backend-owned. The frontend calls
`/api/v1/command_center/users/<user_uid>/shell-access/` and renders the returned
`accessible_apps` and `accessible_surfaces` fields as a read-only tree.

The shell app access model stays top-down:

- `workspaces:view` unlocks the Workspaces shell app
- `main_sequence_markets:view` unlocks Main Sequence Markets
- `main_sequence_foundry:view` unlocks Main Sequence Foundry

The normal shell-access read response does not include profile ids, `effective_permissions`,
`grant_permissions`, or `deny_permissions`.

This contract does not change Teams, team membership, workspace sharing, object sharing, or
resource sharing. Those remain separate product models and backend authorization boundaries.
